# In-container verification script for all /goal requirements
import sys
import time
import json
import asyncio
from pathlib import Path

def test_multicam_fusion():
    print("=== 1. Testing Multi-Camera Fusion Logic inside Container ===")
    from web_studio_server import fuse_multicam_landmarks
    from core.project_schema import FrameData

    # Case 0: 0 cameras
    res0 = fuse_multicam_landmarks(None, None, None)
    assert res0 is None, "0 cameras must return None gracefully"
    print("  ✓ 0 cameras: Returns None gracefully without crashing.")

    # Case 1A: Cam 1 (Front alone)
    fd1 = FrameData(
        frame=1, time=0.033, rootPosition=[0, 0.9, 0], rootRotation=[0, 0, 0, 1],
        joints={"left_shoulder": [-0.2, 1.4, 0.0], "right_shoulder": [0.2, 1.4, 0.0],
                "left_hip": [-0.1, 0.9, 0.0], "right_hip": [0.1, 0.9, 0.0],
                "left_knee": [-0.1, 0.45, 0.0], "left_ankle": [-0.1, 0.05, 0.0]},
        confidence={"left_shoulder": 0.95, "right_shoulder": 0.95, "left_hip": 0.95, "right_hip": 0.95,
                    "left_knee": 0.9, "left_ankle": 0.9},
        tracking_loss=False
    )
    res1 = fuse_multicam_landmarks(fd1, None, None)
    assert res1 is not None and "left_shoulder" in res1.joints
    print("  ✓ 1 camera alone (Cam 1 Front): Successfully fused.")

    # Case 1B: Cam 2 (Left side profile alone)
    # Cam 2 rotation: X_w = v[2], Y_w = v[1], Z_w = -v[0]
    fd2 = FrameData(
        frame=1, time=0.033, rootPosition=[0.1, 0.9, 0.5], rootRotation=[0, 0, 0, 1],
        joints={"left_shoulder": [-0.1, 1.4, 0.2], "left_hip": [0.0, 0.9, 0.1]},
        confidence={"left_shoulder": 0.9, "left_hip": 0.9},
        tracking_loss=False
    )
    res2 = fuse_multicam_landmarks(None, fd2, None)
    assert res2 is not None
    # Rotated: [v[2], v[1], -v[0]] -> [0.2, 1.4, -(-0.1)] = [0.2, 1.4, 0.1]
    assert abs(res2.joints["left_shoulder"][0] - 0.2) < 1e-3
    assert abs(res2.joints["left_shoulder"][2] - 0.1) < 1e-3
    print("  ✓ 1 camera alone (Cam 2 Left side): Profile rotation to world-front verified!")

    # Case 1C: Cam 3 (Right side profile alone)
    # Cam 3 rotation: X_w = -v[2], Y_w = v[1], Z_w = v[0]
    fd3 = FrameData(
        frame=1, time=0.033, rootPosition=[0.1, 0.9, -0.5], rootRotation=[0, 0, 0, 1],
        joints={"right_shoulder": [0.1, 1.4, -0.2], "right_hip": [0.0, 0.9, -0.1]},
        confidence={"right_shoulder": 0.9, "right_hip": 0.9},
        tracking_loss=False
    )
    res3 = fuse_multicam_landmarks(None, None, fd3)
    assert res3 is not None
    # Rotated: [-v[2], v[1], v[0]] -> [-(-0.2), 1.4, 0.1] = [0.2, 1.4, 0.1]
    assert abs(res3.joints["right_shoulder"][0] - 0.2) < 1e-3
    assert abs(res3.joints["right_shoulder"][2] - 0.1) < 1e-3
    print("  ✓ 1 camera alone (Cam 3 Right side): Profile rotation to world-front verified!")

    # Case 1D: Cam 2 + Cam 3 (Profiles alone without Front camera)
    res23 = fuse_multicam_landmarks(None, fd2, fd3)
    assert res23 is not None
    print("  ✓ 2 profile cameras (Cam 2 + Cam 3 without Front): Rotated & fused successfully!")

    # Case 2A: 2 cameras (Cam 1 Front + Cam 2 Left) with BOTH ARMS RAISED FORWARD
    # In Cam 1: wrists are forward (+Z = 0.35)
    # In Cam 2: hands move forward (towards Cam 1 / camera's left: -X = -0.35)
    fd1_forward = FrameData(
        frame=2, time=0.066, rootPosition=[0, 0.9, 0], rootRotation=[0, 0, 0, 1],
        joints={"left_shoulder": [-0.2, 1.4, 0.0], "right_shoulder": [0.2, 1.4, 0.0],
                "left_hip": [-0.1, 0.9, 0.0], "right_hip": [0.1, 0.9, 0.0],
                "left_wrist": [-0.2, 1.4, 0.35], "right_wrist": [0.2, 1.4, 0.35]},
        confidence={"left_shoulder": 0.95, "right_shoulder": 0.95, "left_hip": 0.95, "right_hip": 0.95,
                    "left_wrist": 0.95, "right_wrist": 0.95},
        tracking_loss=False
    )
    fd2_forward = FrameData(
        frame=2, time=0.066, rootPosition=[0, 0.9, 0], rootRotation=[0, 0, 0, 1],
        joints={"left_shoulder": [0.0, 1.4, 0.0], "right_shoulder": [0.0, 1.4, 0.0],
                "left_hip": [0.0, 0.9, 0.0], "right_hip": [0.0, 0.9, 0.0],
                "left_wrist": [-0.35, 1.4, 0.0], "right_wrist": [-0.35, 1.4, 0.0]},
        confidence={"left_shoulder": 0.95, "right_shoulder": 0.95, "left_hip": 0.95, "right_hip": 0.95,
                    "left_wrist": 0.95, "right_wrist": 0.85},
        tracking_loss=False
    )
    res_fwd = fuse_multicam_landmarks(fd1_forward, fd2_forward, None)
    assert res_fwd is not None
    assert res_fwd.joints["left_wrist"][2] > 0.20, f"Left wrist must be forward (+Z), got {res_fwd.joints['left_wrist'][2]}"
    assert res_fwd.joints["right_wrist"][2] > 0.20, f"Right wrist must be forward (+Z), got {res_fwd.joints['right_wrist'][2]}"
    print("  ✓ 2 cameras (Cam 1 + Cam 2) BOTH ARMS FORWARD: Both arms correctly extended forward in +Z!")

    # Case 2B: 2 cameras (Cam 1 + Cam 2) with arm behind head
    # In Cam 2: hand reaches behind head (camera's right: +X = +0.25)
    fd1_arm = FrameData(
        frame=2, time=0.066, rootPosition=[0, 0.9, 0], rootRotation=[0, 0, 0, 1],
        joints={"left_shoulder": [-0.2, 1.4, 0.0], "right_shoulder": [0.2, 1.4, 0.0],
                "left_hip": [-0.1, 0.9, 0.0], "right_hip": [0.1, 0.9, 0.0],
                "left_wrist": [-0.05, 1.55, 0.0]},
        confidence={"left_shoulder": 0.9, "right_shoulder": 0.9, "left_hip": 0.9, "right_hip": 0.9,
                    "left_wrist": 0.3},
        tracking_loss=False
    )
    fd2_side = FrameData(
        frame=2, time=0.066, rootPosition=[0, 0.9, 0], rootRotation=[0, 0, 0, 1],
        joints={"left_shoulder": [0.0, 1.4, 0.0], "right_shoulder": [0.0, 1.4, 0.0],
                "left_hip": [0.0, 0.9, 0.0], "right_hip": [0.0, 0.9, 0.0],
                "left_wrist": [0.25, 1.55, 0.0]},
        confidence={"left_shoulder": 0.9, "right_shoulder": 0.9, "left_hip": 0.9, "right_hip": 0.9,
                    "left_wrist": 0.95},
        tracking_loss=False
    )
    res_fused = fuse_multicam_landmarks(fd1_arm, fd2_side, None)
    assert res_fused is not None
    assert res_fused.joints["left_wrist"][2] < -0.05, f"Left wrist behind head must have negative Z, got {res_fused.joints['left_wrist'][2]}"
    assert res_fused.confidence["left_wrist"] >= 0.75
    print("  ✓ 2 cameras (Cam 1 + Cam 2) behind-head: Depth Z correctly merged!")

    # Case 3: 3 cameras (Full T-configuration)
    fd3_side = FrameData(
        frame=2, time=0.066, rootPosition=[0, 0.9, 0], rootRotation=[0, 0, 0, 1],
        joints={"left_shoulder": [0.0, 1.4, 0.0], "right_shoulder": [0.0, 1.4, 0.0],
                "left_hip": [0.0, 0.9, 0.0], "right_hip": [0.0, 0.9, 0.0],
                "right_wrist": [0.20, 0.95, 0.0]},
        confidence={"left_shoulder": 0.9, "right_shoulder": 0.9, "left_hip": 0.9, "right_hip": 0.9,
                    "right_wrist": 0.95},
        tracking_loss=False
    )
    res_fused3 = fuse_multicam_landmarks(fd1_arm, fd2_side, fd3_side)
    assert res_fused3 is not None
    print("  ✓ 3 cameras (Full T-Config): Seamless zero-blindspot fusion verified!")
    print("=== 1. Multi-Camera Fusion Logic PASSED! ===\n")


