"""
Karate Motion Studio — Advanced Multi-Camera AI Mocap Server.
Supports 1, 2, or 3 smartphone cameras in canonical T-Configuration (or any combination):
- Works robustly with ANY number of active cameras (0, 1, 2, or 3) with dynamic hot-plugging
- Standalone profile camera compensation (rotates profile cameras to front if used alone)
- Anatomical joint limit protection & kimono cloth penetration prevention
- Real-time live 3D avatar reaction at all times (even without recording)
- Dual Recording Engine: Full-Body Recording OR Layered Multi-Pass Recording (Lower, Upper, Head/Fingers)
- Redesigned visual T-scheme QR connection modal with interactive camera map
"""
from __future__ import annotations
import os
import sys
import io
import time
import json
import asyncio
import threading
import socket
from pathlib import Path
from typing import Dict, Any, Optional, Set, List, Tuple
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor, as_completed

# Silence noisy C++ / TensorFlow logs
os.environ["GLOG_minloglevel"] = "3"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["ABSL_LOGGING_MIN_SEVERITY"] = "3"

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse, Response, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from core.phone_stream_server import get_local_ip, MOBILE_CLIENT_HTML
from core.mocap_tracker import MocapTracker, analyze_karate_biomechanics
from core.retargeter import Retargeter
from core.project_schema import FrameData, KarateMotionProject, Metadata

try:
    from gui.draw_utils import draw_badge_utf8, draw_text_utf8
except Exception:
    draw_badge_utf8 = None
    draw_text_utf8 = None

try:
    import qrcode
    HAS_QRCODE = True
except ImportError:
    HAS_QRCODE = False


def generate_qr_png_bytes(url: str) -> bytes:
    if HAS_QRCODE:
        qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    else:
        img = np.full((240, 240, 3), 255, dtype=np.uint8)
        cv2.rectangle(img, (10, 10), (230, 230), (0, 0, 0), 3)
        cv2.putText(img, "QR CODE", (40, 125), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 2)
        _, png = cv2.imencode(".png", img)
        return png.tobytes()


app = FastAPI(title="Karate Motion Studio Multi-Cam")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "ALLOWALL"
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


ASSETS_DIR = PROJECT_ROOT / "demo_assets"
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")
if (ASSETS_DIR / "js").exists():
    app.mount("/js", StaticFiles(directory=str(ASSETS_DIR / "js")), name="js")

RECORDINGS_DIR = PROJECT_ROOT.parent / "uploads" / "recordings"
try:
    RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/recordings_static", StaticFiles(directory=str(RECORDINGS_DIR)), name="recordings_static")
except Exception:
    pass

@app.get("/karateka_lowpoly.glb")
async def get_root_model():
    model_file = ASSETS_DIR / "karateka_lowpoly.glb"
    return FileResponse(str(model_file), media_type="model/gltf-binary")


# Network ports & IP Resolution
def get_current_host_ip() -> str:
    search_paths = [
        Path("/app/uploads/tunnel-info.json"),
        PROJECT_ROOT.parent / "uploads" / "tunnel-info.json",
        PROJECT_ROOT / "uploads" / "tunnel-info.json",
        Path.cwd() / "uploads" / "tunnel-info.json",
        Path.cwd().parent / "uploads" / "tunnel-info.json",
    ]
    for p in search_paths:
        try:
            if p.exists():
                data = json.loads(p.read_text(encoding="utf-8"))
                lip = data.get("localIp")
                if lip and lip != "127.0.0.1" and not str(lip).startswith("172.") and not str(lip).startswith("169.254"):
                    return str(lip)
        except Exception:
            pass

    env_ip = os.environ.get("HOST_IP", "").strip()
    if env_ip and env_ip != "127.0.0.1" and not env_ip.startswith("169.254") and not env_ip.startswith("172."):
        return env_ip

    detected = get_local_ip()
    if detected and detected != "127.0.0.1" and not detected.startswith("169.254") and not detected.startswith("172."):
        return detected

    return "10.129.167.47"

HOST_IP = get_current_host_ip()
HTTP_PORT = 8000
HTTPS_PORT = 8088
USE_SSL = (ASSETS_DIR / "ssl_cert.pem").exists() and (ASSETS_DIR / "ssl_key.pem").exists()

# Dedicated Multi-Camera Trackers
# Cam 1 (Front) tracks body & both hands with MediaPipe Holistic.
# Cam 2 & 3 (Side Profiles) track body pose at 120 FPS without CPU overload!
tracker_cam1 = MocapTracker(track_hands=True, model_complexity=0)
tracker_cam2 = MocapTracker(track_hands=False, model_complexity=0)
tracker_cam3 = MocapTracker(track_hands=False, model_complexity=0)

tracker_cam1_lock = threading.Lock()
tracker_cam2_lock = threading.Lock()
tracker_cam3_lock = threading.Lock()
tracking_loop_started = False

retargeter = Retargeter()
thread_pool = ThreadPoolExecutor(max_workers=3, thread_name_prefix="MocapWorker")
cam_workers_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="CamWorker")

# Zero-Lag In-Memory Buffers
frame_buffer_lock = asyncio.Lock()
incoming_frame_buffers: Dict[str, bytes] = {}
camera_last_seen: Dict[str, float] = {}
camera_fps: Dict[str, float] = {"cam1": 0.0, "cam2": 0.0, "cam3": 0.0}
camera_frame_counts: Dict[str, int] = {"cam1": 0, "cam2": 0, "cam3": 0}
camera_fps_timers: Dict[str, float] = {"cam1": time.time(), "cam2": time.time(), "cam3": time.time()}

# Connected WebSockets
connected_viewers: Set[WebSocket] = set()
viewer_lock = asyncio.Lock()
connected_phones: Set[WebSocket] = set()
phone_lock = asyncio.Lock()
phone_socket_locks: Dict[WebSocket, asyncio.Lock] = {}

# ---------------------------------------------------------------------------
# Full vs Layered Motion Capture Recording Engine
# ---------------------------------------------------------------------------
recording_mode: str = "full"  # "full" | "layered"
active_recording_layer: str = "lower"  # "lower" | "upper" | "fingers"
is_recording: bool = False
recording_start_time: float = 0.0

# Full recording buffers
recording_frames: List[Dict[str, Any]] = []
recording_rotations: List[Dict[str, List[float]]] = []
last_saved_recording: Optional[Dict[str, Any]] = None

# Layered recording buffers (Upper body includes torso, arms, head, and base fingers)
layer_buffers: Dict[str, List[Dict[str, Any]]] = {
    "lower": [],
    "upper": [],
    "fingers": [],
}
layer_rotations_buffer: Dict[str, List[Dict[str, List[float]]]] = {
    "lower": [],
    "upper": [],
    "fingers": [],
}
stored_layers: Dict[str, Optional[Dict[str, Any]]] = {
    "lower": None,
    "upper": None,
    "fingers": None,
}

recording_lock = threading.Lock()

latest_jpeg_bytes: Optional[bytes] = None
latest_fused_pose: Optional[Dict[str, Any]] = None
latest_biomechanics: Dict[str, Any] = {
    "stance": "Йой-дати (Готовность)",
    "technique": "Позиция ожидания",
    "knee_l": 175.0,
    "knee_r": 175.0,
    "elbow_l": 90.0,
    "elbow_r": 90.0,
    "score": 95,
}
is_mirror = False
frame_idx = 0
frame_ready_event = asyncio.Event()
new_incoming_event = asyncio.Event()


def get_waiting_splash_jpeg() -> bytes:
    img = np.zeros((720, 1280, 3), dtype=np.uint8)
    cv2.rectangle(img, (20, 20), (1260, 700), (35, 40, 50), 2)
    current_ip = get_current_host_ip()
    cv2.putText(img, "KARATE MOTION STUDIO - T-CAM AI MOCAP", (210, 160), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (71, 87, 255), 2)
    cv2.putText(img, "Connect 1, 2, or 3 Smartphone Cameras via Wi-Fi:", (250, 220), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (200, 205, 215), 2)
    cv2.putText(img, f"Cam 1 (Front 0 deg):   https://{current_ip}:{HTTPS_PORT}/cam1", (270, 290), cv2.FONT_HERSHEY_SIMPLEX, 0.78, (16, 185, 129), 2)
    cv2.putText(img, f"Cam 2 (Left +90 deg):  https://{current_ip}:{HTTPS_PORT}/cam2", (270, 340), cv2.FONT_HERSHEY_SIMPLEX, 0.78, (6, 182, 212), 2)
    cv2.putText(img, f"Cam 3 (Right -90 deg): https://{current_ip}:{HTTPS_PORT}/cam3", (270, 390), cv2.FONT_HERSHEY_SIMPLEX, 0.78, (168, 85, 247), 2)
    cv2.putText(img, "Works seamlessly with ANY number of active cameras!", (240, 460), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (245, 158, 11), 2)
    t = time.time()
    pulse = int(12 + 6 * np.sin(t * 3))
    cv2.circle(img, (640, 550), max(3, pulse), (71, 87, 255), -1)
    cv2.putText(img, "AWAITING WIRELESS CAMERA STREAM...", (410, 620), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (140, 150, 160), 2)
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return buf.tobytes()

latest_jpeg_bytes = get_waiting_splash_jpeg()


