"""
Karate Motion Studio — High-Performance Multi-Camera AI Mocap Server.
Supports 1, 2, or 3 smartphone cameras simultaneously.
- Zero-Lag Latest-Frame Dispatcher (no queuing, no latency buildup)
- Multi-threaded parallel MediaPipe tracking in ThreadPoolExecutor
- Anatomical 3D depth fusion from orthogonal camera angles (Cam 1 Front + Cam 2 Side + Cam 3 Diagonal)
- Unifies multi-camera inputs into ONE single master 3D avatar rig
- Dual network ports:
    * Port 8000 (HTTP): Zero-config PC web studio, 3D viewport, iFrames
    * Port 8088 (HTTPS): Secure camera stream for mobile browsers (Safari / Chrome)
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
from concurrent.futures import ThreadPoolExecutor

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
from core.project_schema import FrameData

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

@app.get("/karateka_lowpoly.glb")
async def get_root_model():
    model_file = ASSETS_DIR / "karateka_lowpoly.glb"
    return FileResponse(str(model_file), media_type="model/gltf-binary")


# Network ports
def get_current_host_ip() -> str:
    env_ip = os.environ.get("HOST_IP", "").strip()
    if env_ip and env_ip != "127.0.0.1" and not env_ip.startswith("169.254"):
        return env_ip
    detected = get_local_ip()
    if detected and detected != "127.0.0.1" and not detected.startswith("169.254"):
        return detected
    return "127.0.0.1"

HOST_IP = get_current_host_ip()
HTTP_PORT = 8000
HTTPS_PORT = 8088
USE_SSL = (ASSETS_DIR / "ssl_cert.pem").exists() and (ASSETS_DIR / "ssl_key.pem").exists()

# Dedicated Multi-Camera Trackers
# Cam 1 (Front): fast complexity 0 with hands enabled
tracker_cam1 = MocapTracker(track_hands=True, model_complexity=0)
# Cam 2 (Side - Profile Depth): ultra-fast complexity 0 pose
tracker_cam2 = MocapTracker(track_hands=False, model_complexity=0)
# Cam 3 (Diagonal - Occlusion Recovery): ultra-fast complexity 0 pose
tracker_cam3 = MocapTracker(track_hands=False, model_complexity=0)

tracker_cam1_lock = threading.Lock()
tracker_cam2_lock = threading.Lock()
tracker_cam3_lock = threading.Lock()
tracking_loop_started = False

retargeter = Retargeter()
thread_pool = ThreadPoolExecutor(max_workers=3, thread_name_prefix="MocapWorker")

# Zero-Lag In-Memory Buffers (Holds ONLY the latest incoming frame per camera)
frame_buffer_lock = asyncio.Lock()
incoming_frame_buffers: Dict[str, bytes] = {}
camera_last_seen: Dict[str, float] = {}
camera_fps: Dict[str, float] = {"cam1": 0.0, "cam2": 0.0, "cam3": 0.0}
camera_frame_counts: Dict[str, int] = {"cam1": 0, "cam2": 0, "cam3": 0}
camera_fps_timers: Dict[str, float] = {"cam1": time.time(), "cam2": time.time(), "cam3": time.time()}

# Output state
connected_viewers: Set[WebSocket] = set()
viewer_lock = asyncio.Lock()

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
    phone_ssl = f"https://{HOST_IP}:{HTTPS_PORT}/cam1"
    cv2.putText(img, "KARATE MOTION STUDIO - MULTI-CAM MOCAP", (210, 160), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (71, 87, 255), 2)
    cv2.putText(img, "Connect 1, 2, or 3 Smartphone Cameras via Wi-Fi:", (250, 220), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (200, 205, 215), 2)
    cv2.putText(img, f"Cam 1 (Front):    https://{HOST_IP}:{HTTPS_PORT}/cam1", (270, 290), cv2.FONT_HERSHEY_SIMPLEX, 0.78, (16, 185, 129), 2)
    cv2.putText(img, f"Cam 2 (Side 90):  https://{HOST_IP}:{HTTPS_PORT}/cam2", (270, 340), cv2.FONT_HERSHEY_SIMPLEX, 0.78, (6, 182, 212), 2)
    cv2.putText(img, f"Cam 3 (Diag 45):  https://{HOST_IP}:{HTTPS_PORT}/cam3", (270, 390), cv2.FONT_HERSHEY_SIMPLEX, 0.78, (168, 85, 247), 2)
    cv2.putText(img, "Multiple cameras fuse into ONE unified 3D Master Model", (260, 460), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (245, 158, 11), 2)
    t = time.time()
    pulse = int(12 + 6 * np.sin(t * 3))
    cv2.circle(img, (640, 550), max(3, pulse), (71, 87, 255), -1)
    cv2.putText(img, "AWAITING WIRELESS CAMERA PACKETS...", (410, 620), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (140, 150, 160), 2)
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return buf.tobytes()

latest_jpeg_bytes = get_waiting_splash_jpeg()


# ---------------------------------------------------------------------------
# Multi-Camera 3D Landmark & Depth Fusion Engine
# ---------------------------------------------------------------------------
def fuse_multicam_landmarks(
    fdata1: Optional[FrameData],
    fdata2: Optional[FrameData],
    fdata3: Optional[FrameData],
) -> Optional[FrameData]:
    """
    Fuses landmarks from up to 3 cameras into ONE unified FrameData:
    - Cam 1: Frontal plane (X width, Y height, head & hands)
    - Cam 2: Side 90° profile (Physical depth Z fusion: delta X in side view is delta Z in world!)
    - Cam 3: Diagonal 45° (Occlusion compensation for crossed limbs)
    """
    # Pick primary anchor
    if fdata1 is not None and not fdata1.tracking_loss:
        base = fdata1
    elif fdata2 is not None and not fdata2.tracking_loss:
        base = fdata2
    elif fdata3 is not None and not fdata3.tracking_loss:
        base = fdata3
    else:
        return fdata1 or fdata2 or fdata3

    fused_joints = {k: list(v) for k, v in base.joints.items()}
    fused_conf = dict(base.confidence)

    # 1. Fuse Side Camera (Cam 2) for true physical anatomical depth (Z axis)
    if (
        fdata2 is not None
        and not fdata2.tracking_loss
        and "left_hip" in fdata2.joints
        and "right_hip" in fdata2.joints
        and "left_hip" in fused_joints
        and "right_hip" in fused_joints
    ):
        s_joints = fdata2.joints
        s_conf = fdata2.confidence

        hip_side_x = (s_joints["left_hip"][0] + s_joints["right_hip"][0]) * 0.5
        hip_base_z = (fused_joints["left_hip"][2] + fused_joints["right_hip"][2]) * 0.5

        depth_joints = [
            "left_knee", "right_knee", "left_ankle", "right_ankle",
            "left_heel", "right_heel", "left_foot_index", "right_foot_index",
        ]

        for j in depth_joints:
            if j in s_joints and j in fused_joints:
                c2 = s_conf.get(j, 0.0)
                if c2 > 0.40:
                    dz_side = s_joints[j][0] - hip_side_x
                    target_z = hip_base_z + dz_side
                    # Weight: 65% physical side-camera depth + 35% front estimate
                    fused_joints[j][2] = round(0.65 * target_z + 0.35 * fused_joints[j][2], 4)
                    fused_conf[j] = round(max(fused_conf.get(j, 0.0), c2), 3)

    # 2. Fuse Diagonal Camera (Cam 3 at 45°) for occlusion recovery
    if (
        fdata3 is not None
        and not fdata3.tracking_loss
        and "left_hip" in fdata3.joints
        and "right_hip" in fdata3.joints
    ):
        d_joints = fdata3.joints
        d_conf = fdata3.confidence
        cos45, sin45 = 0.7071, 0.7071

        for j, pt in d_joints.items():
            c3 = d_conf.get(j, 0.0)
            c_base = fused_conf.get(j, 0.0)
            if c3 > 0.60 and c_base < 0.45:
                x3, y3, z3 = pt
                x_perf = x3 * cos45 - z3 * sin45
                z_perf = x3 * sin45 + z3 * cos45
                fused_joints[j] = [round(x_perf, 4), round(y3, 4), round(z_perf, 4)]
                fused_conf[j] = round(c3, 3)

    return FrameData(
        frame=base.frame,
        time=base.time,
        rootPosition=base.rootPosition,
        rootRotation=base.rootRotation,
        joints=fused_joints,
        confidence=fused_conf,
        tracking_loss=False,
        head=base.head,
        fingers=base.fingers,
    )


# In-memory persistent video tile & landmark caches to prevent flickering
cached_video_tiles: Dict[str, np.ndarray] = {}
cached_fdata_map: Dict[str, Any] = {}

# Worker function executed in ThreadPoolExecutor (OFF the event loop!)
def process_multicam_worker(
    frames_dict: Dict[str, bytes],
    idx: int,
    t_now: float,
    mirror: bool,
    fps_dict: Dict[str, float]
) -> Tuple[Optional[FrameData], Optional[np.ndarray], Dict[str, Any]]:
    global cached_video_tiles, cached_fdata_map

    target_h = 540

    # Dedicated per-camera tracker configs
    configs = [
        ("cam1", tracker_cam1, tracker_cam1_lock, (16, 185, 129), "КАМЕРА 1 (ФРОНТ)"),
        ("cam2", tracker_cam2, tracker_cam2_lock, (6, 182, 212), "КАМЕРА 2 (СБОКУ: ГЛУБИНА)"),
        ("cam3", tracker_cam3, tracker_cam3_lock, (168, 85, 247), "КАМЕРА 3 (УГОЛ 45°)"),
    ]

    # 1. Update any newly received camera frames
    for cid, trk, trk_lock, badge_col, badge_title in configs:
        if cid in frames_dict:
            raw_bytes = frames_dict[cid]
            if not raw_bytes:
                continue
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
                    cached_fdata_map[cid] = fdata
                    cached_video_tiles[cid] = proc_bgr
            except Exception as e:
                print(f"[!] Error processing camera {cid}: {e}")

    # 2. Identify currently active cameras (seen in the last 2.5s)
    active_cids = [
        cid for cid, t in camera_last_seen.items()
        if (t_now - t < 2.5) and (cid in cached_video_tiles)
    ]
    if not active_cids and cached_video_tiles:
        active_cids = list(cached_video_tiles.keys())

    # Stably sort cameras: cam1 first, then cam2, then cam3
    active_cids.sort()

    if not active_cids:
        return None, None, {}

    num_cams = len(active_cids)
    tile_w = 960 if num_cams == 1 else (640 if num_cams == 2 else 426)

    # 3. Format and scale tiles side-by-side stably
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

        # Overlay title badge
        cv2.rectangle(scaled, (10, 10), (min(scaled.shape[1]-10, 240), 40), (15, 20, 28), -1)
        cv2.rectangle(scaled, (10, 10), (min(scaled.shape[1]-10, 240), 40), badge_col, 2)
        cv2.putText(scaled, badge_title, (18, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.55, badge_col, 2)
        proc_tiles.append(scaled)

    if not proc_tiles:
        return None, None, {}

    # Composite multi-camera tiles side-by-side stably without jumping
    composite_frame = np.hstack(proc_tiles)

    # 4. Fuse multi-camera landmarks
    fused_fdata = fuse_multicam_landmarks(
        cached_fdata_map.get("cam1"),
        cached_fdata_map.get("cam2"),
        cached_fdata_map.get("cam3")
    )

    biomechanics = {}
    if fused_fdata and fused_fdata.joints:
        try:
            biomechanics = analyze_karate_biomechanics(fused_fdata.joints)
        except Exception:
            pass

    return fused_fdata, composite_frame, biomechanics


# ---------------------------------------------------------------------------
# High-Frequency Background Tracking Loop
# ---------------------------------------------------------------------------
async def background_tracking_loop():
    global latest_jpeg_bytes, latest_fused_pose, latest_biomechanics, frame_idx

    while True:
        try:
            await new_incoming_event.wait()
            new_incoming_event.clear()

            # Grab ONLY the newest available frame for each camera (Skip any backlog!)
            async with frame_buffer_lock:
                if not incoming_frame_buffers:
                    continue
                frames_to_process = dict(incoming_frame_buffers)
                incoming_frame_buffers.clear()

            t_now = time.time()
            frame_idx += 1

            # Run MediaPipe and Retargeting in background worker thread
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
                # Solve bone rotations for the single avatar
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

                # Broadcast to 3D avatar WebGL viewers
                if connected_viewers:
                    json_msg = json.dumps(pose_dict)
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
                # Fast JPEG compression
                _, buf = cv2.imencode(".jpg", composite_frame, [cv2.IMWRITE_JPEG_QUALITY, 72])
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
# HTML Studio Dashboard
# ---------------------------------------------------------------------------
def build_studio_html(host_ip: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Karate Motion Studio — Мульти-Камерный AI Мокап</title>
  <style>
    :root {{
      --bg: #111216;
      --card-bg: #181a20;
      --panel-border: #262934;
      --accent: #e05260;
      --accent-glow: rgba(224, 82, 96, 0.35);
      --green: #10b981;
      --green-glow: rgba(16, 185, 129, 0.35);
      --cyan: #06b6d4;
      --purple: #a855f7;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
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

    header {{
      background: #16181f;
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
    .brand-icon {{ font-size: 24px; }}
    .brand-title {{
      font-size: 15px;
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
    .pill.c2.live {{ background: rgba(6, 182, 212, 0.2); border-color: var(--cyan); color: var(--cyan); box-shadow: 0 0 10px rgba(6, 182, 212, 0.35); }}
    .pill.c3.live {{ background: rgba(168, 85, 247, 0.2); border-color: var(--purple); color: var(--purple); box-shadow: 0 0 10px rgba(168, 85, 247, 0.35); }}

    .dot {{ width: 7px; height: 7px; border-radius: 50%; background: #64748b; }}
    .pill.live .dot {{ background: currentColor; box-shadow: 0 0 6px currentColor; }}

    .top-controls {{
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }}
    .btn {{
      background: #252834;
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
    .btn:hover {{ background: #313545; border-color: #4b5563; }}
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

    .studio-grid {{
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 8px;
      overflow: hidden;
      background: #0d0e12;
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
      background: rgba(22, 24, 31, 0.95);
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
      background: #16171a;
    }}

    footer {{
      background: #16181f;
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

    /* Multi-Cam QR Modal */
    .modal-overlay {{
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }}
    .modal-overlay.open {{ display: flex; }}
    .modal-card {{
      background: #1a1d27;
      border: 1px solid #374151;
      border-radius: 12px;
      padding: 22px;
      max-width: 480px;
      width: 90%;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.9);
    }}

    .cam-tabs {{
      display: flex;
      gap: 8px;
      margin: 14px 0 10px;
      justify-content: center;
    }}
    .cam-tab-btn {{
      padding: 6px 14px;
      border-radius: 6px;
      background: #252834;
      border: 1px solid #374151;
      color: #e5e7eb;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }}
    .cam-tab-btn.active {{
      background: var(--green);
      color: #000;
      border-color: var(--green);
    }}
    .qr-img {{
      width: 190px;
      height: 190px;
      border-radius: 8px;
      border: 2px solid var(--green);
      margin: 10px auto;
      background: #fff;
      padding: 6px;
      display: block;
    }}
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span class="brand-icon">🥋</span>
      <div>
        <div class="brand-title">KARATE MOTION STUDIO</div>
        <div class="brand-sub">Мульти-Камерный AI Мокап (1 Модель · до 3 Камер)</div>
      </div>
    </div>

    <!-- Active Camera Status Indicators -->
    <div class="cam-pills">
      <div id="pill-cam1" class="pill c1">
        <span class="dot"></span>
        <span>Камера 1 (Фронт)</span>
      </div>
      <div id="pill-cam2" class="pill c2">
        <span class="dot"></span>
        <span>Камера 2 (Сбоку)</span>
      </div>
      <div id="pill-cam3" class="pill c3">
        <span class="dot"></span>
        <span>Камера 3 (Угол)</span>
      </div>
    </div>

    <div class="top-controls">
      <button class="btn btn-green" onclick="openQrModal()">
        <span>📱</span> <span>Подключить Смартфоны (QR)</span>
      </button>

      <button class="btn" id="btn-mirror" onclick="toggleMirror()">
        <span>🎯</span> <span id="mirror-text">Прямой</span>
      </button>

      <button class="btn" onclick="sendViewerCommand('resetPose')">
        <span>🧘</span> <span>T-Pose</span>
      </button>

      <div style="border-left: 1px solid #374151; height: 18px; margin: 0 4px;"></div>

      <button class="btn" onclick="sendViewerCommand('setCamera', 'front')">Спереди</button>
      <button class="btn active" id="btn-cam-34" onclick="sendViewerCommand('setCamera', '34')">3/4</button>
      <button class="btn" onclick="sendViewerCommand('setCamera', 'side')">Сбоку</button>
      <button class="btn" onclick="sendViewerCommand('setCamera', 'back')">Сзади</button>
    </div>
  </header>

  <div class="studio-grid">
    <!-- LEFT PANEL: Multi-Camera Live Composite Video Feed -->
    <div class="panel-box">
      <div class="panel-header">
        <span>🎥 Мульти-Камерный Видеопоток (OpenCV Скелет)</span>
        <span id="active-cams-count" style="color: #10b981; font-family: monospace;">0 Камер</span>
      </div>
      <div class="panel-content">
        <img id="video-feed" src="/video_feed" alt="Ожидание подключения камер..." />
      </div>
    </div>

    <!-- RIGHT PANEL: Single 3D Master Avatar Model -->
    <div class="panel-box">
      <div class="panel-header">
        <span>🥋 Единый 3D Аватар Мастера (Синхронный Fused Rig)</span>
        <span style="color: #9ca3af; font-size: 11px;">1 Модель · Мульти-Ракурс</span>
      </div>
      <div class="panel-content">
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
      <span>Точность: <span id="telem-score" class="telem-val">95%</span></span>
      <span>•</span>
      <span>Хост: <span class="telem-val">{host_ip}</span></span>
    </div>
  </footer>

  <!-- Multi-Cam QR Modal -->
  <div id="qr-modal" class="modal-overlay" onclick="closeQrModal(event)">
    <div class="modal-card" onclick="event.stopPropagation()">
      <h3 style="color: #fff; font-size: 17px; margin-bottom: 4px;">📱 Подключение Смартфонов (до 3 камер)</h3>
      <p style="color: #9ca3af; font-size: 12px;">Выберите камеру и отсканируйте QR-код смартфоном в Wi-Fi сети:</p>

      <div class="cam-tabs">
        <button id="tab-c1" class="cam-tab-btn active" onclick="switchQrTab('cam1')">Камера 1 (Фронт)</button>
        <button id="tab-c2" class="cam-tab-btn" onclick="switchQrTab('cam2')">Камера 2 (Сбоку 90°)</button>
        <button id="tab-c3" class="cam-tab-btn" onclick="switchQrTab('cam3')">Камера 3 (Угол 45°)</button>
      </div>

      <img id="modal-qr-img" src="/qr/cam1.png" alt="QR Код" class="qr-img" />

      <div style="font-size: 12px; font-family: monospace; color: #10b981; margin: 10px 0; padding: 8px; background: #11141d; border-radius: 6px; border: 1px solid #232a3b; word-break: break-all;">
        <a id="modal-phone-url" href="https://{host_ip}:{HTTPS_PORT}/cam1" target="_blank" style="color: #10b981; text-decoration: none;">
          https://{host_ip}:{HTTPS_PORT}/cam1
        </a>
      </div>

      <p id="modal-cam-desc" style="font-size: 11.5px; color: #94a3b8; margin-bottom: 14px;">
        Камера 1: Установите прямо перед собой на уровне груди (лицо, руки, корпус).
      </p>

      <button class="btn" style="width: 100%; justify-content: center; padding: 9px;" onclick="closeQrModal()">
        Закрыть
      </button>
    </div>
  </div>

  <script>
    let isMirrored = false;
    let currentQrCam = 'cam1';
    const hostIp = '{host_ip}';
    const httpsPort = '{HTTPS_PORT}';

    function openQrModal() {{ document.getElementById('qr-modal').classList.add('open'); }}
    function closeQrModal(e) {{
      if (!e || e.target.id === 'qr-modal') {{
        document.getElementById('qr-modal').classList.remove('open');
      }}
    }}

    function switchQrTab(camId) {{
      currentQrCam = camId;
      document.querySelectorAll('.cam-tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('tab-' + (camId === 'cam1' ? 'c1' : (camId === 'cam2' ? 'c2' : 'c3'))).classList.add('active');

      const qrImg = document.getElementById('modal-qr-img');
      const urlA = document.getElementById('modal-phone-url');
      const desc = document.getElementById('modal-cam-desc');

      qrImg.src = `/qr/${{camId}}.png?t=` + Date.now();
      const targetUrl = `https://${{hostIp}}:${{httpsPort}}/${{camId}}`;
      urlA.href = targetUrl;
      urlA.innerText = targetUrl;

      if (camId === 'cam1') {{
        desc.innerText = 'Камера 1 (Фронт): Установите прямо перед собой на уровне груди (лицо, руки, стойка).';
      }} else if (camId === 'cam2') {{
        desc.innerText = 'Камера 2 (Сбоку 90°): Установите сбоку от себя для захвата реальной глубины стоек и ударов.';
      }} else {{
        desc.innerText = 'Камера 3 (Диагональ 45°): Установите под углом 45° для компенсации перекрытий при разворотах.';
      }}
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

    // Poll multi-camera status every 400ms
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

          countTag.innerText = `${{active.length}} Камер(ы) активны`;

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
        }}
      }} catch (e) {{}}
    }}, 400);

    // Auto-reconnect video feed on connection hiccup
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
    client_host = request.headers.get("host", f"{HOST_IP}:{HTTP_PORT}").split(":")[0]
    return HTMLResponse(content=build_studio_html(client_host), status_code=200)


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


@app.get("/qr/cam1.png")
@app.get("/qr.png")
async def get_qr_cam1():
    current_ip = get_current_host_ip()
    url = f"https://{current_ip}:{HTTPS_PORT}/cam1"
    png_bytes = generate_qr_png_bytes(url)
    return Response(content=png_bytes, media_type="image/png")


@app.get("/qr/cam2.png")
async def get_qr_cam2():
    current_ip = get_current_host_ip()
    url = f"https://{current_ip}:{HTTPS_PORT}/cam2"
    png_bytes = generate_qr_png_bytes(url)
    return Response(content=png_bytes, media_type="image/png")


@app.get("/qr/cam3.png")
async def get_qr_cam3():
    current_ip = get_current_host_ip()
    url = f"https://{current_ip}:{HTTPS_PORT}/cam3"
    png_bytes = generate_qr_png_bytes(url)
    return Response(content=png_bytes, media_type="image/png")


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
    }


@app.post("/controls/mirror")
@app.post("/studio/controls/mirror")
@app.post("/api/controls/mirror")
async def set_mirror(enabled: bool = False):
    global is_mirror
    is_mirror = enabled
    return {"status": "ok", "mirror": is_mirror}


# Video feed streaming endpoint (MJPEG)
@app.get("/video_feed")
async def video_feed():
    async def frame_streamer():
        global latest_jpeg_bytes
        last_sent = None
        while True:
            await asyncio.sleep(0.033)  # ~30 FPS smooth pacing
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


# WebSocket endpoint for 3D viewers (receives pose data)
@app.websocket("/ws/viewer")
async def viewer_websocket(websocket: WebSocket):
    await websocket.accept()
    async with viewer_lock:
        connected_viewers.add(websocket)
        # Send latest pose immediately so avatar doesn't wait
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


# High-Performance WebSocket Receiver (Zero Buffer Queue!)
@app.websocket("/ws/stream/{camera_id}")
async def phone_stream_endpoint(websocket: WebSocket, camera_id: str):
    await websocket.accept()
    camera_last_seen[camera_id] = time.time()

    try:
        while True:
            msg = await websocket.receive()
            if "bytes" in msg and msg["bytes"]:
                t_now = time.time()
                camera_last_seen[camera_id] = t_now

                # Calculate camera FPS
                camera_frame_counts[camera_id] = camera_frame_counts.get(camera_id, 0) + 1
                t_fps = camera_fps_timers.get(camera_id, t_now)
                if t_now - t_fps >= 1.0:
                    camera_fps[camera_id] = camera_frame_counts[camera_id] / (t_now - t_fps)
                    camera_frame_counts[camera_id] = 0
                    camera_fps_timers[camera_id] = t_now

                # ZERO-BUFFER DISPATCH: Overwrites slot with ONLY the freshest frame!
                # Older frames that haven't been picked up are discarded automatically.
                async with frame_buffer_lock:
                    incoming_frame_buffers[camera_id] = msg["bytes"]
                new_incoming_event.set()

    except WebSocketDisconnect:
        pass
    finally:
        camera_last_seen.pop(camera_id, None)
        incoming_frame_buffers.pop(camera_id, None)
        new_incoming_event.set()


def run_web_studio():
    cert_path = ASSETS_DIR / "ssl_cert.pem"
    key_path = ASSETS_DIR / "ssl_key.pem"

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    # 1. HTTP Server on Port 8000 (No SSL errors for PC, iFrames, local network)
    config_http = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=HTTP_PORT,
        log_level="warning"
    )
    server_http = uvicorn.Server(config_http)
    servers = [server_http.serve()]

    # 2. HTTPS Server on Port 8088 (SSL for smartphone cameras)
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
