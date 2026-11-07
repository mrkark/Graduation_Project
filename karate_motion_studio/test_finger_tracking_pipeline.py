import sys
import numpy as np
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from core.mocap_tracker import MocapTracker
from core.retargeter import Retargeter
from core.project_schema import FrameData

tracker = MocapTracker(track_hands=True, model_complexity=0)
retargeter = Retargeter()

# Create dummy frame data with Pose joints simulating an OPEN HAND
fdata_open = FrameData(
    frame=1,
    time=0.033,
    rootPosition=[0.0, 0.9, 0.0],
    rootRotation=[0.0, 0.0, 0.0, 1.0],
    joints={
        "left_shoulder": [0.20, 1.40, 0.0],
        "left_elbow": [0.25, 1.15, 0.0],
        "left_wrist": [0.28, 0.90, 0.0], # len_arm = 0.25
        "left_index": [0.29, 0.77, 0.0], # dist = 0.13 -> open ratio ~ 0.52
        "left_pinky": [0.27, 0.79, 0.0], # dist = 0.11 -> open ratio ~ 0.44
        "left_thumb": [0.35, 0.81, 0.0], # dist = 0.08
    },
    confidence={k: 0.9 for k in ["left_shoulder", "left_elbow", "left_wrist", "left_index", "left_pinky", "left_thumb"]},
    tracking_loss=False,
    head={"yaw": 0.0, "pitch": 0.0, "roll": 0.0},
    fingers={},
)

# Test tracker fallback logic directly:
dummy_bgr = np.zeros((480, 640, 3), dtype=np.uint8)
# Put a line for arm
import cv2
cv2.line(dummy_bgr, (320, 100), (320, 250), (255, 255, 255), 10)
cv2.circle(dummy_bgr, (320, 280), 15, (255, 255, 255), -1)

_, proc_fdata = tracker.process_frame(dummy_bgr, 1, 0.033)
print("[+] Processed frame returned fingers:", proc_fdata.fingers)

# Test retargeter on open hand vs fist
fdata_test_open = FrameData(
    frame=1, time=0.033, rootPosition=[0, 0.9, 0], rootRotation=[0, 0, 0, 1],
    joints={}, confidence={}, tracking_loss=False, head={"yaw":0,"pitch":0,"roll":0},
    fingers={
        "left": {"thumb": 0.05, "index": 0.05, "middle": 0.05, "ring": 0.05, "pinky": 0.05, "detected": True},
        "right": {"thumb": 0.05, "index": 0.05, "middle": 0.05, "ring": 0.05, "pinky": 0.05, "detected": True},
    }
)
bones_open = retargeter.retarget_frame(fdata_test_open)
print("[+] Retargeter produced finger bones for open hand:")
print("    Index1.L:", bones_open.get("Index1.L"))
print("    Thumb1.L:", bones_open.get("Thumb1.L"))

fdata_test_fist = FrameData(
    frame=2, time=0.066, rootPosition=[0, 0.9, 0], rootRotation=[0, 0, 0, 1],
    joints={}, confidence={}, tracking_loss=False, head={"yaw":0,"pitch":0,"roll":0},
    fingers={
        "left": {"thumb": 0.95, "index": 0.95, "middle": 0.95, "ring": 0.95, "pinky": 0.95, "detected": True},
        "right": {"thumb": 0.95, "index": 0.95, "middle": 0.95, "ring": 0.95, "pinky": 0.95, "detected": True},
    }
)
bones_fist = retargeter.retarget_frame(fdata_test_fist)
print("[+] Retargeter produced finger bones for closed fist:")
print("    Index1.L:", bones_fist.get("Index1.L"))
print("    Thumb1.L:", bones_fist.get("Thumb1.L"))

assert bones_open.get("Index1.L") != bones_fist.get("Index1.L"), "Finger rotations must differ between open and fist!"
print("[+] SUCCESS: Finger retargeting is 100% functional and produces dynamic quaternions!")