# ---------------------------------------------------------------------------
# Multi-Camera 3D Landmark & Depth Fusion Engine (Handles ANY # of cameras!)
# ---------------------------------------------------------------------------
def fuse_multicam_landmarks(
    fdata1: Optional[FrameData],
    fdata2: Optional[FrameData],
    fdata3: Optional[FrameData],
) -> Optional[FrameData]:
    """
    Robust Multi-Camera Fusion Engine for ANY configuration:
    - 0 Cameras: Returns None gracefully
    - 1 Camera alone:
        * Cam 1 (Front): Full frontal pose + single-camera behind-head consistency
        * Cam 2 (Left +90 Profile alone): Rotates coordinates -90 deg so avatar faces front!
        * Cam 3 (Right -90 Profile alone): Rotates coordinates +90 deg so avatar faces front!
    - 2 Cameras:
        * Cam 1 + Cam 2: Frontal width/height + Left side depth Z, footwork & behind-head
        * Cam 1 + Cam 3: Frontal width/height + Right side depth Z, hikite & behind-head
        * Cam 2 + Cam 3 (both profiles without front): Depth Z averaged from left and right
    - 3 Cameras:
        * Full T-configuration (Front + Left + Right) for zero-blindspot 360 deg capture
    """
    # Check which cameras are active
    c1_ok = fdata1 is not None and not fdata1.tracking_loss and bool(fdata1.joints)
    c2_ok = fdata2 is not None and not fdata2.tracking_loss and bool(fdata2.joints)
    c3_ok = fdata3 is not None and not fdata3.tracking_loss and bool(fdata3.joints)

    if not c1_ok and not c2_ok and not c3_ok:
        return None

    # CASE A: Standalone Side Camera (User connected ONLY Cam 2 or ONLY Cam 3)
    if not c1_ok and c2_ok and not c3_ok:
        # Cam 2 alone: rotate raw profile coordinates -90 deg around Y so person faces front
        f2 = fdata2
        rotated_joints = {}
        for k, v in f2.joints.items():
            rotated_joints[k] = [round(-v[2], 4), round(v[1], 4), round(v[0], 4)]
        root_rot = [-f2.rootPosition[2], f2.rootPosition[1], f2.rootPosition[0]] if f2.rootPosition else [0, 0.9, 0]
        return FrameData(
            frame=f2.frame, time=f2.time, rootPosition=root_rot, rootRotation=f2.rootRotation,
            joints=rotated_joints, confidence=f2.confidence, tracking_loss=False,
            head=f2.head, fingers=f2.fingers
        )

    if not c1_ok and not c2_ok and c3_ok:
        # Cam 3 alone: rotate raw profile coordinates +90 deg around Y so person faces front
        f3 = fdata3
        rotated_joints = {}
        for k, v in f3.joints.items():
            rotated_joints[k] = [round(v[2], 4), round(v[1], 4), round(-v[0], 4)]
        root_rot = [f3.rootPosition[2], f3.rootPosition[1], -f3.rootPosition[0]] if f3.rootPosition else [0, 0.9, 0]
        return FrameData(
            frame=f3.frame, time=f3.time, rootPosition=root_rot, rootRotation=f3.rootRotation,
            joints=rotated_joints, confidence=f3.confidence, tracking_loss=False,
            head=f3.head, fingers=f3.fingers
        )

    # Base anchor selection: prefer Cam 1 (Frontal), else Cam 2, else Cam 3
    base = fdata1 if c1_ok else (fdata2 if c2_ok else fdata3)
    fused_joints = {k: list(v) for k, v in base.joints.items()}
    fused_conf = dict(base.confidence)

    has_hips = "left_hip" in fused_joints and "right_hip" in fused_joints
    hip_base_z = (fused_joints["left_hip"][2] + fused_joints["right_hip"][2]) * 0.5 if has_hips else 0.0

    has_sh = "left_shoulder" in fused_joints and "right_shoulder" in fused_joints
    sh_mid_y = (fused_joints["left_shoulder"][1] + fused_joints["right_shoulder"][1]) * 0.5 if has_sh else 0.5
    spine_mid_z = (fused_joints["left_shoulder"][2] + fused_joints["right_shoulder"][2]) * 0.5 if has_sh else hip_base_z

    # 1. Cam 2 Fusion (+90 deg Left profile):
    if c2_ok and "left_hip" in fdata2.joints and "right_hip" in fdata2.joints and has_hips:
        s_joints = fdata2.joints
        s_conf = fdata2.confidence
        hip_side_x = (s_joints["left_hip"][0] + s_joints["right_hip"][0]) * 0.5

        left_side_joints = [
            "left_shoulder", "left_elbow", "left_wrist",
            "left_pinky", "left_index", "left_thumb",
            "left_knee", "right_knee", "left_ankle", "right_ankle",
            "left_heel", "right_heel", "left_foot_index", "right_foot_index",
        ]

        for j in left_side_joints:
            if j in s_joints and j in fused_joints:
                c2 = s_conf.get(j, 0.0)
                if c2 > 0.30:
                    dz_side = s_joints[j][0] - hip_side_x
                    target_z = hip_base_z + dz_side

                    # Arm behind head detection: when arm is elevated and behind spine/neck
                    is_elevated_arm = j in ["left_elbow", "left_wrist", "left_index"] and s_joints[j][1] > (sh_mid_y - 0.18)
                    if is_elevated_arm and dz_side < -0.02:
                        behind_z = min(spine_mid_z - 0.05, target_z)
                        fused_joints[j][2] = round(0.85 * behind_z + 0.15 * fused_joints[j][2], 4)
                        fused_conf[j] = round(max(fused_conf.get(j, 0.0), c2, 0.75), 3)
                    else:
                        fused_joints[j][2] = round(0.70 * target_z + 0.30 * fused_joints[j][2], 4)
                        fused_conf[j] = round(max(fused_conf.get(j, 0.0), c2), 3)

                    if fused_conf.get(j, 0.0) < 0.50:
                        fused_joints[j][1] = round(0.4 * fused_joints[j][1] + 0.6 * s_joints[j][1], 4)

    # 2. Cam 3 Fusion (-90 deg Right profile):
    if c3_ok and "left_hip" in fdata3.joints and "right_hip" in fdata3.joints and has_hips:
        r_joints = fdata3.joints
        r_conf = fdata3.confidence
        hip_right_x = (r_joints["left_hip"][0] + r_joints["right_hip"][0]) * 0.5

        right_side_joints = [
            "right_shoulder", "right_elbow", "right_wrist",
            "right_pinky", "right_index", "right_thumb",
            "right_knee", "right_ankle", "right_heel", "right_foot_index",
        ]

        for j in right_side_joints:
            if j in r_joints and j in fused_joints:
                c3 = r_conf.get(j, 0.0)
                if c3 > 0.30:
                    dz_right = -(r_joints[j][0] - hip_right_x)
                    target_z = hip_base_z + dz_right

                    is_elevated_arm = j in ["right_elbow", "right_wrist", "right_index"] and r_joints[j][1] > (sh_mid_y - 0.18)
                    if is_elevated_arm and dz_right < -0.02:
                        behind_z = min(spine_mid_z - 0.05, target_z)
                        fused_joints[j][2] = round(0.85 * behind_z + 0.15 * fused_joints[j][2], 4)
                        fused_conf[j] = round(max(fused_conf.get(j, 0.0), c3, 0.75), 3)
                    else:
                        fused_joints[j][2] = round(0.70 * target_z + 0.30 * fused_joints[j][2], 4)
                        fused_conf[j] = round(max(fused_conf.get(j, 0.0), c3), 3)

                    if fused_conf.get(j, 0.0) < 0.50:
                        fused_joints[j][1] = round(0.4 * fused_joints[j][1] + 0.6 * r_joints[j][1], 4)

    # 3. Single-Camera (Cam 1 Front) Behind-Head Protection:
    if not c2_ok and not c3_ok:
        for arm_prefix in ["left", "right"]:
            wr_name = f"{arm_prefix}_wrist"
            el_name = f"{arm_prefix}_elbow"
            ear_name = f"{arm_prefix}_ear"
            if wr_name in fused_joints and el_name in fused_joints and ear_name in fused_joints:
                wr = fused_joints[wr_name]
                el = fused_joints[el_name]
                ear = fused_joints[ear_name]
                is_arm_up = el[1] > (sh_mid_y - 0.15) or wr[1] > (sh_mid_y - 0.10)
                if is_arm_up and wr[2] < ear[2] - 0.01:
                    fused_joints[wr_name][2] = min(spine_mid_z - 0.04, wr[2])

    # 4. Multi-Camera Hands & Fingers Fusion:
    # Frontal Cam 1 takes top priority. Side cameras Cam 2 and Cam 3 fill in when
    # a hand is occluded or turned away from Cam 1.
    fused_fingers = {
        "left": {"thumb": 0.15, "index": 0.15, "middle": 0.15, "ring": 0.15, "pinky": 0.15, "detected": False},
        "right": {"thumb": 0.15, "index": 0.15, "middle": 0.15, "ring": 0.15, "pinky": 0.15, "detected": False},
    }
    for side in ["left", "right"]:
        if c1_ok and fdata1.fingers and fdata1.fingers.get(side, {}).get("detected"):
            fused_fingers[side] = fdata1.fingers[side]
        elif c2_ok and fdata2.fingers and fdata2.fingers.get(side, {}).get("detected"):
            fused_fingers[side] = fdata2.fingers[side]
        elif c3_ok and fdata3.fingers and fdata3.fingers.get(side, {}).get("detected"):
            fused_fingers[side] = fdata3.fingers[side]
        elif c1_ok and fdata1.fingers and side in fdata1.fingers:
            fused_fingers[side] = fdata1.fingers[side]
        elif base and base.fingers and side in base.fingers:
            fused_fingers[side] = base.fingers[side]

    return FrameData(
        frame=base.frame,
        time=base.time,
        rootPosition=base.rootPosition,
        rootRotation=base.rootRotation,
        joints=fused_joints,
        confidence=fused_conf,
        tracking_loss=False,
        head=base.head,
        fingers=fused_fingers,
    )


# In-memory persistent video tile & landmark caches to prevent flickering
cached_video_tiles: Dict[str, np.ndarray] = {}
cached_fdata_map: Dict[str, Any] = {}