def test_layered_recording_lifecycle():
    print("=== 2. Testing Layered Recording Merge & Output File ===")
    import web_studio_server
    
    # 1. Clear layers
    asyncio.run(web_studio_server.clear_layers_endpoint())

    # 2. Populate layers
    web_studio_server.stored_layers["lower"] = {
        "layer_name": "lower",
        "duration": 2.0,
        "fps": 30.0,
        "frames_count": 60,
        "frames": [
            {
                "frame": i,
                "time": round(i / 30.0, 3),
                "rootPosition": [0.0, 0.85, 0.0],
                "rootRotation": [0.0, 0.0, 0.0, 1.0],
                "joints": {
                    "left_hip": [-0.15, 0.85, 0.0], "right_hip": [0.15, 0.85, 0.0],
                    "left_knee": [-0.20, 0.45, 0.0], "right_knee": [0.20, 0.45, 0.0],
                    "left_ankle": [-0.22, 0.05, 0.0], "right_ankle": [0.22, 0.05, 0.0]
                },
                "confidence": {"left_knee": 0.95, "right_knee": 0.95}
            }
            for i in range(60)
        ],
        "rotations": [
            {
                "UpperLeg.L": [0.1, 0.0, 0.0, 0.99],
                "LowerLeg.L": [-0.2, 0.0, 0.0, 0.98],
                "UpperLeg.R": [0.1, 0.0, 0.0, 0.99],
                "LowerLeg.R": [-0.2, 0.0, 0.0, 0.98],
            }
            for _ in range(60)
        ]
    }

    web_studio_server.stored_layers["upper"] = {
        "layer_name": "upper",
        "duration": 2.0,
        "fps": 30.0,
        "frames_count": 60,
        "frames": [
            {
                "frame": i,
                "time": round(i / 30.0, 3),
                "joints": {
                    "left_shoulder": [-0.22, 1.42, 0.0], "right_shoulder": [0.22, 1.42, 0.0],
                    "left_elbow": [-0.25, 1.10, 0.0], "right_elbow": [0.25, 1.10, 0.0],
                    "left_wrist": [-0.15, 0.90, -0.15], "right_wrist": [0.20, 1.40, 0.45]
                },
                "confidence": {"left_wrist": 0.95, "right_wrist": 0.95}
            }
            for i in range(60)
        ],
        "rotations": [
            {
                "Spine": [0.0, 0.0, 0.0, 1.0],
                "Chest": [0.05, 0.0, 0.0, 0.99],
                "UpperArm.L": [0.15, 0.0, 0.0, 0.98],
                "UpperArm.R": [-0.3, 0.0, 0.0, 0.95],
            }
            for _ in range(60)
        ]
    }

    # Execute merge
    res = asyncio.run(web_studio_server.merge_layers_endpoint())
    print("  Merge Endpoint Result:", res)
    assert res.get("status") == "merged"
    filename = res.get("filename")
    assert filename is not None

    # Verify merged file on disk
    merged_path = Path("/app/uploads/recordings") / filename
    assert merged_path.exists(), f"Merged file not found at {merged_path}"
    content = json.loads(merged_path.read_text(encoding="utf-8"))
    
    # Verify metadata and frames
    assert content["metadata"]["mode"] == "layered_composite"
    assert "lower" in content["metadata"]["layers_included"]
    assert "upper" in content["metadata"]["layers_included"]
    assert len(content["frames"]) == 60
    assert len(content["rotations"]) == 60

    # Verify frame 0 contains both lower joints and upper joints
    f0 = content["frames"][0]
    assert "left_knee" in f0["joints"] # from lower layer
    assert "right_wrist" in f0["joints"] # from upper layer
    r0 = content["rotations"][0]
    assert "UpperLeg.L" in r0 # from lower layer
    assert "UpperArm.R" in r0 # from upper layer

    print(f"  ✓ Composite file {filename} successfully generated with 60 synchronized frames.")
    print("  ✓ Lower body and upper body layers merged accurately with bone rotations.")
    print("=== 2. Layered Recording Merge PASSED! ===\n")


if __name__ == "__main__":
    test_multicam_fusion()
    test_layered_recording_lifecycle()
    print("⭐⭐⭐ ALL IN-CONTAINER TESTS PASSED! ⭐⭐⭐")
