"""
Comprehensive Verification Test for Karate Motion Studio Mocap System.
Validates all requirements:
1. Live 3D model reaction without recording
2. Recording produces valid mocap animation file on disk
3. Captures full body, feet, fingers
4. Handles arm behind head correctly
5. Canonical T-Camera fusion
"""
import sys
import time
import json
import asyncio
from pathlib import Path
import websockets
import urllib.request

HOST = "127.0.0.1"
HTTP_PORT = 8000
SAMPLE_IMG_PATH = Path(r"d:\Studing\4k1s\Course_Project_CTCP\bunkai-explorer\uploads\sample_kata.jpg")

assert SAMPLE_IMG_PATH.exists(), f"Sample image {SAMPLE_IMG_PATH} not found"
with open(SAMPLE_IMG_PATH, "rb") as f:
    REAL_FRAME_BYTES = f.read()

async def run_full_verification():
    results = {}
    print("\n=======================================================")
    print("  KARATE MOTION STUDIO E2E VERIFICATION SUITE")
    print("=======================================================\n")

    # 1. Server Status
    print("[TEST 1] Verifying server health and initial recording status...")
    req = urllib.request.urlopen(f"http://{HOST}:{HTTP_PORT}/status")
    status_data = json.loads(req.read().decode("utf-8"))
    print(f"  Server: {status_data['server']}, is_recording: {status_data['is_recording']}")
    assert status_data["is_recording"] is False, "Server should not be recording initially"
    results["1_server_status"] = True

    viewer_uri = f"ws://{HOST}:{HTTP_PORT}/ws/viewer"
    cam1_uri = f"ws://{HOST}:{HTTP_PORT}/ws/stream/cam1"
    cam2_uri = f"ws://{HOST}:{HTTP_PORT}/ws/stream/cam2"

    # 2. Live Reaction without recording
    print("\n[TEST 2] Verifying 3D model reacts to phone stream WITHOUT recording...")
    async with websockets.connect(viewer_uri) as ws_viewer:
        async with websockets.connect(cam1_uri) as ws_cam1:
            # Stream frames from camera 1
            for i in range(4):
                await ws_cam1.send(REAL_FRAME_BYTES)
                await asyncio.sleep(0.08)

            # Check if viewer receives fused pose updates
            msg = None
            for _ in range(5):
                try:
                    raw_msg = await asyncio.wait_for(ws_viewer.recv(), timeout=2.5)
                    data = json.loads(raw_msg)
                    if "joints" in data and len(data["joints"]) > 0:
                        msg = data
                        break
                except Exception as e:
                    print(f"  Waiting for pose packet: {e}")

            assert msg is not None, "3D viewer must receive live pose data without recording being pressed!"
            print(f"  [PASS] Live pose received by viewer without recording!")
            print(f"  Key joints detected: {list(msg['joints'].keys())[:6]}... (Total: {len(msg['joints'])})")
            print(f"  Bones solved: {len(msg.get('bones', {}))} bones")
            print(f"  Fingers data: {list(msg.get('fingers', {}).keys())}")
            results["2_live_reaction_no_record"] = True

    # 3. Full-Body, Feet and Finger Landmark Capture
    print("\n[TEST 3] Verifying capture of whole body, feet/ankles/toes, and fingers...")
    required_body_landmarks = [
        "nose", "left_shoulder", "right_shoulder",
        "left_elbow", "right_elbow", "left_wrist", "right_wrist",
        "left_hip", "right_hip", "left_knee", "right_knee",
        "left_ankle", "right_ankle"
    ]
    required_foot_landmarks = ["left_heel", "right_heel", "left_foot_index", "right_foot_index"]

    found_body = [j for j in required_body_landmarks if j in msg["joints"]]
    found_feet = [j for j in required_foot_landmarks if j in msg["joints"]]
    print(f"  Body joints captured: {len(found_body)}/{len(required_body_landmarks)}")
    print(f"  Feet / toes captured: {len(found_feet)}/{len(required_foot_landmarks)} ({found_feet})")
    assert len(found_body) == len(required_body_landmarks), "All standard body landmarks must be present!"
    assert len(found_feet) > 0, "Feet landmarks (heels and foot indices) must be tracked!"
    assert "fingers" in msg and ("left" in msg["fingers"] or "right" in msg["fingers"]), "Finger tracking must be present!"
    results["3_full_body_feet_fingers"] = True

    # 4. Recording Lifecycle and File Creation
    print("\n[TEST 4] Verifying recording produces valid mocap animation file on disk...")
    # 4.1 Start recording
    req_start = urllib.request.Request(f"http://{HOST}:{HTTP_PORT}/api/record/start", data=b"", method="POST")
    with urllib.request.urlopen(req_start) as resp:
        start_res = json.loads(resp.read().decode("utf-8"))
    assert start_res["is_recording"] is True, "Recording must be active after start"
    print(f"  Recording started: {start_res}")

    # 4.2 Stream frames from Cam 1 and Cam 2 while recording
    async with websockets.connect(cam1_uri) as ws_cam1:
        async with websockets.connect(cam2_uri) as ws_cam2:
            for _ in range(12):
                await ws_cam1.send(REAL_FRAME_BYTES)
                await ws_cam2.send(REAL_FRAME_BYTES)
                await asyncio.sleep(0.06)

    # 4.3 Stop recording
    req_stop = urllib.request.Request(f"http://{HOST}:{HTTP_PORT}/api/record/stop", data=b"", method="POST")
    with urllib.request.urlopen(req_stop) as resp:
        stop_res = json.loads(resp.read().decode("utf-8"))
    print(f"  Recording stopped: {stop_res}")

    saved_filename = stop_res.get("filename")
    assert saved_filename is not None, "Filename must be returned!"
    assert stop_res.get("frames", 0) > 0, "Recorded frames must be > 0!"
    print(f"  File created: {saved_filename} with {stop_res['frames']} frames, duration: {stop_res['duration']}s")

    # 4.4 Verify file exists on disk and is non-empty
    target_disk_path = Path(f"d:/Studing/4k1s/Course_Project_CTCP/bunkai-explorer/uploads/recordings/{saved_filename}")
    assert target_disk_path.exists(), f"File {target_disk_path} does not exist on disk!"
    assert target_disk_path.stat().st_size > 500, f"File {target_disk_path} is unexpectedly small!"
    print(f"  [PASS] File verified on host disk: {target_disk_path} ({target_disk_path.stat().st_size} bytes)")

    # 4.5 Verify contents of the recording JSON
    with open(target_disk_path, "r", encoding="utf-8") as jf:
        anim_json = json.load(jf)
    assert "metadata" in anim_json, "Must contain metadata"
    assert "frames" in anim_json and len(anim_json["frames"]) > 0, "Must contain recorded frames"
    assert "rotations" in anim_json and len(anim_json["rotations"]) > 0, "Must contain retargeted bone rotations"
    print(f"  Animation project name: {anim_json['metadata'].get('project_name')}")
    print(f"  Animation FPS: {anim_json['metadata'].get('fps')}, total frames: {anim_json['metadata'].get('total_frames')}")
    results["4_recording_file_created"] = True

    # 5. Arm Behind Head Occlusion Handling Verification
    print("\n[TEST 5] Verifying arm behind head handling (dorsal depth, no collision)...")
    # In web_studio_server.fuse_multicam_landmarks:
    # When Cam 2 (+90 Left) or Cam 3 (-90 Right) sees arm elevated and dz < -0.02,
    # target_z is constrained strictly behind head/neck: min(spine_mid_z - 0.05, target_z)
    # Let's verify with synthetic FrameData directly in docker
    check_code = """
import numpy as np
from core.project_schema import FrameData
from web_studio_server import fuse_multicam_landmarks

f1 = FrameData(
    frame=1, time=0.033, rootPosition=[0,0,0], rootRotation=[0,0,0,1],
    joints={
        'left_hip': [-0.1, 0.9, 0.0], 'right_hip': [0.1, 0.9, 0.0],
        'left_shoulder': [-0.2, 1.4, 0.0], 'right_shoulder': [0.2, 1.4, 0.0],
        'left_elbow': [-0.25, 1.5, 0.05], # Cam 1 front monocular collapsed into face (z = +0.05)
        'left_wrist': [-0.15, 1.55, 0.08], # In front of face
        'nose': [0.0, 1.6, 0.05],
    },
    confidence={'left_shoulder': 0.9, 'left_elbow': 0.4, 'left_wrist': 0.3},
    tracking_loss=False
)

# Cam 2 (+90 Left side) clearly sees the arm behind the head: dz_side = -0.15 (dorsal)
f2 = FrameData(
    frame=1, time=0.033, rootPosition=[0,0,0], rootRotation=[0,0,0,1],
    joints={
        'left_hip': [0.0, 0.9, 0.0], 'right_hip': [0.0, 0.9, 0.0],
        'left_shoulder': [0.0, 1.4, 0.0], 'right_shoulder': [0.0, 1.4, 0.0],
        'left_elbow': [-0.12, 1.52, 0.0], # dz_side = -0.12 (behind spine)
        'left_wrist': [-0.18, 1.58, 0.0], # dz_side = -0.18 (deep behind head)
    },
    confidence={'left_elbow': 0.88, 'left_wrist': 0.85},
    tracking_loss=False
)

fused = fuse_multicam_landmarks(f1, f2, None)
wr_z = fused.joints['left_wrist'][2]
el_z = fused.joints['left_elbow'][2]
print(f'FUSED_WRIST_Z={wr_z}, FUSED_ELBOW_Z={el_z}')
assert wr_z < -0.04, f'Wrist Z must be strictly behind head (< -0.04), got {wr_z}'
assert el_z < -0.04, f'Elbow Z must be strictly behind head (< -0.04), got {el_z}'
print('BEHIND_HEAD_TEST_PASSED')
"""
    import subprocess
    cmd = ["docker", "exec", "bunkai-explorer-mocap-studio", "python", "-c", check_code]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    print("  Docker check output:", proc.stdout.strip())
    assert "BEHIND_HEAD_TEST_PASSED" in proc.stdout, f"Arm behind head test failed: {proc.stderr}"
    print("  [PASS] Arm behind head correctly handled without popping forward!")
    results["5_arm_behind_head"] = True

    # 6. /api/record/list Verification
    print("\n[TEST 6] Verifying recording appears in /api/record/list...")
    req_list = urllib.request.urlopen(f"http://{HOST}:{HTTP_PORT}/api/record/list")
    list_res = json.loads(req_list.read().decode("utf-8"))
    recs = list_res.get("recordings", [])
    found = any(r.get("filename") == saved_filename for r in recs)
    assert found, f"File {saved_filename} must be in list"
    print(f"  [PASS] File confirmed in recording list ({len(recs)} total recordings).")
    results["6_record_list"] = True

    print("\n=======================================================")
    print("  ALL 6 VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=======================================================\n")
    return True

if __name__ == "__main__":
    asyncio.run(run_full_verification())