def process_multicam_worker(
    frames_dict: Dict[str, bytes],
    idx: int,
    t_now: float,
    mirror: bool,
    fps_dict: Dict[str, float]
) -> Tuple[Optional[FrameData], Optional[np.ndarray], Dict[str, Any]]:
    global cached_video_tiles, cached_fdata_map

    target_h = 540

    configs = [
        ("cam1", tracker_cam1, tracker_cam1_lock, (16, 185, 129), "КАМЕРА 1 (ФРОНТ)"),
        ("cam2", tracker_cam2, tracker_cam2_lock, (6, 182, 212), "КАМЕРА 2 (СЛЕВА +90)"),
        ("cam3", tracker_cam3, tracker_cam3_lock, (168, 85, 247), "КАМЕРА 3 (СПРАВА -90)"),
    ]

    def _process_single_cam(cfg):
        cid, trk, trk_lock, badge_col, badge_title = cfg
        if cid not in frames_dict:
            return None
        raw_bytes = frames_dict[cid]
        if not raw_bytes:
            return None
        try:
            nparr = np.frombuffer(raw_bytes, np.uint8)
            bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if bgr is not None and bgr.size > 0:
                with trk_lock:
                    proc_bgr, fdata = trk.process_frame(
                        bgr,
                        frame_idx=idx,
                        timestamp=t_now,
                        mirror=(mirror if cid == "cam1" else False),
                        draw_skeleton=True,
                        fps=fps_dict.get(cid, 0.0)
                    )
                return cid, proc_bgr, fdata
        except Exception as e:
            print(f"[!] Error processing camera {cid}: {e}")
        return None

    active_configs = [c for c in configs if c[0] in frames_dict]
    if len(active_configs) > 1:
        futures = [cam_workers_pool.submit(_process_single_cam, c) for c in active_configs]
        for f in concurrent.futures.as_completed(futures):
            res = f.result()
            if res is not None:
                cid, proc_bgr, fdata = res
                cached_fdata_map[cid] = fdata
                cached_video_tiles[cid] = proc_bgr
    elif len(active_configs) == 1:
        res = _process_single_cam(active_configs[0])
        if res is not None:
            cid, proc_bgr, fdata = res
            cached_fdata_map[cid] = fdata
            cached_video_tiles[cid] = proc_bgr

    active_cids = [
        cid for cid, t in camera_last_seen.items()
        if (t_now - t < 5.0) and (cid in cached_video_tiles)
    ]
    if not active_cids and cached_video_tiles:
        active_cids = list(cached_video_tiles.keys())

    active_cids.sort()

    if not active_cids:
        return None, None, {}

    num_cams = len(active_cids)
    tile_w = 960 if num_cams == 1 else (640 if num_cams == 2 else 426)

    proc_tiles = []
    configs_dict = {c[0]: c for c in configs}

    for cid in active_cids:
        raw_tile = cached_video_tiles.get(cid)
        if raw_tile is None:
            continue
        cfg = configs_dict.get(cid)
        badge_col = cfg[3] if cfg else (16, 185, 129)
        badge_title = cfg[4] if cfg else cid.upper()

        h, w = raw_tile.shape[:2]
        scaled = cv2.resize(raw_tile, (int(w * (target_h / h)), target_h))
        if scaled.shape[1] > tile_w:
            cx = (scaled.shape[1] - tile_w) // 2
            scaled = scaled[:, cx:cx + tile_w]
        elif scaled.shape[1] < tile_w:
            pl = (tile_w - scaled.shape[1]) // 2
            pr = tile_w - scaled.shape[1] - pl
            scaled = cv2.copyMakeBorder(scaled, 0, 0, pl, pr, cv2.BORDER_CONSTANT, value=[0, 0, 0])

        if draw_badge_utf8 is not None:
            draw_badge_utf8(scaled, badge_title, top_left=(12, 12), badge_color=badge_col, font_size=13)
        else:
            ascii_title = {"cam1": "CAM 1 (FRONT)", "cam2": "CAM 2 (LEFT +90)", "cam3": "CAM 3 (RIGHT -90)"}.get(cid, cid.upper())
            cv2.rectangle(scaled, (10, 10), (min(scaled.shape[1]-10, 240), 40), (15, 20, 28), -1)
            cv2.rectangle(scaled, (10, 10), (min(scaled.shape[1]-10, 240), 40), badge_col, 2)
            cv2.putText(scaled, ascii_title, (18, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.55, badge_col, 2)
        proc_tiles.append(scaled)

    if not proc_tiles:
        return None, None, {}

    composite_frame = np.hstack(proc_tiles)

    # Fuse multi-camera landmarks
    fused_fdata = fuse_multicam_landmarks(
        cached_fdata_map.get("cam1") if "cam1" in active_cids else None,
        cached_fdata_map.get("cam2") if "cam2" in active_cids else None,
        cached_fdata_map.get("cam3") if "cam3" in active_cids else None
    )

    biomechanics = {}
    if fused_fdata and fused_fdata.joints:
        try:
            biomechanics = analyze_karate_biomechanics(fused_fdata.joints)
        except Exception:
            pass

    return fused_fdata, composite_frame, biomechanics


# Helper to broadcast recording and layer status
async def broadcast_record_status(recording: bool, frames: int = 0, last_info: Optional[Dict[str, Any]] = None):
    msg = json.dumps({
        "type": "record_status",
        "is_recording": recording,
        "mode": recording_mode,
        "layer": active_recording_layer,
        "frames": frames,
        "duration": round(time.time() - recording_start_time, 1) if recording else 0.0,
        "last_recording": last_info,
        "layers_summary": {
            k: bool(v and v.get("frames_count", 0) > 0) for k, v in stored_layers.items()
        }
    })

    async with phone_lock:
        target_phones = list(connected_phones)

    dead_p = []
    for p in target_phones:
        lock = phone_socket_locks.get(p)
        if lock is not None:
            try:
                async with lock:
                    await p.send_text(msg)
            except Exception:
                dead_p.append(p)
        else:
            try:
                await p.send_text(msg)
            except Exception:
                dead_p.append(p)

    if dead_p:
        async with phone_lock:
            for d in dead_p:
                connected_phones.discard(d)
                phone_socket_locks.pop(d, None)

    async with viewer_lock:
        dead_v = []
        for v in list(connected_viewers):
            try:
                await v.send_text(msg)
            except Exception:
                dead_v.append(v)
        for d in dead_v:
            connected_viewers.discard(d)


# ---------------------------------------------------------------------------
# High-Frequency Background Tracking Loop
# ---------------------------------------------------------------------------
async def background_tracking_loop():
    global latest_jpeg_bytes, latest_fused_pose, latest_biomechanics, frame_idx

    while True:
        try:
            await new_incoming_event.wait()
            new_incoming_event.clear()

            async with frame_buffer_lock:
                if not incoming_frame_buffers:
                    continue
                frames_to_process = dict(incoming_frame_buffers)
                incoming_frame_buffers.clear()

            t_now = time.time()
            frame_idx += 1

            loop = asyncio.get_running_loop()
            fused_fdata, composite_frame, biomech = await loop.run_in_executor(
                thread_pool,
                process_multicam_worker,
                frames_to_process,
                frame_idx,
                t_now,
                is_mirror,
                dict(camera_fps)
            )

            if fused_fdata is not None and fused_fdata.joints:
                bones = retargeter.retarget_frame(fused_fdata)
                pose_dict = {
                    "joints": fused_fdata.joints,
                    "confidence": fused_fdata.confidence,
                    "head": fused_fdata.head,
                    "fingers": fused_fdata.fingers,
                    "rootPosition": fused_fdata.rootPosition,
                    "bones": bones,
                }
                latest_fused_pose = pose_dict

                if biomech:
                    latest_biomechanics = biomech

                # RECORDING BUFFER ACCUMULATION: Full or Layered
                with recording_lock:
                    if is_recording:
                        rel_time = round(t_now - recording_start_time, 3)
                        frame_record = {
                            "frame": len(recording_frames) if recording_mode == "full" else len(layer_buffers[active_recording_layer]),
                            "time": rel_time,
                            "rootPosition": fused_fdata.rootPosition,
                            "rootRotation": fused_fdata.rootRotation,
                            "joints": fused_fdata.joints,
                            "confidence": fused_fdata.confidence,
                            "head": fused_fdata.head,
                            "fingers": fused_fdata.fingers,
                        }

                        if recording_mode == "full":
                            recording_frames.append(frame_record)
                            recording_rotations.append(bones)
                        else:
                            # Layered Recording
                            if active_recording_layer in layer_buffers:
                                layer_buffers[active_recording_layer].append(frame_record)
                                layer_rotations_buffer[active_recording_layer].append(bones)

                # Broadcast live pose to 3D avatar WebGL viewers
                if connected_viewers:
                    # In layered mode, if user is recording upper body while lower body already exists,
                    # overlay the previously recorded lower body bones!
                    display_pose = dict(pose_dict)
                    if is_recording and recording_mode == "layered" and active_recording_layer == "upper":
                        lower_data = stored_layers.get("lower")
                        if lower_data and lower_data.get("rotations"):
                            idx_l = int((rel_time * lower_data.get("fps", 30)) % len(lower_data["rotations"]))
                            merged_bones = dict(bones)
                            for lb_name in ["Root", "Hips", "UpperLeg.L", "UpperLeg.R", "LowerLeg.L", "LowerLeg.R", "Foot.L", "Foot.R"]:
                                if lb_name in lower_data["rotations"][idx_l]:
                                    merged_bones[lb_name] = lower_data["rotations"][idx_l][lb_name]
                            display_pose["bones"] = merged_bones

                    json_msg = json.dumps(display_pose)
                    dead = []
                    async with viewer_lock:
                        for v in list(connected_viewers):
                            try:
                                await v.send_text(json_msg)
                            except Exception:
                                dead.append(v)
                        for d in dead:
                            connected_viewers.discard(d)

            if composite_frame is not None:
                _, buf = cv2.imencode(".jpg", composite_frame, [cv2.IMWRITE_JPEG_QUALITY, 65])
                latest_jpeg_bytes = buf.tobytes()

        except Exception as e:
            print(f"[!] Error in background_tracking_loop: {e}")
            await asyncio.sleep(0.01)


@app.on_event("startup")
async def startup_event():
    global tracking_loop_started
    if not tracking_loop_started:
        tracking_loop_started = True
        asyncio.create_task(background_tracking_loop())


# ---------------------------------------------------------------------------
# Studio Ready-Made Lucide Vector Icons
# ---------------------------------------------------------------------------
ICON_PHONE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>'
ICON_TARGET_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>'
ICON_TPOSE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/></svg>'
ICON_SWORDS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="m13 19 6-6"/><path d="M14.5 17.5 3.586 6.586A2 2 0 0 1 3 5.172V3h2.172a2 2 0 0 1 1.414.586L17.5 14.5"/><path d="m14.828 6.172 2.586-2.586A2 2 0 0 1 18.828 3H21v2.172a2 2 0 0 1-.586 1.414l-2.586 2.586"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="m5 14 4 4"/><path d="m5 21-2-2"/><path d="M7.5 16.5 4 20"/></svg>'
ICON_VIDEO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>'
ICON_CUBE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>'
ICON_MODAL_QR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>'
ICON_RECORD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="flex-shrink:0;"><circle cx="12" cy="12" r="8"/></svg>'
ICON_FOLDER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>'
ICON_LAYERS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>'
ICON_SPARKLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>'

# ---------------------------------------------------------------------------
# HTML Studio Dashboard with Redesigned QR Modal & Full/Layered Mode
# ---------------------------------------------------------------------------
def build_studio_html(host_ip: str, embedded: bool = False) -> str:
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Karate Motion Studio — Мульти-Камерный AI Мокап</title>
  <style>
    :root {{
      --bg: #0b0c10;
      --card-bg: #14161f;
      --panel-border: #222634;
      --accent: #e05260;
      --accent-glow: rgba(224, 82, 96, 0.35);
      --green: #10b981;
      --green-glow: rgba(16, 185, 129, 0.35);
      --cyan: #06b6d4;
      --cyan-glow: rgba(6, 182, 212, 0.35);
      --purple: #a855f7;
      --purple-glow: rgba(168, 85, 247, 0.35);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --danger: #ef4444;
      --danger-glow: rgba(239, 68, 68, 0.5);
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }}

    body.embedded header {{ display: none !important; }}
    body.embedded #layered-bar {{ display: none !important; }}
    body.embedded .studio-grid {{ height: calc(100vh - 36px); }}

    header {{
      background: #12141c;
      border-bottom: 1px solid var(--panel-border);
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10;
      flex-wrap: wrap;
      gap: 8px;
    }}
    .brand {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    .brand-icon {{ font-size: 22px; }}
    .brand-title {{
      font-size: 14.5px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: 0.4px;
    }}
    .brand-sub {{
      font-size: 11px;
      color: var(--text-muted);
    }}

    .cam-pills {{
      display: flex;
      gap: 6px;
      align-items: center;
    }}
    .pill {{
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 16px;
      background: #1a1e29;
      border: 1px solid #374151;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.2s;
    }}
    .pill.c1.live {{ background: rgba(16, 185, 129, 0.2); border-color: var(--green); color: var(--green); box-shadow: 0 0 10px var(--green-glow); }}
    .pill.c2.live {{ background: rgba(6, 182, 212, 0.2); border-color: var(--cyan); color: var(--cyan); box-shadow: 0 0 10px var(--cyan-glow); }}
    .pill.c3.live {{ background: rgba(168, 85, 247, 0.2); border-color: var(--purple); color: var(--purple); box-shadow: 0 0 10px var(--purple-glow); }}

    .dot {{ width: 7px; height: 7px; border-radius: 50%; background: #64748b; }}
    .pill.live .dot {{ background: currentColor; box-shadow: 0 0 6px currentColor; }}

    .top-controls {{
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }}
    .btn {{
      background: #202432;
      border: 1px solid var(--panel-border);
      color: #e5e7eb;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }}
    .btn:hover {{ background: #2b3144; border-color: #4b5563; }}
    .btn.active {{
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
      box-shadow: 0 0 12px var(--accent-glow);
    }}
    .btn-green {{
      background: linear-gradient(135deg, #059669, #10b981);
      color: #fff;
      border: none;
      box-shadow: 0 0 12px var(--green-glow);
    }}
    .btn-green:hover {{ filter: brightness(1.1); }}

    /* Mode Switcher Segment */
    .mode-switch-deck {{
      display: flex;
      background: #090a0f;
      padding: 3px;
      border-radius: 8px;
      border: 1px solid #282f42;
      gap: 4px;
    }}
    .mode-btn {{
      padding: 5px 12px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: #94a3b8;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s;
    }}
    .mode-btn.active {{
      background: #2563eb;
      color: #ffffff;
      box-shadow: 0 0 10px rgba(37, 99, 235, 0.4);
    }}

    .btn-rec {{
      background: linear-gradient(135deg, #ef4444, #b91c1c);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      font-weight: 800;
      box-shadow: 0 0 14px var(--danger-glow);
      padding: 6px 14px;
    }}
    .btn-rec.recording {{
      background: #11141d;
      border: 1px solid var(--danger);
      color: var(--danger);
      animation: pulseRec 1.2s infinite;
    }}
    @keyframes pulseRec {{
      0%, 100% {{ box-shadow: 0 0 14px rgba(239, 68, 68, 0.7); transform: scale(1); }}
      50% {{ box-shadow: 0 0 4px rgba(239, 68, 68, 0.3); transform: scale(0.985); }}
    }}

    /* Layer Bar (Visible when in Layered Mode) */
    .layered-bar {{
      background: #161824;
      border-bottom: 1px solid #282f42;
      padding: 6px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }}
    .layer-selector {{
      display: flex;
      gap: 6px;
      align-items: center;
    }}
    .layer-pill-btn {{
      background: #0f121a;
      border: 1px solid #2a334a;
      color: #cbd5e1;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }}
    .layer-pill-btn.active {{
      background: #3b82f6;
      color: #ffffff;
      border-color: #60a5fa;
    }}
    .layer-pill-btn.recorded {{
      border-color: var(--green);
      color: #a7f3d0;
    }}

    .studio-grid {{
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 8px;
      overflow: hidden;
      background: #0b0c10;
    }}

    @media (max-width: 960px) {{
      .studio-grid {{
        grid-template-columns: 1fr;
        grid-template-rows: 1fr 1fr;
      }}
    }}

    .panel-box {{
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
    }}
    .panel-header {{
      background: rgba(20, 22, 31, 0.95);
      padding: 7px 12px;
      border-bottom: 1px solid var(--panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      font-weight: 700;
      color: #d1d5db;
    }}
    .panel-content {{
      flex: 1;
      position: relative;
      background: #000;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
    }}

    #video-feed {{
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }}

    #viewer-frame {{
      width: 100%;
      height: 100%;
      border: none;
      background: #141518;
    }}

    footer {{
      background: #12141c;
      border-top: 1px solid var(--panel-border);
      padding: 6px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      flex-wrap: wrap;
      gap: 8px;
    }}
    .telem-group {{
      display: flex;
      gap: 12px;
      align-items: center;
      font-family: monospace;
    }}
    .telem-val {{ color: var(--green); font-weight: bold; }}

    /* Modern Cyber-Dojo QR Modal */
    .modal-overlay {{
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.88);
      backdrop-filter: blur(10px);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }}
    .modal-overlay.open {{ display: flex; }}
    .modal-card {{
      background: #151824;
      border: 1px solid #2d364d;
      border-radius: 16px;
      padding: 22px;
      max-width: 520px;
      width: 92%;
      text-align: center;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.95);
    }}

    /* Interactive T-Scheme Diagram */
    .t-scheme {{
      background: #0b0d14;
      border: 1px solid #22293c;
      border-radius: 12px;
      padding: 12px;
      margin: 12px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }}
    .t-node {{
      background: #1b2030;
      border: 1px solid #374151;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }}
    .t-node.c1.active {{
      background: rgba(16, 185, 129, 0.25);
      border-color: var(--green);
      color: var(--green);
      box-shadow: 0 0 12px var(--green-glow);
    }}
    .t-node.c2.active {{
      background: rgba(6, 182, 212, 0.25);
      border-color: var(--cyan);
      color: var(--cyan);
      box-shadow: 0 0 12px var(--cyan-glow);
    }}
    .t-node.c3.active {{
      background: rgba(168, 85, 247, 0.25);
      border-color: var(--purple);
      color: var(--purple);
      box-shadow: 0 0 12px var(--purple-glow);
    }}

    .t-middle-row {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 440px;
      gap: 8px;
    }}
    .t-person-box {{
      background: #10131d;
      border: 1px dashed #d4af37;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11px;
      color: #fbbf24;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 5px;
    }}

    .qr-frame {{
      width: 175px;
      height: 175px;
      border-radius: 12px;
      margin: 10px auto;
      background: #ffffff;
      padding: 6px;
      display: block;
      border: 3px solid var(--green);
      box-shadow: 0 0 18px var(--green-glow);
      transition: all 0.3s ease;
    }}
    .qr-frame.c2 {{ border-color: var(--cyan); box-shadow: 0 0 18px var(--cyan-glow); }}
    .qr-frame.c3 {{ border-color: var(--purple); box-shadow: 0 0 18px var(--purple-glow); }}

    .toast {{
      position: fixed;
      bottom: 40px;
      right: 20px;
      background: #10b981;
      color: #000;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
      display: none;
      z-index: 2000;
      animation: fadeIn 0.3s;
    }}
    .toast.show {{ display: block; }}
    @keyframes fadeIn {{ from {{ opacity: 0; transform: translateY(10px); }} to {{ opacity: 1; transform: translateY(0); }} }}
  </style>
</head>
<body class="{'embedded' if embedded else ''}">
  <header>
    <div class="brand">
      <span class="brand-icon">{ICON_SWORDS_SVG}</span>
      <div>
        <div class="brand-title">KARATE MOTION STUDIO</div>
        <div class="brand-sub">Мульти-Камерный AI Мокап · T-Схема (до 3 Камер)</div>
      </div>
    </div>

    <!-- Active Camera Status Indicators -->
    <div class="cam-pills">
      <div id="pill-cam1" class="pill c1">
        <span class="dot"></span>
        <span>Cam 1 (Фронт 0°)</span>
      </div>
      <div id="pill-cam2" class="pill c2">
        <span class="dot"></span>
        <span>Cam 2 (Слева +90°)</span>
      </div>
      <div id="pill-cam3" class="pill c3">
        <span class="dot"></span>
        <span>Cam 3 (Справа -90°)</span>
      </div>
    </div>

    <div class="top-controls">
      <!-- Recording Mode Switcher: Full vs Layered -->
      <div class="mode-switch-deck">
        <button class="mode-btn active" id="btn-mode-full" onclick="switchRecordingMode('full')">
          {ICON_RECORD_SVG} <span>Полная</span>
        </button>
        <button class="mode-btn" id="btn-mode-layered" onclick="switchRecordingMode('layered')">
          {ICON_LAYERS_SVG} <span>По слоям</span>
        </button>
      </div>

      <!-- Main Action Button -->
      <button class="btn btn-rec" id="btn-record" onclick="toggleRecording()" title="Начать / остановить запись">
        <span id="rec-icon">{ICON_RECORD_SVG}</span>
        <span id="rec-text">НАЧАТЬ ЗАПИСЬ (REC)</span>
      </button>

      <button class="btn" onclick="openRecordingsModal()" title="Список записанных файлов MoCap">
        {ICON_FOLDER_SVG} <span>Записи</span>
      </button>

      <div style="border-left: 1px solid #374151; height: 18px; margin: 0 2px;"></div>

      <button class="btn btn-green" onclick="openQrModal()" title="Подключить смартфоны через QR-код">
        {ICON_PHONE_SVG} <span>Подключить Камеры (QR)</span>
      </button>

      <button class="btn" id="btn-mirror" onclick="toggleMirror()" title="Режим отзеркаливания">
        {ICON_TARGET_SVG} <span id="mirror-text">Прямой</span>
      </button>

      <button class="btn" onclick="sendViewerCommand('resetPose')">T-Pose</button>
      <button class="btn active" id="btn-cam-34" onclick="sendViewerCommand('setCamera', '34')">3/4</button>
      <button class="btn" onclick="sendViewerCommand('setCamera', 'front')">Спереди</button>
      <button class="btn" onclick="sendViewerCommand('setCamera', 'side')">Сбоку</button>
    </div>
  </header>

  <!-- Layered Recording Toolbar (Visible in Layered Mode) -->
  <div id="layered-bar" class="layered-bar" style="display: none;">
    <div class="layer-selector">
      <span style="font-size: 11.5px; color: #94a3b8; font-weight: 700; margin-right: 4px;">Слой для записи:</span>
      <button class="layer-pill-btn active" id="lbtn-lower" onclick="selectLayer('lower')">
        <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 4px;"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.6-2 8.5V16a2 2 0 0 1-2 2 2 2 0 0 1-2-2Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.6 2 8.5V20a2 2 0 0 0 2 2 2 2 0 0 0 2-2Z"/></svg>Слой 1: Ноги и стойки</span>
        <span id="lstatus-lower" style="font-size: 9px; opacity: 0.7;">○ Не записан</span>
      </button>
      <button class="layer-pill-btn" id="lbtn-upper" onclick="selectLayer('upper')">
        <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 4px;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Слой 2: Корпус, руки и голова</span>
        <span id="lstatus-upper" style="font-size: 9px; opacity: 0.7;">○ Не записан</span>
      </button>
      <button class="layer-pill-btn" id="lbtn-head" onclick="selectLayer('fingers')">
        <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 4px;"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>Слой 3: Кисти и пальцы</span>
        <span id="lstatus-head" style="font-size: 9px; opacity: 0.7;">○ Не записан</span>
      </button>
    </div>

    <div style="display: flex; gap: 8px; align-items: center;">
      <button class="btn" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); border: none; color: #fff; font-weight: 700;" onclick="mergeRecordedLayers()">
        {ICON_SPARKLE_SVG} <span>Объединить слои в Ката</span>
      </button>
      <button class="btn" style="background: transparent; color: #9ca3af;" onclick="clearRecordedLayers()">
        <span>Сброс слоев</span>
      </button>
    </div>
  </div>

  <div class="studio-grid">
    <!-- LEFT PANEL: Multi-Camera Live Composite Video Feed -->
    <div class="panel-box">
      <div class="panel-header">
        <span style="display: inline-flex; align-items: center; gap: 6px;">{ICON_VIDEO_SVG} <span>Видеопоток (OpenCV Скелет)</span></span>
        <span id="active-cams-count" style="color: #10b981; font-family: monospace;">0 Камер</span>
      </div>
      <div class="panel-content">
        <img id="video-feed" src="/video_feed" alt="Ожидание подключения камер..." />
      </div>
    </div>

    <!-- RIGHT PANEL: Single 3D Master Avatar Model -->
    <div class="panel-box">
      <div class="panel-header">
        <span style="display: inline-flex; align-items: center; gap: 6px;">{ICON_CUBE_SVG} <span>3D Аватар Мастера (Живой Fused Rig)</span></span>
        <span style="color: #10b981; font-size: 11px; font-weight: 700;">● Живой отклик активен</span>
      </div>
      <div class="panel-content" style="position: relative;">
        <iframe id="viewer-frame" src="/viewer"></iframe>
      </div>
    </div>
  </div>

  <footer>
    <div class="telem-group">
      <span>Стойка: <span id="telem-stance" class="telem-val">Йой-дати (Готовность)</span></span>
      <span>•</span>
      <span>Колено Л: <span id="telem-kl" class="telem-val">175°</span> | П: <span id="telem-kr" class="telem-val">175°</span></span>
      <span>•</span>
      <span>Локоть Л: <span id="telem-el" class="telem-val">90°</span> | П: <span id="telem-er" class="telem-val">90°</span></span>
    </div>

    <div class="telem-group">
      <span id="record-status-telem" style="color:#9ca3af;">Запись: не активна</span>
      <span>•</span>
      <span>Точность: <span id="telem-score" class="telem-val">95%</span></span>
      <span>•</span>
      <span>Хост: <span class="telem-val">{host_ip}</span></span>
    </div>
  </footer>

  <!-- Redesigned Cyber-Dojo QR Modal with Interactive T-Scheme -->
  <div id="qr-modal" class="modal-overlay" onclick="closeQrModal(event)">
    <div class="modal-card" onclick="event.stopPropagation()">
      <h3 style="color: #fff; font-size: 16.5px; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; gap: 8px;">
        {ICON_MODAL_QR_SVG} <span>Подключение Смартфонов (T-Схема)</span>
      </h3>
      <p style="color: #94a3b8; font-size: 12px;">Выберите камеру на схеме и отсканируйте код камерой телефона:</p>

      <!-- Interactive T-Scheme Diagram -->
      <div class="t-scheme">
        <div class="t-node c1 active" id="t-node-c1" onclick="switchQrTab('cam1')">
          <span>📱</span> <span>Камера 1 (Фронт 0°)</span>
        </div>
        <div class="t-middle-row">
          <div class="t-node c2" id="t-node-c2" onclick="switchQrTab('cam2')">
            <span>📱</span> <span>Камера 2 (Слева +90°)</span>
          </div>
          <div class="t-person-box">
            <span>🥋</span> <span>ВЫ</span>
          </div>
          <div class="t-node c3" id="t-node-c3" onclick="switchQrTab('cam3')">
            <span>Камера 3 (Справа -90°)</span> <span>📱</span>
          </div>
        </div>
      </div>

      <img id="modal-qr-img" src="/qr/cam1.png" alt="QR Код" class="qr-frame" />

      <div style="font-size: 12px; font-family: monospace; color: #10b981; margin: 8px 0; padding: 7px 12px; background: #0c0e15; border-radius: 8px; border: 1px solid #232a3b; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <span id="modal-phone-url" style="color: #6ee7b7; word-break: break-all; text-align: left;">
          https://{host_ip}:{HTTPS_PORT}/cam1
        </span>
        <button class="btn" style="padding: 3px 8px; font-size: 10.5px; white-space: nowrap;" onclick="copyQrLink()">
          Копировать
        </button>
      </div>

      <p id="modal-cam-desc" style="font-size: 11.5px; color: #94a3b8; margin-bottom: 12px; line-height: 1.45;">
        Камера 1 (Фронт 0°): Установите прямо перед собой на уровне пояса/груди (2-3 метра). Захватывает лицо, плечи, руки и прямые удары.
      </p>

      <button class="btn" style="width: 100%; justify-content: center; padding: 8px;" onclick="closeQrModal()">
        Закрыть
      </button>
    </div>
  </div>

  <!-- Recordings Modal -->
  <div id="rec-modal" class="modal-overlay" onclick="closeRecordingsModal(event)">
    <div class="modal-card" style="max-width: 540px; text-align: left;" onclick="event.stopPropagation()">
      <h3 style="color: #fff; font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        {ICON_FOLDER_SVG} <span>Сохраненные файлы анимаций (MoCap JSON)</span>
      </h3>
      <div id="rec-list-container" style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;">
        <div style="color: #9ca3af; font-size: 12px;">Загрузка списка записей...</div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn" onclick="closeRecordingsModal()">Закрыть</button>
      </div>
    </div>
  </div>

  <div id="toast-msg" class="toast">Файл успешно сохранен!</div>

  <script>
    let isMirrored = false;
    let currentQrCam = 'cam1';
    let isRecActive = false;
    let recTimer = null;
    let recStartMs = 0;
    let recMode = 'full';
    let activeLayer = 'lower';
    const hostIp = '{host_ip}';
    const httpsPort = '{HTTPS_PORT}';

    function showToast(text) {{
      const t = document.getElementById('toast-msg');
      t.innerText = text;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 4000);
    }}

    function switchRecordingMode(mode) {{
      recMode = mode;
      document.getElementById('btn-mode-full').classList.toggle('active', mode === 'full');
      document.getElementById('btn-mode-layered').classList.toggle('active', mode === 'layered');
      document.getElementById('layered-bar').style.display = mode === 'layered' ? 'flex' : 'none';
      fetch('/api/record/mode?mode=' + mode, {{ method: 'POST' }}).catch(() => {{}});
    }}

    function selectLayer(layer) {{
      activeLayer = layer;
      document.getElementById('lbtn-lower').classList.toggle('active', layer === 'lower');
      document.getElementById('lbtn-upper').classList.toggle('active', layer === 'upper');
      document.getElementById('lbtn-head').classList.toggle('active', layer === 'fingers' || layer === 'head_fingers');
      fetch('/api/record/layer/select?layer=' + layer, {{ method: 'POST' }}).catch(() => {{}});
    }}

    function openQrModal() {{ document.getElementById('qr-modal').classList.add('open'); }}
    function closeQrModal(e) {{
      if (!e || e.target.id === 'qr-modal') {{
        document.getElementById('qr-modal').classList.remove('open');
      }}
    }}

    function switchQrTab(camId) {{
      currentQrCam = camId;
      document.getElementById('t-node-c1').classList.toggle('active', camId === 'cam1');
      document.getElementById('t-node-c2').classList.toggle('active', camId === 'cam2');
      document.getElementById('t-node-c3').classList.toggle('active', camId === 'cam3');

      const qrImg = document.getElementById('modal-qr-img');
      const urlSpan = document.getElementById('modal-phone-url');
      const desc = document.getElementById('modal-cam-desc');

      qrImg.src = '/qr/' + camId + '.png?t=' + Date.now();
      qrImg.className = 'qr-frame ' + (camId === 'cam2' ? 'c2' : (camId === 'cam3' ? 'c3' : ''));
      const targetUrl = 'https://' + hostIp + ':' + httpsPort + '/' + camId;
      urlSpan.innerText = targetUrl;

      if (camId === 'cam1') {{
        desc.innerText = 'Камера 1 (Фронт 0°): Установите прямо перед собой на уровне пояса/груди (2-3 метра). Захватывает лицо, плечи, руки и стойку.';
      }} else if (camId === 'cam2') {{
        desc.innerText = 'Камера 2 (Слева +90°): Левый боковой профиль. Захватывает физическую глубину Z стоек, левую руку и движение за голову.';
      }} else {{
        desc.innerText = 'Камера 3 (Справа -90°): Правый боковой профиль. Захватывает глубину Z правого кулака в хикитэ, правую ногу и движение за голову.';
      }}
    }}

    function copyQrLink() {{
      const text = document.getElementById('modal-phone-url').innerText;
      if (navigator.clipboard) {{
        navigator.clipboard.writeText(text);
        showToast('Ссылка скопирована в буфер обмена!');
      }}
    }}

    function openRecordingsModal() {{
      document.getElementById('rec-modal').classList.add('open');
      loadRecordingsList();
    }}
    function closeRecordingsModal(e) {{
      if (!e || e.target.id === 'rec-modal') {{
        document.getElementById('rec-modal').classList.remove('open');
      }}
    }}

    async function loadRecordingsList() {{
      const c = document.getElementById('rec-list-container');
      try {{
        const res = await fetch('/api/record/list');
        if (res.ok) {{
          const data = await res.json();
          const items = data.recordings || [];
          if (items.length === 0) {{
            c.innerHTML = '<div style="color:#9ca3af; font-size:12px; padding:12px 0;">Пока нет сохраненных записей.</div>';
            return;
          }}
          c.innerHTML = items.map(function(it) {{
            const durStr = it.duration ? it.duration + ' сек' : '';
            const sizeStr = it.size_kb ? it.size_kb + ' КБ' : '';
            return '<div style="background:#0f121a; border:1px solid #282f42; border-radius:6px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">' +
              '<div>' +
                '<div style="color:#f3f4f6; font-size:12.5px; font-weight:700;">' + it.filename + '</div>' +
                '<div style="color:#9ca3af; font-size:11px;">Кадров: ' + (it.frames || '—') + ' | ' + durStr + ' | ' + sizeStr + '</div>' +
              '</div>' +
              '<a href="/uploads/recordings/' + it.filename + '" download style="background:#10b981; color:#000; font-weight:700; font-size:11px; padding:5px 10px; border-radius:4px; text-decoration:none;">Скачать</a>' +
            '</div>';
          }}).join('');
        }}
      }} catch (e) {{
        c.innerHTML = '<div style="color:#ef4444; font-size:12px;">Ошибка загрузки записей</div>';
      }}
    }}

    function updateRecUI(active, durationSec) {{
      durationSec = durationSec || 0;
      isRecActive = active;
      const btn = document.getElementById('btn-record');
      const txt = document.getElementById('rec-text');
      const telem = document.getElementById('record-status-telem');

      if (active) {{
        btn.classList.add('recording');
        const m = Math.floor(durationSec / 60);
        const s = Math.floor(durationSec % 60);
        const timeStr = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
        txt.innerText = 'ОСТАНОВИТЬ (' + timeStr + ')';
        telem.innerHTML = '<span style="color:#ef4444; font-weight:bold;">● ИДЕТ ЗАПИСЬ (' + (recMode === 'layered' ? 'Слой: ' + activeLayer : 'Полная') + ' ' + timeStr + ')</span>';
      }} else {{
        btn.classList.remove('recording');
        txt.innerText = recMode === 'layered' ? 'ЗАПИСАТЬ СЛОЙ (REC)' : 'НАЧАТЬ ЗАПИСЬ (REC)';
        telem.innerText = 'Запись: не активна';
      }}
    }}

    async function toggleRecording() {{
      if (!isRecActive) {{
        const url = recMode === 'layered' ? ('/api/record/layer/start?layer=' + activeLayer) : '/api/record/start';
        try {{
          const res = await fetch(url, {{ method: 'POST' }});
          if (res.ok) {{
            isRecActive = true;
            recStartMs = Date.now();
            updateRecUI(true, 0);
            if (!recTimer) {{
              recTimer = setInterval(() => {{
                const elapsed = (Date.now() - recStartMs) / 1000;
                updateRecUI(true, elapsed);
              }}, 500);
            }}
          }}
        }} catch (e) {{}}
      }} else {{
        const url = recMode === 'layered' ? '/api/record/layer/stop' : '/api/record/stop';
        try {{
          const res = await fetch(url, {{ method: 'POST' }});
          if (res.ok) {{
            const data = await res.json();
            clearInterval(recTimer);
            recTimer = null;
            updateRecUI(false, 0);
            if (recMode === 'layered') {{
              showToast('Слой ' + activeLayer + ' успешно сохранен (' + (data.frames || 0) + ' кадров)!');
              updateLayersStatusUI();
            }} else {{
              showToast('Файл ' + (data.filename || 'mocap_recording.json') + ' сохранен (' + (data.frames || 0) + ' кадров)!');
            }}
          }}
        }} catch (e) {{
          clearInterval(recTimer);
          recTimer = null;
          updateRecUI(false, 0);
        }}
      }}
    }}

    async function mergeRecordedLayers() {{
      try {{
        const res = await fetch('/api/record/layer/merge', {{ method: 'POST' }});
        if (res.ok) {{
          const data = await res.json();
          showToast('Анимация объединена и сохранена: ' + (data.filename || 'mocap_recording_layered.json'));
          updateLayersStatusUI();
        }}
      }} catch (e) {{}}
    }}

    async function clearRecordedLayers() {{
      try {{
        await fetch('/api/record/layer/clear', {{ method: 'POST' }});
        showToast('Слои сброшены');
        updateLayersStatusUI();
      }} catch (e) {{}}
    }}

    async function updateLayersStatusUI() {{
      try {{
        const res = await fetch('/api/record/layer/status');
        if (res.ok) {{
          const data = await res.json();
          const layers = data.layers || {{}};
          const stLower = document.getElementById('lstatus-lower');
          const stUpper = document.getElementById('lstatus-upper');
          const stHead = document.getElementById('lstatus-head');

          const lBtn = document.getElementById('lbtn-lower');
          const uBtn = document.getElementById('lbtn-upper');
          const hBtn = document.getElementById('lbtn-head');

          if (layers.lower) {{
            stLower.innerText = '● Записан: ' + layers.lower.frames_count + ' к';
            lBtn.classList.add('recorded');
          }} else {{
            stLower.innerText = '○ Не записан';
            lBtn.classList.remove('recorded');
          }}

          if (layers.upper) {{
            stUpper.innerText = '● Записан: ' + layers.upper.frames_count + ' к';
            uBtn.classList.add('recorded');
          }} else {{
            stUpper.innerText = '○ Не записан';
            uBtn.classList.remove('recorded');
          }}

          const fg = layers.fingers || layers.head_fingers;
          if (fg) {{
            stHead.innerText = '● Записан: ' + fg.frames_count + ' к';
            hBtn.classList.add('recorded');
          }} else {{
            stHead.innerText = '○ Не записан';
            hBtn.classList.remove('recorded');
          }}
        }}
      }} catch (e) {{}}
    }}

    function toggleMirror() {{
      isMirrored = !isMirrored;
      document.getElementById('mirror-text').innerText = isMirrored ? 'Зеркальный' : 'Прямой';
      document.getElementById('btn-mirror').classList.toggle('active', isMirrored);
      sendViewerCommand('setMirrorAvatar', isMirrored);
      fetch('/controls/mirror?enabled=' + isMirrored, {{ method: 'POST' }}).catch(() => {{}});
    }}

    function sendViewerCommand(type, val) {{
      const frame = document.getElementById('viewer-frame');
      if (frame && frame.contentWindow) {{
        if (type === 'setCamera') {{
          frame.contentWindow.postMessage({{ type: 'setCamera', preset: val }}, '*');
        }} else if (type === 'resetPose') {{
          frame.contentWindow.postMessage({{ type: 'resetPose' }}, '*');
        }} else if (type === 'setMirrorAvatar') {{
          frame.contentWindow.postMessage({{ type: 'setMirrorAvatar', mirror: val }}, '*');
        }}
      }}
    }}

    setInterval(async () => {{
      try {{
        const res = await fetch('/status');
        if (res.ok) {{
          const st = await res.json();
          const p1 = document.getElementById('pill-cam1');
          const p2 = document.getElementById('pill-cam2');
          const p3 = document.getElementById('pill-cam3');
          const countTag = document.getElementById('active-cams-count');

          const active = st.active_cameras || [];
          p1.classList.toggle('live', active.includes('cam1'));
          p2.classList.toggle('live', active.includes('cam2'));
          p3.classList.toggle('live', active.includes('cam3'));

          countTag.innerText = active.length + ' Камер(ы) активны';

          const telemStance = document.getElementById('telem-stance');
          const telemScore = document.getElementById('telem-score');
          const telemKl = document.getElementById('telem-kl');
          const telemKr = document.getElementById('telem-kr');
          const telemEl = document.getElementById('telem-el');
          const telemEr = document.getElementById('telem-er');

          if (st.biomechanics) {{
            telemStance.innerText = st.biomechanics.stance || 'Йой-дати';
            telemScore.innerText = (st.biomechanics.score || 90) + '%';
            telemKl.innerText = (st.biomechanics.knee_l || 175) + '°';
            telemKr.innerText = (st.biomechanics.knee_r || 175) + '°';
            telemEl.innerText = (st.biomechanics.elbow_l || 90) + '°';
            telemEr.innerText = (st.biomechanics.elbow_r || 90) + '°';
          }}

          if (typeof st.is_recording === 'boolean' && st.is_recording !== isRecActive) {{
            if (st.is_recording) {{
              recStartMs = Date.now() - (st.recording_duration || 0) * 1000;
              updateRecUI(true, st.recording_duration || 0);
              if (!recTimer) {{
                recTimer = setInterval(() => {{
                  const elapsed = (Date.now() - recStartMs) / 1000;
                  updateRecUI(true, elapsed);
                }}, 500);
              }}
            }} else {{
              clearInterval(recTimer);
              recTimer = null;
              updateRecUI(false, 0);
            }}
          }}
        }}
      }} catch (e) {{}}
    }}, 400);

    const feedImg = document.getElementById('video-feed');
    if (feedImg) {{
      feedImg.onerror = () => {{
        setTimeout(() => {{
          feedImg.src = '/video_feed?t=' + Date.now();
        }}, 1000);
      }};
    }}
  </script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
@app.get("/studio", response_class=HTMLResponse)
async def get_studio(request: Request):
    client_host = request.headers.get("host", "").split(":")[0]
    if not client_host or client_host in ["localhost", "127.0.0.1"] or client_host.startswith("172."):
        client_host = get_current_host_ip()
    embedded = request.query_params.get("embedded") in ["1", "true"]
    return HTMLResponse(content=build_studio_html(client_host, embedded=embedded), status_code=200)


@app.get("/viewer", response_class=HTMLResponse)
async def get_viewer():
    template_path = ASSETS_DIR / "viewer_template.html"
    if template_path.exists():
        content = template_path.read_text(encoding="utf-8")
        return HTMLResponse(content=content, status_code=200)
    return HTMLResponse(content="<h1>Viewer Template Not Found</h1>", status_code=404)


@app.get("/cam1", response_class=HTMLResponse)
@app.get("/cam2", response_class=HTMLResponse)
@app.get("/cam3", response_class=HTMLResponse)
async def get_cam_mobile():
    return HTMLResponse(content=MOBILE_CLIENT_HTML, status_code=200)


@app.get("/qr/{cam_id}.png")
@app.get("/qr/cam1.png")
@app.get("/qr/cam2.png")
@app.get("/qr/cam3.png")
@app.get("/qr.png")
async def get_qr_image(request: Request, cam_id: Optional[str] = None):
    path_lower = request.url.path.lower()
    query_cam = request.query_params.get("cam") or request.query_params.get("camera")
    if query_cam:
        effective_cam = query_cam.lower()
    elif "cam3" in path_lower:
        effective_cam = "cam3"
    elif "cam2" in path_lower:
        effective_cam = "cam2"
    elif "cam1" in path_lower:
        effective_cam = "cam1"
    elif cam_id and cam_id in ["cam1", "cam2", "cam3"]:
        effective_cam = cam_id
    else:
        effective_cam = "cam1"

    current_ip = request.query_params.get("ip") or get_current_host_ip()
    port = request.query_params.get("port") or str(HTTPS_PORT)
    mode = request.query_params.get("mode")

    tunnel_url = None
    try:
        t_file = Path("/app/uploads/tunnel-info.json")
        if not t_file.exists():
            t_file = PROJECT_ROOT.parent / "uploads" / "tunnel-info.json"
        if not t_file.exists():
            t_file = PROJECT_ROOT / "uploads" / "tunnel-info.json"
        if t_file.exists():
            td = json.loads(t_file.read_text(encoding="utf-8"))
            if td.get("tunnelActive") and td.get("publicUrl"):
                tunnel_url = td.get("publicUrl")
    except Exception:
        pass

    if mode == "tunnel" and tunnel_url:
        url = f"{tunnel_url}/{effective_cam}"
    elif port in ["8000", "5173"]:
        url = f"http://{current_ip}:{port}/{effective_cam}"
    else:
        url = f"https://{current_ip}:{port}/{effective_cam}"

    png_bytes = generate_qr_png_bytes(url)
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
    )


@app.get("/status")
@app.get("/studio/status")
@app.get("/api/status")
async def get_status():
    t_now = time.time()
    active_cams = [cid for cid, t in camera_last_seen.items() if t_now - t < 2.5]
    return {
        "server": "Karate Motion Studio High-Performance Multi-Cam",
        "ip": get_current_host_ip(),
        "http_port": HTTP_PORT,
        "https_port": HTTPS_PORT,
        "active_cameras": active_cams,
        "camera_fps": {k: round(v, 1) for k, v in camera_fps.items()},
        "biomechanics": latest_biomechanics,
        "connected_viewers": len(connected_viewers),
        "is_recording": is_recording,
        "recording_mode": recording_mode,
        "active_layer": active_recording_layer,
        "recording_duration": round(time.time() - recording_start_time, 1) if is_recording else 0.0,
        "recording_frames": len(recording_frames) if recording_mode == "full" else len(layer_buffers.get(active_recording_layer, [])),
        "last_recording": last_saved_recording,
        "layers": {
            k: bool(v and v.get("frames_count", 0) > 0) for k, v in stored_layers.items()
        }
    }


@app.post("/controls/mirror")
@app.post("/studio/controls/mirror")
@app.post("/api/controls/mirror")
async def set_mirror(enabled: bool = False):
    global is_mirror
    is_mirror = enabled
    return {"status": "ok", "mirror": is_mirror}


# ---------------------------------------------------------------------------
# Full vs Layered Motion Capture Recording Engine API Endpoints
# ---------------------------------------------------------------------------
@app.post("/api/record/mode")
@app.post("/record/mode")
async def set_record_mode(mode: str = "full"):
    global recording_mode
    recording_mode = "layered" if mode == "layered" else "full"
    return {"status": "ok", "recording_mode": recording_mode}


@app.post("/api/record/start")
@app.post("/record/start")
@app.post("/studio/record/start")
async def start_recording_endpoint():
    global is_recording, recording_start_time, recording_frames, recording_rotations, recording_mode
    with recording_lock:
        recording_mode = "full"
        is_recording = True
        recording_start_time = time.time()
        recording_frames.clear()
        recording_rotations.clear()

    await broadcast_record_status(True, 0)
    print("[+] Full MoCap recording started!")
    return {
        "status": "recording_started",
        "is_recording": True,
        "mode": "full",
        "message": "Полноценная запись движений начата",
    }


@app.post("/api/record/stop")
@app.post("/record/stop")
@app.post("/studio/record/stop")
async def stop_recording_endpoint():
    global is_recording, recording_start_time, recording_frames, recording_rotations, last_saved_recording
    with recording_lock:
        was_recording = is_recording
        is_recording = False
        duration = round(time.time() - recording_start_time, 2)
        total_frames = len(recording_frames)
        frames_copy = list(recording_frames)
        rotations_copy = list(recording_rotations)

    if not was_recording or total_frames == 0:
        await broadcast_record_status(False, 0)
        return {
            "status": "empty",
            "is_recording": False,
            "frames": 0,
            "duration": 0.0,
            "message": "Нет записанных кадров",
        }

    ts = time.strftime("%Y%m%d_%H%M%S")
    filename = f"mocap_recording_{ts}.json"
    fps = round(total_frames / max(0.1, duration), 1)

    project_payload = {
        "metadata": {
            "project_name": f"Запись MoCap {ts}",
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "fps": fps,
            "total_frames": total_frames,
            "duration": duration,
            "format_version": "1.1",
            "target_model": "karateka_lowpoly.glb",
            "mode": "full_body",
            "stance": latest_biomechanics.get("stance", "Йой-дати"),
            "technique": latest_biomechanics.get("technique", "Позиция ожидания"),
            "score": latest_biomechanics.get("score", 95),
        },
        "frames": frames_copy,
        "rotations": rotations_copy,
    }

    json_str = json.dumps(project_payload, ensure_ascii=False, indent=2)

    target_dirs = [
        Path("/app/uploads/recordings"),
        PROJECT_ROOT.parent / "uploads" / "recordings",
        PROJECT_ROOT / "uploads" / "recordings",
        PROJECT_ROOT.parent / "client" / "public" / "anims",
        PROJECT_ROOT.parent / "client" / "dist" / "anims",
    ]
    for td in target_dirs:
        try:
            td.mkdir(parents=True, exist_ok=True)
            out_file = td / filename
            out_file.write_text(json_str, encoding="utf-8")
        except Exception as e:
            print(f"[!] Note: Could not write to {td}: {e}")

    last_saved_recording = {
        "filename": filename,
        "frames": total_frames,
        "duration": duration,
        "fps": fps,
        "download_url": f"/uploads/recordings/{filename}",
        "client_url": f"/anims/{filename}",
        "timestamp": ts,
        "size_kb": round(len(json_str.encode("utf-8")) / 1024, 1),
    }

    await broadcast_record_status(False, total_frames, last_saved_recording)
    print(f"[+] Full MoCap recording saved: {filename} ({total_frames} frames, {duration}s)")

    return {
        "status": "saved",
        "is_recording": False,
        "frames": total_frames,
        "duration": duration,
        "filename": filename,
        "download_url": f"/uploads/recordings/{filename}",
        "client_url": f"/anims/{filename}",
        "message": f"Файл {filename} успешно сохранен!",
    }


# ---------------------------------------------------------------------------
# Layered Recording Operations (Lower / Upper / Head & Fingers)
# ---------------------------------------------------------------------------
@app.post("/api/record/layer/select")
@app.post("/record/layer/select")
async def select_layer(layer: str = "lower"):
    global active_recording_layer
    if layer == "head_fingers":
        layer = "fingers"
    valid_layers = ["lower", "upper", "fingers"]
    if layer in valid_layers:
        active_recording_layer = layer
    return {"status": "ok", "active_layer": active_recording_layer}


@app.post("/api/record/layer/start")
@app.post("/record/layer/start")
async def start_layer_recording(layer: str = "lower"):
    global is_recording, recording_mode, active_recording_layer, recording_start_time
    if layer == "head_fingers":
        layer = "fingers"
    valid_layers = ["lower", "upper", "fingers"]
    if layer not in valid_layers:
        layer = "lower"

    with recording_lock:
        recording_mode = "layered"
        active_recording_layer = layer
        is_recording = True
        recording_start_time = time.time()
        layer_buffers[layer].clear()
        layer_rotations_buffer[layer].clear()

    await broadcast_record_status(True, 0)
    print(f"[+] Layer recording started: {layer}")
    return {"status": "layer_recording_started", "layer": layer, "is_recording": True}


@app.post("/api/record/layer/stop")
@app.post("/record/layer/stop")
async def stop_layer_recording():
    global is_recording, stored_layers
    with recording_lock:
        was_recording = is_recording
        is_recording = False
        duration = round(time.time() - recording_start_time, 2)
        layer = active_recording_layer
        frames = list(layer_buffers.get(layer, []))
        rotations = list(layer_rotations_buffer.get(layer, []))

    if not was_recording or not frames:
        await broadcast_record_status(False, 0)
        return {"status": "empty", "layer": layer, "frames": 0}

    fps = round(len(frames) / max(0.1, duration), 1)
    stored_layers[layer] = {
        "layer_name": layer,
        "duration": duration,
        "fps": fps,
        "frames_count": len(frames),
        "frames": frames,
        "rotations": rotations,
    }

    await broadcast_record_status(False, len(frames))
    print(f"[+] Layer recorded and stored in memory: {layer} ({len(frames)} frames)")
    return {
        "status": "layer_saved",
        "layer": layer,
        "frames": len(frames),
        "duration": duration,
        "layers": {k: bool(v and v.get("frames_count", 0) > 0) for k, v in stored_layers.items()},
    }


@app.post("/api/record/layer/merge")
@app.post("/record/layer/merge")
async def merge_layers_endpoint():
    global stored_layers, last_saved_recording
    active_recorded = {k: v for k, v in stored_layers.items() if v and v.get("frames_count", 0) > 0}
    if not active_recorded:
        return {"status": "error", "message": "Нет записанных слоев для объединения!"}

    # Determine max duration and max frame count
    max_frames = max(v["frames_count"] for v in active_recorded.values())
    max_duration = max(v["duration"] for v in active_recorded.values())
    fps = round(max_frames / max(0.1, max_duration), 1)

    merged_frames = []
    merged_rotations = []

    lower_layer = stored_layers.get("lower")
    upper_layer = stored_layers.get("upper")
    fingers_layer = stored_layers.get("fingers") or stored_layers.get("head_fingers")

    # Composite joint list per layer
    lower_joints = {"left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle", "left_heel", "right_heel", "left_foot_index", "right_foot_index"}
    # Upper Body Layer captures the entire torso, arms, head, gaze (Metsuke) AND base finger movements:
    upper_joints = {
        "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist",
        "left_pinky", "right_pinky", "left_index", "right_index", "left_thumb", "right_thumb",
        "nose", "left_eye", "right_eye", "left_ear", "right_ear"
    }

    lower_bones = {"Root", "Hips", "UpperLeg.L", "UpperLeg.R", "LowerLeg.L", "LowerLeg.R", "Foot.L", "Foot.R", "Toe.L", "Toe.R"}
    upper_bones = {
        "Spine", "Spine1", "Chest", "Shoulder.L", "Shoulder.R", "UpperArm.L", "UpperArm.R", "LowerArm.L", "LowerArm.R", "Hand.L", "Hand.R",
        "Neck", "Head"
    }

    for i in range(max_frames):
        rel_t = round(i / max(1.0, fps), 3)
        combined_joints = {}
        combined_conf = {}
        combined_bones = {}
        root_pos = [0.0, 0.9, 0.0]
        root_rot = [0.0, 0.0, 0.0, 1.0]
        head_data = {"pitch": 0.0, "yaw": 0.0, "roll": 0.0}
        fingers_data = {
            "left": {"thumb": 0.15, "index": 0.15, "middle": 0.15, "ring": 0.15, "pinky": 0.15},
            "right": {"thumb": 0.15, "index": 0.15, "middle": 0.15, "ring": 0.15, "pinky": 0.15},
        }

        # 1. Lower Body Layer
        if lower_layer and lower_layer.get("frames"):
            idx_l = i % lower_layer["frames_count"]
            f_l = lower_layer["frames"][idx_l]
            r_l = lower_layer["rotations"][idx_l]
            root_pos = f_l.get("rootPosition", root_pos)
            root_rot = f_l.get("rootRotation", root_rot)
            for j in lower_joints:
                if j in f_l.get("joints", {}):
                    combined_joints[j] = f_l["joints"][j]
                    combined_conf[j] = f_l.get("confidence", {}).get(j, 0.9)
            for b in lower_bones:
                if b in r_l:
                    combined_bones[b] = r_l[b]

        # 2. Upper Body Layer (Torso, Arms, Head and base Fingers all recorded together!)
        if upper_layer and upper_layer.get("frames"):
            idx_u = i % upper_layer["frames_count"]
            f_u = upper_layer["frames"][idx_u]
            r_u = upper_layer["rotations"][idx_u]
            if not lower_layer:
                root_pos = f_u.get("rootPosition", root_pos)
            # Head and Metsuke gaze captured directly with torso:
            head_data = f_u.get("head", head_data)
            # Default fingers captured directly with upper body strikes/blocks:
            if "fingers" in f_u and f_u["fingers"]:
                fingers_data = f_u["fingers"]
            for j in upper_joints:
                if j in f_u.get("joints", {}):
                    combined_joints[j] = f_u["joints"][j]
                    combined_conf[j] = f_u.get("confidence", {}).get(j, 0.9)
            for b in upper_bones:
                if b in r_u:
                    combined_bones[b] = r_u[b]
            for b_name, b_val in r_u.items():
                if any(x in b_name for x in ["Thumb", "Index", "Middle", "Ring", "Pinky"]):
                    combined_bones[b_name] = b_val

        # 3. Fine-Tuned Fingers Layer (Optional Override for Close-up Hand Details)
        if fingers_layer and fingers_layer.get("frames"):
            idx_f = i % fingers_layer["frames_count"]
            f_f = fingers_layer["frames"][idx_f]
            r_f = fingers_layer["rotations"][idx_f]
            if "fingers" in f_f and f_f["fingers"]:
                fingers_data = f_f["fingers"]
            for b_name, b_val in r_f.items():
                if any(x in b_name for x in ["Thumb", "Index", "Middle", "Ring", "Pinky"]):
                    combined_bones[b_name] = b_val

        merged_frames.append({
            "frame": i,
            "time": rel_t,
            "rootPosition": root_pos,
            "rootRotation": root_rot,
            "joints": combined_joints,
            "confidence": combined_conf,
            "head": head_data,
            "fingers": fingers_data,
        })
        merged_rotations.append(combined_bones)

    ts = time.strftime("%Y%m%d_%H%M%S")
    filename = f"mocap_recording_layered_{ts}.json"

    project_payload = {
        "metadata": {
            "project_name": f"Послойная Ката MoCap {ts}",
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "fps": fps,
            "total_frames": max_frames,
            "duration": max_duration,
            "format_version": "1.1",
            "target_model": "karateka_lowpoly.glb",
            "mode": "layered_composite",
            "layers_included": list(active_recorded.keys()),
        },
        "frames": merged_frames,
        "rotations": merged_rotations,
    }

    json_str = json.dumps(project_payload, ensure_ascii=False, indent=2)

    target_dirs = [
        Path("/app/uploads/recordings"),
        PROJECT_ROOT.parent / "uploads" / "recordings",
        PROJECT_ROOT / "uploads" / "recordings",
        PROJECT_ROOT.parent / "client" / "public" / "anims",
        PROJECT_ROOT.parent / "client" / "dist" / "anims",
    ]
    for td in target_dirs:
        try:
            td.mkdir(parents=True, exist_ok=True)
            (td / filename).write_text(json_str, encoding="utf-8")
        except Exception:
            pass

    last_saved_recording = {
        "filename": filename,
        "frames": max_frames,
        "duration": max_duration,
        "fps": fps,
        "download_url": f"/uploads/recordings/{filename}",
        "client_url": f"/anims/{filename}",
        "timestamp": ts,
        "size_kb": round(len(json_str.encode("utf-8")) / 1024, 1),
    }

    print(f"[+] Layered MoCap animation successfully merged: {filename} ({max_frames} frames)")
    return {
        "status": "merged",
        "filename": filename,
        "frames": max_frames,
        "duration": max_duration,
        "download_url": f"/uploads/recordings/{filename}",
        "client_url": f"/anims/{filename}",
        "message": f"Послойная анимация {filename} успешно собрана!",
    }


@app.post("/api/record/layer/clear")
@app.post("/record/layer/clear")
async def clear_layers_endpoint():
    global stored_layers, layer_buffers, layer_rotations_buffer
    with recording_lock:
        for k in stored_layers:
            stored_layers[k] = None
            layer_buffers[k].clear()
            layer_rotations_buffer[k].clear()
    return {"status": "ok", "message": "Слои записи очищены"}


@app.get("/api/record/layer/status")
@app.get("/record/layer/status")
async def get_layer_status():
    status_dict = {
        k: {
            "recorded": bool(v and v.get("frames_count", 0) > 0),
            "frames_count": v.get("frames_count", 0) if v else 0,
            "duration": v.get("duration", 0.0) if v else 0.0,
        }
        for k, v in stored_layers.items()
    }
    # Provide backward-compatibility alias for clients expecting head_fingers:
    status_dict["head_fingers"] = status_dict.get("fingers", {"recorded": False, "frames_count": 0, "duration": 0.0})
    return {
        "recording_mode": recording_mode,
        "active_layer": active_recording_layer,
        "is_recording": is_recording,
        "layers": status_dict,
    }


@app.get("/api/record/status")
@app.get("/record/status")
@app.get("/studio/record/status")
async def get_record_status():
    current_frames = len(recording_frames) if recording_mode == "full" else len(layer_buffers.get(active_recording_layer, []))
    return {
        "is_recording": is_recording,
        "mode": recording_mode,
        "active_layer": active_recording_layer,
        "duration": round(time.time() - recording_start_time, 1) if is_recording else 0.0,
        "frames": current_frames,
        "last_recording": last_saved_recording,
        "layers": {k: bool(v and v.get("frames_count", 0) > 0) for k, v in stored_layers.items()},
    }


@app.get("/api/record/list")
@app.get("/record/list")
async def list_recordings():
    search_dirs = [
        Path("/app/uploads/recordings"),
        PROJECT_ROOT.parent / "uploads" / "recordings",
        PROJECT_ROOT / "uploads" / "recordings",
    ]
    recordings = []
    seen = set()

    for sdir in search_dirs:
        if sdir.exists():
            for f in sorted(sdir.glob("mocap_recording_*.json"), key=os.path.getmtime, reverse=True):
                if f.name in seen:
                    continue
                seen.add(f.name)
                try:
                    stat = f.stat()
                    meta_info = {}
                    try:
                        with open(f, "r", encoding="utf-8") as jf:
                            d = json.load(jf)
                            meta_info = d.get("metadata", {})
                    except Exception:
                        pass

                    recordings.append({
                        "filename": f.name,
                        "size_kb": round(stat.st_size / 1024, 1),
                        "mtime": stat.st_mtime,
                        "frames": meta_info.get("total_frames", 0),
                        "duration": meta_info.get("duration", 0),
                        "mode": meta_info.get("mode", "full_body"),
                        "download_url": f"/uploads/recordings/{f.name}",
                    })
                except Exception:
                    pass

    return {"status": "ok", "recordings": recordings}


@app.get("/uploads/recordings/{filename}")
@app.get("/api/record/download/{filename}")
async def download_recording(filename: str):
    search_dirs = [
        Path("/app/uploads/recordings"),
        PROJECT_ROOT.parent / "uploads" / "recordings",
        PROJECT_ROOT / "uploads" / "recordings",
        PROJECT_ROOT.parent / "client" / "public" / "anims",
    ]
    for sdir in search_dirs:
        candidate = sdir / filename
        if candidate.exists():
            return FileResponse(
                str(candidate),
                media_type="application/json",
                filename=filename,
                headers={"Content-Disposition": f'attachment; filename="{filename}"'}
            )
    return Response(content="File not found", status_code=404)


@app.get("/anims/{filename}")
async def serve_anim(filename: str):
    search_dirs = [
        PROJECT_ROOT.parent / "client" / "public" / "anims",
        PROJECT_ROOT.parent / "client" / "dist" / "anims",
        Path("/app/uploads/recordings"),
        PROJECT_ROOT.parent / "uploads" / "recordings",
    ]
    for sdir in search_dirs:
        candidate = sdir / filename
        if candidate.exists():
            return FileResponse(str(candidate), media_type="application/json")
    return Response(content="Animation file not found", status_code=404)


# Video feed streaming endpoint (MJPEG)
@app.get("/video_feed")
async def video_feed():
    async def frame_streamer():
        global latest_jpeg_bytes
        last_sent = None
        while True:
            await asyncio.sleep(0.033)
            frame = latest_jpeg_bytes if latest_jpeg_bytes is not None else get_waiting_splash_jpeg()
            if frame is not last_sent:
                last_sent = frame
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(frame)).encode() + b"\r\n\r\n" +
                    frame + b"\r\n"
                )

    return StreamingResponse(
        frame_streamer(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Accel-Buffering": "no",
        }
    )


# WebSocket endpoint for 3D viewers (receives pose data in real time)
@app.websocket("/ws/viewer")
async def viewer_websocket(websocket: WebSocket):
    await websocket.accept()
    async with viewer_lock:
        connected_viewers.add(websocket)
        if latest_fused_pose:
            try:
                await websocket.send_text(json.dumps(latest_fused_pose))
            except Exception:
                pass
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        async with viewer_lock:
            connected_viewers.discard(websocket)


# High-Performance WebSocket Receiver for Phone Cameras
@app.websocket("/ws/stream/{camera_id}")
async def phone_stream_endpoint(websocket: WebSocket, camera_id: str):
    await websocket.accept()
    camera_last_seen[camera_id] = time.time()
    ws_lock = asyncio.Lock()
    async with phone_lock:
        connected_phones.add(websocket)
        phone_socket_locks[websocket] = ws_lock

    try:
        async with ws_lock:
            await websocket.send_text(json.dumps({
                "type": "record_status",
                "is_recording": is_recording,
                "mode": recording_mode,
                "duration": round(time.time() - recording_start_time, 1) if is_recording else 0.0,
                "frames": len(recording_frames) if recording_mode == "full" else len(layer_buffers.get(active_recording_layer, [])),
            }))
    except Exception:
        pass

    try:
        while True:
            msg = await websocket.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if "bytes" in msg and msg["bytes"]:
                t_now = time.time()
                camera_last_seen[camera_id] = t_now

                camera_frame_counts[camera_id] = camera_frame_counts.get(camera_id, 0) + 1
                t_fps = camera_fps_timers.get(camera_id, t_now)
                if t_now - t_fps >= 1.0:
                    camera_fps[camera_id] = camera_frame_counts[camera_id] / (t_now - t_fps)
                    camera_frame_counts[camera_id] = 0
                    camera_fps_timers[camera_id] = t_now

                async with frame_buffer_lock:
                    incoming_frame_buffers[camera_id] = msg["bytes"]
                new_incoming_event.set()

                # Send immediate 1-byte binary ACK (0x06) to release phone for next frame without queueing
                try:
                    async with ws_lock:
                        await websocket.send_bytes(b"\x06")
                except Exception:
                    pass

    except (WebSocketDisconnect, Exception):
        pass
    finally:
        async with phone_lock:
            connected_phones.discard(websocket)
            phone_socket_locks.pop(websocket, None)
        camera_last_seen.pop(camera_id, None)
        incoming_frame_buffers.pop(camera_id, None)
        camera_fps[camera_id] = 0.0
        new_incoming_event.set()


def run_web_studio():
    cert_path = ASSETS_DIR / "ssl_cert.pem"
    key_path = ASSETS_DIR / "ssl_key.pem"
    if not cert_path.exists() or not key_path.exists():
        possible_ssl_dirs = [
            Path("/app/ssl"),
            Path(__file__).resolve().parent / "ssl",
            Path(__file__).resolve().parent.parent / "ssl",
        ]
        for sdir in possible_ssl_dirs:
            c = sdir / "ssl_cert.pem"
            k = sdir / "ssl_key.pem"
            if c.exists() and k.exists():
                cert_path = c
                key_path = k
                break

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    config_http = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=HTTP_PORT,
        log_level="warning"
    )
    server_http = uvicorn.Server(config_http)
    servers = [server_http.serve()]

    if USE_SSL and cert_path.exists() and key_path.exists():
        config_https = uvicorn.Config(
            app,
            host="0.0.0.0",
            port=HTTPS_PORT,
            ssl_certfile=str(cert_path),
            ssl_keyfile=str(key_path),
            log_level="warning"
        )
        server_https = uvicorn.Server(config_https)
        servers.append(server_https.serve())
        print(f"[+] Multi-Cam Karate Studio HTTP (PC/Web): http://{HOST_IP}:{HTTP_PORT}/studio")
        print(f"[+] Camera 1 Front (Phone HTTPS):         https://{HOST_IP}:{HTTPS_PORT}/cam1")
        print(f"[+] Camera 2 Side (Phone HTTPS):          https://{HOST_IP}:{HTTPS_PORT}/cam2")
        print(f"[+] Camera 3 Diag (Phone HTTPS):          https://{HOST_IP}:{HTTPS_PORT}/cam3")
    else:
        print(f"[+] Multi-Cam Karate Studio HTTP: http://{HOST_IP}:{HTTP_PORT}/studio")

    async def run_both():
        await asyncio.gather(*servers)

    loop.run_until_complete(run_both())


if __name__ == "__main__":
    run_web_studio()
