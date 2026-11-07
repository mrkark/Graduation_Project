"""
Unified Motion Capture Tracker for Karate Motion Studio.
Handles both Mode A (Offline Video File Analysis) and Mode B (Real-time Webcam Capture & Recording)
with MediaPipe Pose 3D, MediaPipe Hands, posture calibration, and accurate timestamps.
"""
from __future__ import annotations
import os
import sys
import time
import math
import threading
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple, Callable

class SilenceStderr:
    def __enter__(self):
        try:
            sys.stderr.flush()
            self.null_fd = os.open(os.devnull, os.O_WRONLY)
            self.orig_stderr = os.dup(2)
            os.dup2(self.null_fd, 2)
        except Exception:
            self.null_fd = None
            self.orig_stderr = None

    def __exit__(self, *args):
        try:
            if self.orig_stderr is not None:
                os.dup2(self.orig_stderr, 2)
                os.close(self.orig_stderr)
            if self.null_fd is not None:
                os.close(self.null_fd)
        except Exception:
            pass


import cv2
import mediapipe as mp
import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from gui.draw_utils import draw_text_utf8, draw_badge_utf8
except Exception:
    draw_text_utf8 = None
    draw_badge_utf8 = None

from core.project_schema import (
    STANDARD_JOINTS,
    FrameData,
    Metadata,
    KarateMotionProject,
)
from core.filters import Vector3DOneEuroFilter, Vector2DOneEuroFilter, OneEuroFilter, AdaptiveKarateKimeFilter, BoneLengthStabilizer, ContinuousAzimuthUnwrapper


def calculate_joint_angle_deg(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    """Calculates the angle between vector (a - b) and (c - b) in degrees."""
    v1 = a - b
    v2 = c - b
    n1 = float(np.linalg.norm(v1))
    n2 = float(np.linalg.norm(v2))
    if n1 < 1e-4 or n2 < 1e-4:
        return 180.0
    cos_angle = np.clip(np.dot(v1, v2) / (n1 * n2), -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_angle)))


def analyze_karate_biomechanics(joints: Dict[str, List[float]]) -> Dict[str, Any]:
    """
    Performs comprehensive real-time biomechanical analysis of Shotokan Karate stances,
    strikes, blocks, joint angles, and foot-floor grounding.
    Returns:
        stance, technique, knee_l, knee_r, elbow_l, elbow_r, score (0-100),
        grounded_l, grounded_r, lead_leg, stance_width, kime_active
    """
    res = {
        "stance": "Йой-дати (Готовность)",
        "technique": "Позиция ожидания",
        "knee_l": 175.0,
        "knee_r": 175.0,
        "elbow_l": 90.0,
        "elbow_r": 90.0,
        "score": 92,
        "grounded_l": True,
        "grounded_r": True,
        "lead_leg": "Нейтральная",
        "stance_width": 0.35,
        "kime_active": False,
        "pelvis_yaw": 0.0,
    }
    if not joints:
        return res

    get_pt = lambda name: np.array(joints[name]) if name in joints else None

    l_hip, r_hip = get_pt("left_hip"), get_pt("right_hip")
    l_knee, r_knee = get_pt("left_knee"), get_pt("right_knee")
    l_ankle, r_ankle = get_pt("left_ankle"), get_pt("right_ankle")
    l_sh, r_sh = get_pt("left_shoulder"), get_pt("right_shoulder")
    l_el, r_el = get_pt("left_elbow"), get_pt("right_elbow")
    l_wr, r_wr = get_pt("left_wrist"), get_pt("right_wrist")
    l_toe = get_pt("left_foot_index")
    r_toe = get_pt("right_foot_index")

    if l_hip is not None and l_knee is not None and l_ankle is not None:
        res["knee_l"] = round(calculate_joint_angle_deg(l_hip, l_knee, l_ankle), 1)
    if r_hip is not None and r_knee is not None and r_ankle is not None:
        res["knee_r"] = round(calculate_joint_angle_deg(r_hip, r_knee, r_ankle), 1)
    if l_sh is not None and l_el is not None and l_wr is not None:
        res["elbow_l"] = round(calculate_joint_angle_deg(l_sh, l_el, l_wr), 1)
    if r_sh is not None and r_el is not None and r_wr is not None:
        res["elbow_r"] = round(calculate_joint_angle_deg(r_sh, r_el, r_wr), 1)

    kl = res["knee_l"]
    kr = res["knee_r"]
    el = res["elbow_l"]
    er = res["elbow_r"]

    # Calculate spatial parameters
    sh_width = float(np.linalg.norm(l_sh - r_sh)) if (l_sh is not None and r_sh is not None) else 0.38
    feet_dist = float(np.linalg.norm(l_ankle - r_ankle)) if (l_ankle is not None and r_ankle is not None) else 0.30
    res["stance_width"] = round(feet_dist, 2)

    # Foot elevation / Grounding detection
    hip_y = (l_hip[1] + r_hip[1]) * 0.5 if (l_hip is not None and r_hip is not None) else 0.9
    l_foot_y = l_ankle[1] if l_ankle is not None else 0.0
    r_foot_y = r_ankle[1] if r_ankle is not None else 0.0
    floor_est = min(l_foot_y, r_foot_y) if (l_ankle is not None and r_ankle is not None) else 0.0

    res["grounded_l"] = bool(l_ankle is not None and (l_ankle[1] - floor_est) < 0.12)
    res["grounded_r"] = bool(r_ankle is not None and (r_ankle[1] - floor_est) < 0.12)

    # Pelvis orientation (Yaw)
    if l_hip is not None and r_hip is not None:
        v_hips = l_hip - r_hip
        yaw_rad = math.atan2(v_hips[2], max(1e-4, abs(v_hips[0])))
        res["pelvis_yaw"] = round(float(math.degrees(yaw_rad)), 1)

    # 1. Kicking Check (Mae-Geri)
    is_left_kick = (l_knee is not None and l_hip is not None and l_knee[1] > l_hip[1] - 0.22 and kl > 120 and (l_ankle is not None and l_ankle[1] > floor_est + 0.35))
    is_right_kick = (r_knee is not None and r_hip is not None and r_knee[1] > r_hip[1] - 0.22 and kr > 120 and (r_ankle is not None and r_ankle[1] > floor_est + 0.35))
    if is_left_kick or is_right_kick:
        side_k = "левой" if is_left_kick else "правой"
        res["stance"] = f"Удар ногой ({side_k})"
        res["technique"] = f"Маэ-гэри ({side_k} ногой)"
        res["score"] = 96
        if is_left_kick:
            res["grounded_l"] = False
        if is_right_kick:
            res["grounded_r"] = False
        return res

    # 2. Shotokan Stance Detection
    # Longitudinal feet separation along Z (depth) and lateral separation along X
    dz_feet = abs(l_ankle[2] - r_ankle[2]) if (l_ankle is not None and r_ankle is not None) else 0.0
    dx_feet = abs(l_ankle[0] - r_ankle[0]) if (l_ankle is not None and r_ankle is not None) else 0.0

    # A) Kiba-dachi (Horse Riding Stance / Всадник):
    # Wide lateral stance (> 1.25x shoulder width), knees bent outwards (~105°-138°), feet parallel
    if (100 <= kl <= 138 and 100 <= kr <= 138) and dx_feet > max(0.48, sh_width * 1.25) and dz_feet < 0.32:
        res["stance"] = "Киба-дати (Всадник)"
        avg_knee = (kl + kr) / 2
        # Ideal knee flexion in competition Kiba-dachi is ~115°
        res["score"] = max(65, min(99, int(100 - abs(avg_knee - 115) * 1.5)))
        res["lead_leg"] = "Обе ноги"

    # B) Zenkutsu-dachi (Front Forward Stance):
    # One leg deeply bent (90°-128°), rear leg extended (150°-180°), long longitudinal base
    elif (kl < 130 and kr > 148) or (kr < 130 and kl > 148):
        lead_left = (kl < kr)
        lead_leg = "Левая" if lead_left else "Правая"
        lead_knee = kl if lead_left else kr
        rear_knee = kr if lead_left else kl
        res["lead_leg"] = lead_leg

        # Distinguish between Zenkutsu-dachi and Fudo-dachi (Sochin-dachi)
        # In Fudo-dachi, both knees are bent, but front is ~115° and rear is ~135-148°
        if rear_knee < 152 and lead_knee > 110:
            res["stance"] = f"Фудо-дати ({lead_leg})"
            res["score"] = 94
        else:
            res["stance"] = f"Дзэнкуцу-дати ({lead_leg})"
            # Sensei scoring: front knee over ankle ~98°, rear leg locked straight ~170°
            score_lead = 100 - abs(lead_knee - 98) * 1.3
            score_rear = 100 - abs(rear_knee - 170) * 1.1
            res["score"] = max(60, min(99, int(0.6 * score_lead + 0.4 * score_rear)))

    # C) Kokutsu-dachi (Back Defense Stance):
    # Rear leg carries 70% weight (knee bent ~110°-138°), front leg extended with light contact
    elif (kl > 142 and 110 <= kr <= 140) or (kr > 142 and 110 <= kl <= 140):
        # In Kokutsu-dachi, the rear leg is the one bent, front is extended forward
        # Determine which foot is rear based on Z depth
        if l_ankle is not None and r_ankle is not None:
            if l_ankle[2] < r_ankle[2] - 0.10: # Left foot behind
                rear_leg = "Левая"
            elif r_ankle[2] < l_ankle[2] - 0.10: # Right foot behind
                rear_leg = "Правая"
            else:
                rear_leg = "Левая" if kl < kr else "Правая"
        else:
            rear_leg = "Левая" if kl < kr else "Правая"

        res["stance"] = f"Кокуцу-дати ({rear_leg} сзади)"
        res["score"] = 93
        res["lead_leg"] = "Правая" if rear_leg == "Левая" else "Левая"

    # D) Shizentai / Yoi-dachi (Natural Ready Stance):
    elif kl >= 155 and kr >= 155:
        res["stance"] = "Йой-дати (Готовность)"
        res["score"] = 95
        res["lead_leg"] = "Нейтральная"
    else:
        res["stance"] = "Камаэ / Переходная стойка"
        res["score"] = 90

    # 3. Shotokan Techniques & Arm Actions Detection
    # Check for Kime explosive punch
    is_punch_r = (er > 152 and el < 105)
    is_punch_l = (el > 152 and er < 105)

    if is_punch_r or is_punch_l:
        p_side = "правой" if is_punch_r else "левой"
        # Determine if Oi-zuki (same side as lead leg) or Gyaku-zuki (reverse side)
        is_gyaku = (is_punch_r and "Левая" in res["lead_leg"]) or (is_punch_l and "Правая" in res["lead_leg"])
        t_name = "Гяку-цуки" if is_gyaku else "Ой-цуки"
        res["technique"] = f"{t_name} {p_side}"
        res["kime_active"] = True
        res["score"] = min(99, res["score"] + 3)

    elif (l_wr is not None and l_sh is not None and l_wr[1] > l_sh[1] + 0.05) or \
         (r_wr is not None and r_sh is not None and r_wr[1] > r_sh[1] + 0.05):
        side_b = "левой" if (l_wr is not None and l_sh is not None and l_wr[1] > l_sh[1] + 0.05) else "правой"
        res["technique"] = f"Агэ-укэ ({side_b} верхний блок)"
        res["score"] = min(99, res["score"] + 2)

    elif (l_wr is not None and l_hip is not None and l_wr[1] < l_hip[1] - 0.05 and 130 <= el <= 170) or \
         (r_wr is not None and r_hip is not None and r_wr[1] < r_hip[1] - 0.05 and 130 <= er <= 170):
        side_b = "левой" if (l_wr is not None and l_hip is not None and l_wr[1] < l_hip[1] - 0.05) else "правой"
        res["technique"] = f"Гэдан-барай ({side_b} нижний блок)"
        res["score"] = min(99, res["score"] + 2)

    elif (80 <= el <= 118 and l_wr is not None and l_sh is not None and abs(l_wr[1] - l_sh[1]) < 0.18 and l_wr[0] > l_el[0] - 0.05):
        res["technique"] = "Сото-укэ (Блок снаружи)"
    elif (80 <= er <= 118 and r_wr is not None and r_sh is not None and abs(r_wr[1] - r_sh[1]) < 0.18 and r_wr[0] < r_el[0] + 0.05):
        res["technique"] = "Сото-укэ (Блок снаружи)"
    elif "Кокуцу" in res["stance"] and (el < 115 or er < 115):
        res["technique"] = "Сюто-укэ (Блок ребром ладони)"
    elif el < 95 and er < 95:
        res["technique"] = "Хикитэ / Камаэ"

    return res


# MediaPipe Pose Landmark Indices
POSE_LM = {name: idx for idx, name in enumerate(STANDARD_JOINTS)}

POSE_DRAW_CONNECTIONS = [
    # Torso
    ("left_shoulder", "right_shoulder", (255, 100, 100)),
    ("left_shoulder", "left_hip", (255, 100, 100)),
    ("right_shoulder", "right_hip", (255, 100, 100)),
    ("left_hip", "right_hip", (255, 100, 100)),
    # Left Arm
    ("left_shoulder", "left_elbow", (0, 220, 255)),
    ("left_elbow", "left_wrist", (0, 220, 255)),
    # Right Arm
    ("right_shoulder", "right_elbow", (255, 150, 0)),
    ("right_elbow", "right_wrist", (255, 150, 0)),
    # Left Leg & Foot
    ("left_hip", "left_knee", (180, 100, 255)),
    ("left_knee", "left_ankle", (180, 100, 255)),
    ("left_ankle", "left_heel", (180, 100, 255)),
    ("left_heel", "left_foot_index", (180, 100, 255)),
    ("left_ankle", "left_foot_index", (180, 100, 255)),
    # Right Leg & Foot
    ("right_hip", "right_knee", (255, 100, 180)),
    ("right_knee", "right_ankle", (255, 100, 180)),
    ("right_ankle", "right_heel", (255, 100, 180)),
    ("right_heel", "right_foot_index", (255, 100, 180)),
    ("right_ankle", "right_foot_index", (255, 100, 180)),
    # Collarbones / Neck
    ("nose", "left_shoulder", (200, 200, 200)),
    ("nose", "right_shoulder", (200, 200, 200)),
]

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),        # Thumb
    (0, 5), (5, 6), (6, 7), (7, 8),        # Index
    (5, 9), (9, 10), (10, 11), (11, 12),   # Middle
    (9, 13), (13, 14), (14, 15), (15, 16), # Ring
    (13, 17), (17, 18), (18, 19), (19, 20),# Pinky
    (0, 17),                               # Palm base
]


def calc_finger_curl(
    mcp: np.ndarray,
    pip: np.ndarray,
    dip: np.ndarray,
    tip: np.ndarray,
    wrist: Optional[np.ndarray] = None,
) -> float:
    """Calculate normalized curl (0.0=open, 1.0=fully clenched) from joint angles and tip distance."""
    v1 = pip - mcp
    v2 = dip - pip
    v3 = tip - dip
    n1 = float(np.linalg.norm(v1))
    n2 = float(np.linalg.norm(v2))
    n3 = float(np.linalg.norm(v3))
    if n1 < 1e-6 or n2 < 1e-6 or n3 < 1e-6:
        return 0.15

    dot1 = float(np.clip(np.dot(v1, v2) / (n1 * n2), -1.0, 1.0))
    ang1 = math.degrees(math.acos(dot1))

    dot2 = float(np.clip(np.dot(v2, v3) / (n2 * n3), -1.0, 1.0))
    ang2 = math.degrees(math.acos(dot2))

    if wrist is not None:
        v0 = mcp - wrist
        n0 = float(np.linalg.norm(v0))
        dot0 = float(np.clip(np.dot(v0, v1) / (n0 * n1 + 1e-6), -1.0, 1.0))
        ang0 = math.degrees(math.acos(dot0))
        total_ang = ang0 * 0.40 + ang1 * 0.85 + ang2 * 0.80
    else:
        total_ang = ang1 * 0.90 + ang2 * 0.90

    finger_len = n1 + n2 + n3
    dist_tip_mcp = float(np.linalg.norm(tip - mcp))
    dist_curl = 1.0 - float(np.clip((dist_tip_mcp - finger_len * 0.10) / (finger_len * 0.72 + 1e-6), 0.0, 1.0))

    ang_curl = float(np.clip(total_ang / 125.0, 0.0, 1.0))
    raw_curl = 0.5 * ang_curl + 0.5 * dist_curl

    # Highly responsive curve: sensitive to fine finger twitches and clenches tight to 1.0!
    curl = raw_curl ** 0.82
    if curl > 0.38:
        curl = 0.38 + (curl - 0.38) * 1.68
    return float(np.clip(curl, 0.0, 1.0))


def calc_thumb_curl(
    cmc: np.ndarray,
    mcp: np.ndarray,
    ip: np.ndarray,
    tip: np.ndarray,
    wrist: np.ndarray,
    index_mcp: Optional[np.ndarray] = None,
) -> float:
    """Calculate thumb flexion and adduction across palm."""
    v1 = mcp - cmc
    v2 = tip - ip
    n1 = float(np.linalg.norm(v1))
    n2 = float(np.linalg.norm(v2))
    if n1 < 1e-6 or n2 < 1e-6:
        return 0.15

    dot = float(np.clip(np.dot(v1, v2) / (n1 * n2), -1.0, 1.0))
    angle = math.degrees(math.acos(dot))
    ang_curl = float(np.clip(angle / 68.0, 0.0, 1.0))

    if index_mcp is not None:
        thumb_len = n1 + float(np.linalg.norm(ip - mcp)) + n2
        dist_to_index = float(np.linalg.norm(tip - index_mcp))
        adduct_curl = float(np.clip((thumb_len * 1.25 - dist_to_index) / (thumb_len * 0.75 + 1e-6), 0.0, 1.0))
        curl = 0.40 * ang_curl + 0.60 * adduct_curl
    else:
        curl = ang_curl

    if curl > 0.32:
        curl = 0.32 + (curl - 0.32) * 1.70
    return float(np.clip(curl, 0.0, 1.0))


def calc_phalanx_angles(
    mcp: np.ndarray,
    pip: np.ndarray,
    dip: np.ndarray,
    tip: np.ndarray,
    wrist: np.ndarray,
    u_across: np.ndarray,
) -> Tuple[List[float], float]:
    """
    Computes individual phalanx flexion angles [flex_mcp, flex_pip, flex_dip] in radians,
    and lateral abduction (spread) angle in radians.
    """
    v0 = mcp - wrist
    v1 = pip - mcp
    v2 = dip - pip
    v3 = tip - dip

    def _angle(a: np.ndarray, b: np.ndarray) -> float:
        na = float(np.linalg.norm(a))
        nb = float(np.linalg.norm(b))
        if na < 1e-6 or nb < 1e-6:
            return 0.0
        dot = float(np.clip(np.dot(a, b) / (na * nb), -1.0, 1.0))
        return float(math.acos(dot))

    flex_mcp = _angle(v0, v1)
    flex_pip = _angle(v1, v2)
    flex_dip = _angle(v2, v3)

    # Abduction: lateral spread in palm plane
    nv1 = float(np.linalg.norm(v1))
    abd = 0.0
    if nv1 > 1e-6:
        v1_dir = v1 / nv1
        abd = float(np.dot(v1_dir, u_across))

    return [round(flex_mcp, 3), round(flex_pip, 3), round(flex_dip, 3)], round(abd, 3)


def calc_thumb_phalanx_angles(
    cmc: np.ndarray,
    mcp: np.ndarray,
    ip: np.ndarray,
    tip: np.ndarray,
    wrist: np.ndarray,
    index_mcp: Optional[np.ndarray] = None,
) -> Tuple[List[float], float]:
    """
    Computes thumb phalanx flexion angles [cmc_flex, mcp_flex, ip_flex] in radians,
    and thumb opposition across palm [0.0..1.0].
    """
    v0 = cmc - wrist
    v1 = mcp - cmc
    v2 = ip - mcp
    v3 = tip - ip

    def _angle(a: np.ndarray, b: np.ndarray) -> float:
        na = float(np.linalg.norm(a))
        nb = float(np.linalg.norm(b))
        if na < 1e-6 or nb < 1e-6:
            return 0.0
        dot = float(np.clip(np.dot(a, b) / (na * nb), -1.0, 1.0))
        return float(math.acos(dot))

    cmc_flex = _angle(v0, v1)
    mcp_flex = _angle(v1, v2)
    ip_flex = _angle(v2, v3)

    # Opposition: thumb tip distance to index MCP
    opp = 0.0
    if index_mcp is not None:
        thumb_len = float(np.linalg.norm(v1) + np.linalg.norm(v2) + np.linalg.norm(v3))
        d_idx = float(np.linalg.norm(tip - index_mcp))
        opp = float(np.clip(1.0 - (d_idx / (thumb_len * 1.1 + 1e-6)), 0.0, 1.0))

    return [round(cmc_flex, 3), round(mcp_flex, 3), round(ip_flex, 3)], round(opp, 3)


def estimate_fist_curl_from_pose(wrist: List[float], index: List[float], elbow: List[float]) -> float:
    """Estimate hand clench/curl from MediaPipe Pose wrist-to-index distance ratio."""
    d_hand = math.sqrt(sum((index[i] - wrist[i]) ** 2 for i in range(3)))
    d_arm = math.sqrt(sum((wrist[i] - elbow[i]) ** 2 for i in range(3)))
    if d_arm < 1e-4:
        return 0.15
    ratio = d_hand / d_arm
    # Hand open: ratio ~ 0.60 - 0.75; Fist closed: ratio ~ 0.30 - 0.45
    curl = (0.62 - ratio) / (0.62 - 0.38)
    return float(np.clip(curl, 0.0, 1.0))


class MocapTracker:
    """Unified Motion Capture Tracker using MediaPipe Pose & Hands."""

    def __init__(self, track_hands: bool = True, model_complexity: int = 0):
        self.track_hands = track_hands
        self.model_complexity = model_complexity

        # MediaPipe models
        with SilenceStderr():
            if track_hands:
                # MediaPipe Holistic: simultaneously tracks 33 Body Pose & 21-joint Left/Right Hands
                # with internal ROI cropping and zero-drift tracking!
                self.holistic = mp.solutions.holistic.Holistic(
                    static_image_mode=False,
                    model_complexity=model_complexity,
                    smooth_landmarks=True,
                    enable_segmentation=False,
                    refine_face_landmarks=False,
                    min_detection_confidence=0.40,
                    min_tracking_confidence=0.40,
                )
                self.mp_pose = None
                self.mp_hands = None
            else:
                self.holistic = None
                self.mp_pose = mp.solutions.pose.Pose(
                    static_image_mode=False,
                    model_complexity=model_complexity,
                    smooth_landmarks=True,
                    enable_segmentation=False,
                    min_detection_confidence=0.45,
                    min_tracking_confidence=0.45,
                )
                self.mp_hands = None

        # Real-time 1€ filter per joint: low min_cutoff stops static arm jitter; beta provides instant strike response
        # 2D Screen landmark temporal filters to eliminate side camera video bone jitter
        self.landmark_2d_filters: Dict[str, Vector2DOneEuroFilter] = {
            name: Vector2DOneEuroFilter(freq=30.0, min_cutoff=0.8, beta=0.04)
            for name in POSE_LM.keys()
        }
        self.joint_filters: Dict[str, Vector3DOneEuroFilter] = {
            name: Vector3DOneEuroFilter(
                freq=30.0,
                min_cutoff=0.35,
                beta=0.35 if ("wrist" in name or "elbow" in name or "index" in name or "pinky" in name) else 0.15,
            )
            for name in STANDARD_JOINTS
        }

        # Anatomical Bone Length Stabilizer & Karate Kime Filters
        self.bone_stabilizer = BoneLengthStabilizer(adaptation_frames=20)
        self.kime_filters: Dict[str, AdaptiveKarateKimeFilter] = {
            name: AdaptiveKarateKimeFilter(freq=30.0, base_cutoff=0.8, max_cutoff=45.0)
            for name in [
                "left_wrist", "right_wrist",
                "left_elbow", "right_elbow",
                "left_ankle", "right_ankle",
                "left_foot_index", "right_foot_index",
            ]
        }

        # Temporal smoothing for fingers
        self.finger_smooth: Dict[str, Dict[str, float]] = {
            "left": {"thumb": 0.15, "index": 0.15, "middle": 0.15, "ring": 0.15, "pinky": 0.15},
            "right": {"thumb": 0.15, "index": 0.15, "middle": 0.15, "ring": 0.15, "pinky": 0.15},
        }

        # Head Metsuke posture calibration & smoothing
        self.calibrated = False
        self.calib_samples: List[Tuple[float, float, float]] = []
        self.base_pitch: Optional[float] = None
        self.base_yaw: float = 0.0
        self.base_roll: float = 0.0
        self.head_pitch_filter = OneEuroFilter(freq=30.0, min_cutoff=0.4, beta=0.15)
        self.head_yaw_filter = OneEuroFilter(freq=30.0, min_cutoff=0.4, beta=0.15)
        self.head_roll_filter = OneEuroFilter(freq=30.0, min_cutoff=0.4, beta=0.15)

    def calibrate(self):
        """Reset head baseline posture calibration and filter states."""
        self.calibrated = False
        self.calib_samples = []
        self.base_pitch = None
        self.base_yaw = 0.0
        self.base_roll = 0.0
        self.head_pitch_filter.reset()
        self.head_yaw_filter.reset()
        self.head_roll_filter.reset()
        for f in self.joint_filters.values():
            f.reset()
        for f in self.landmark_2d_filters.values():
            f.reset()
        self.bone_stabilizer.reset()
        for f in self.kime_filters.values():
            f.reset()


    def process_frame(
        self,
        frame_bgr: np.ndarray,
        frame_idx: int,
        timestamp: float,
        mirror: bool = False,
        draw_skeleton: bool = True,
        fps: float = 0.0,
    ) -> Tuple[np.ndarray, FrameData]:
        """
        Processes a single BGR frame.
        Returns:
            processed_frame: BGR frame (mirrored if requested, with anti-aliased OpenCV skeleton overlay)
            frame_data: standard FrameData
        """
        # Always feed original natural frame_bgr to MediaPipe so anatomical Left and Right are NEVER swapped
        h, w = frame_bgr.shape[:2]

        # 1:1 Square padding (letterboxing) to satisfy MediaPipe square ROI
        dim_max = max(h, w)
        pad_top = (dim_max - h) // 2
        pad_bottom = dim_max - h - pad_top
        pad_left = (dim_max - w) // 2
        pad_right = dim_max - w - pad_left

        frame_square = cv2.copyMakeBorder(
            frame_bgr, pad_top, pad_bottom, pad_left, pad_right, cv2.BORDER_CONSTANT, value=[0, 0, 0]
        )
        rgb_square = cv2.cvtColor(frame_square, cv2.COLOR_BGR2RGB)

        # High-Speed Optimization: Scale square frame to 480x480 for real-time inference (< 14ms)
        # MediaPipe Pose internally infers on 256x256, so 480x480 preserves full accuracy while doubling FPS!
        target_inference_size = 480
        if dim_max > target_inference_size:
            rgb_inference = cv2.resize(rgb_square, (target_inference_size, target_inference_size), interpolation=cv2.INTER_LINEAR)
        else:
            rgb_inference = rgb_square

        # 1. Process Body Pose and Hands (MediaPipe Holistic or Pose)
        with SilenceStderr():
            if self.track_hands and self.holistic is not None:
                res = self.holistic.process(rgb_inference)
                res_pose = res
                res_left_hand = res.left_hand_landmarks
                res_right_hand = res.right_hand_landmarks
            else:
                res_pose = self.mp_pose.process(rgb_inference)
                res_left_hand = None
                res_right_hand = None

        # Display frame: flip horizontally if mirror requested for selfie display
        display_frame = cv2.flip(frame_bgr, 1) if mirror else frame_bgr.copy()

        frame_data = FrameData(
            frame=frame_idx,
            time=round(timestamp, 4),
            rootPosition=[0.0, 0.9, 0.0],
            rootRotation=[0.0, 0.0, 0.0, 1.0],
            joints={},
            confidence={},
            tracking_loss=True,
            head={"yaw": 0.0, "pitch": 0.0, "roll": 0.0},
            fingers={
                "left": {"thumb": 0.15, "index": 0.15, "middle": 0.15, "ring": 0.15, "pinky": 0.15, "detected": False},
                "right": {"thumb": 0.15, "index": 0.15, "middle": 0.15, "ring": 0.15, "pinky": 0.15, "detected": False},
            },
        )

        raw_pts_2d_unmirrored: Dict[str, List[float]] = {}

        if res_pose and res_pose.pose_world_landmarks and res_pose.pose_landmarks:
            frame_data.tracking_loss = False
            lm_world = res_pose.pose_world_landmarks.landmark

            raw_pts_3d: Dict[str, List[float]] = {}
            vis_dict: Dict[str, float] = {}

            # Three.js coordinates: X right, Y up, Z forward (towards camera)
            for name, idx in POSE_LM.items():
                if idx < len(lm_world):
                    p = lm_world[idx]
                    x = p.x
                    y = -p.y
                    z = -p.z
                    raw_pts_3d[name] = [round(float(x), 4), round(float(y), 4), round(float(z), 4)]
                    vis_dict[name] = round(float(p.visibility), 3)

            # Anatomical Torso Clearance:
            # When arms cross in front of the chest (blocks, strikes, chambers), monocular depth
            # estimation can erroneously predict negative Z values (placing wrists/elbows behind the spine),
            # causing the forearm to pierce backwards through the ribcage and dislocate the shoulder.
            # Anatomical Torso Clearance (3D Line Segment Projection):
            # Enforces that arm joints crossing in front of the chest stay physically in front of the sternum.
            # Uses true 3D projection onto the spine line segment (mid_hip -> mid_shoulder) so it works
            # identically whether standing tall, bending forward, or twisting, and leaves hands free to
            # naturally touch thighs, knees, and shins (t < 0.20).
            if (
                "left_shoulder" in raw_pts_3d
                and "right_shoulder" in raw_pts_3d
                and "left_hip" in raw_pts_3d
                and "right_hip" in raw_pts_3d
            ):
                l_sh = np.array(raw_pts_3d["left_shoulder"])
                r_sh = np.array(raw_pts_3d["right_shoulder"])
                l_hp = np.array(raw_pts_3d["left_hip"])
                r_hp = np.array(raw_pts_3d["right_hip"])

                mid_sh = (l_sh + r_sh) * 0.5
                mid_hp = (l_hp + r_hp) * 0.5
                v_spine = mid_sh - mid_hp
                spine_len_sq = float(np.dot(v_spine, v_spine))

                if spine_len_sq > 1e-4:
                    uy = v_spine / math.sqrt(spine_len_sq)
                    v_lat = l_sh - r_sh
                    ux = v_lat - float(np.dot(v_lat, uy)) * uy
                    ux_norm = float(np.linalg.norm(ux))
                    if ux_norm > 1e-4:
                        ux /= ux_norm
                        uz = np.cross(ux, uy)  # Chest forward normal from spine through sternum
                        ribcage_half_width = float(np.linalg.norm(v_lat)) * 0.60

                        for arm_j in ["left_elbow", "left_wrist", "right_elbow", "right_wrist", "left_index", "right_index"]:
                            if arm_j in raw_pts_3d:
                                pt = np.array(raw_pts_3d[arm_j])
                                v_pt = pt - mid_hp
                                t = float(np.dot(v_pt, v_spine) / spine_len_sq)

                                # Only apply to thoracic spine / ribcage (t in [0.20, 1.08]).
                                # Pelvis, groin, and legs (t < 0.20) are left completely free so hands can touch knees and legs.
                                if 0.20 <= t <= 1.08:
                                    spine_center = mid_hp + t * v_spine
                                    delta = pt - spine_center
                                    dist_lateral = abs(float(np.dot(delta, ux)))

                                    if dist_lateral < ribcage_half_width:
                                        dist_along_normal = float(np.dot(delta, uz))
                                        min_clearance = 0.16  # 16 cm clearance in front of spine to prevent arms cutting into kimono
                                        # Arm behind head detection: when arm is elevated above shoulder line and passing behind neck/head,
                                        # do not push forward into the face!
                                        is_behind_head = (t >= 0.88 and pt[1] > (l_sh[1] + r_sh[1]) * 0.5 - 0.05 and dist_along_normal < -0.02)
                                        if not is_behind_head and dist_along_normal < min_clearance:
                                            cleared_pt = pt + (min_clearance - dist_along_normal) * uz
                                            raw_pts_3d[arm_j] = [
                                                round(float(cleared_pt[0]), 4),
                                                round(float(cleared_pt[1]), 4),
                                                round(float(cleared_pt[2]), 4),
                                            ]

            # 1. Anatomical Bone Length Invariance Constraint
            # Stabilizes limb lengths (shoulders, forearms, thighs, shins, torso) against foreshortening
            stabilized_pts_3d = self.bone_stabilizer.stabilize_joints(raw_pts_3d, vis_dict)

            # 2. Shotokan Kime Adaptive Filtering (Low speed = jitter suppression; High speed = zero lag)
            pts_3d: Dict[str, List[float]] = {}
            for name, p in stabilized_pts_3d.items():
                if name in self.kime_filters:
                    pts_3d[name] = self.kime_filters[name].filter(p, timestamp)
                elif name in self.joint_filters:
                    pts_3d[name] = self.joint_filters[name].filter(p, timestamp)
                else:
                    pts_3d[name] = p

            frame_data.raw_joints = raw_pts_3d

            frame_data.joints = pts_3d
            frame_data.confidence = vis_dict

            # 2D Screen Landmarks (mapped back to unpadded frame coordinates in [0, 1], mirrored if display is mirrored)
            lm_2d = res_pose.pose_landmarks.landmark
            pts_2d: Dict[str, List[float]] = {}
            for name, idx in POSE_LM.items():
                if idx < len(lm_2d):
                    p2 = lm_2d[idx]
                    nx = (p2.x * dim_max - pad_left) / max(1, w)
                    ny = (p2.y * dim_max - pad_top) / max(1, h)
                    raw_pts_2d_unmirrored[name] = [float(nx), float(ny)]
                    if mirror:
                        nx = 1.0 - nx
                    clamped_2d = [float(np.clip(nx, 0.0, 1.0)), float(np.clip(ny, 0.0, 1.0))]
                    if name in self.landmark_2d_filters:
                        filtered_2d = self.landmark_2d_filters[name].filter(clamped_2d, timestamp)
                    else:
                        filtered_2d = clamped_2d
                    pts_2d[name] = [round(filtered_2d[0], 4), round(filtered_2d[1], 4)]
            frame_data.landmarks_2d = pts_2d

            # Root Position (Hips Center)
            if "left_hip" in pts_3d and "right_hip" in pts_3d:
                l_hip = pts_3d["left_hip"]
                r_hip = pts_3d["right_hip"]
                root_x = (l_hip[0] + r_hip[0]) * 0.5
                root_y = (l_hip[1] + r_hip[1]) * 0.5 + 0.9  # standing offset
                root_z = (l_hip[2] + r_hip[2]) * 0.5
                frame_data.rootPosition = [round(root_x, 4), round(root_y, 4), round(root_z, 4)]

            # Head Rotation (Metsuke gaze with baseline calibration)
            if "nose" in pts_3d and "left_ear" in pts_3d and "right_ear" in pts_3d:
                nose = pts_3d["nose"]
                l_ear = pts_3d["left_ear"]
                r_ear = pts_3d["right_ear"]

                mid_ear = [(l_ear[i] + r_ear[i]) * 0.5 for i in range(3)]
                face_fwd = [nose[i] - mid_ear[i] for i in range(3)]
                ear_vec = [l_ear[i] - r_ear[i] for i in range(3)]

                raw_yaw = float(math.atan2(face_fwd[0], max(0.01, face_fwd[2])))
                raw_pitch = float(math.atan2(face_fwd[1], max(0.01, face_fwd[2])))
                raw_roll = float(math.atan2(ear_vec[1], max(0.05, abs(ear_vec[0]))))

                # Auto-calibrate neutral posture on first valid frames
                if self.base_pitch is None:
                    self.base_pitch = raw_pitch
                    self.base_yaw = raw_yaw
                    self.base_roll = raw_roll

                if not self.calibrated:
                    self.calib_samples.append((raw_yaw, raw_pitch, raw_roll))
                    if len(self.calib_samples) >= 15:
                        self.base_yaw = float(np.mean([s[0] for s in self.calib_samples]))
                        self.base_pitch = float(np.mean([s[1] for s in self.calib_samples]))
                        self.base_roll = float(np.mean([s[2] for s in self.calib_samples]))
                        self.calibrated = True

                yaw = raw_yaw - self.base_yaw
                pitch = raw_pitch - self.base_pitch
                roll = raw_roll - self.base_roll

                # Deadbands: filter out micro-fluctuations when looking steady
                if abs(yaw) < 0.04:
                    yaw = 0.0
                if abs(pitch) < 0.04:
                    pitch = 0.0
                if abs(roll) < 0.05:
                    roll = 0.0

                yaw = float(np.clip(yaw * 0.85, -0.65, 0.65))
                pitch = float(np.clip(pitch * 0.80, -0.45, 0.45))
                roll = float(np.clip(roll * 0.50, -0.30, 0.30))

                # Smooth head angles with OneEuroFilter to eliminate head wobble
                yaw = self.head_yaw_filter.filter(yaw, timestamp)
                pitch = self.head_pitch_filter.filter(pitch, timestamp)
                roll = self.head_roll_filter.filter(roll, timestamp)

                frame_data.head = {
                    "yaw": round(float(yaw), 3),
                    "pitch": round(float(pitch), 3),
                    "roll": round(float(roll), 3),
                }

        # Match detected hands to anatomical sides (guaranteed by Holistic)
        matched_hands = []
        if res_left_hand is not None:
            matched_hands.append((res_left_hand, "left"))
        if res_right_hand is not None:
            matched_hands.append((res_right_hand, "right"))

        # 3. Finger Tracking (Hybrid: MediaPipe Hands if detected, fallback to Pose distance ratio)
        detected_sides = set()
        aspect = w / max(1.0, float(h))
        for hand_lms, side in matched_hands:
            detected_sides.add(side)
            h_pts = [np.array([p.x * aspect, p.y, p.z * aspect]) for p in hand_lms.landmark]

            curl_thumb = calc_thumb_curl(h_pts[1], h_pts[2], h_pts[3], h_pts[4], h_pts[0], h_pts[5])
            curl_index = calc_finger_curl(h_pts[5], h_pts[6], h_pts[7], h_pts[8], h_pts[0])
            curl_middle = calc_finger_curl(h_pts[9], h_pts[10], h_pts[11], h_pts[12], h_pts[0])
            curl_ring = calc_finger_curl(h_pts[13], h_pts[14], h_pts[15], h_pts[16], h_pts[0])
            curl_pinky = calc_finger_curl(h_pts[17], h_pts[18], h_pts[19], h_pts[20], h_pts[0])

            curls = {
                "thumb": curl_thumb,
                "index": curl_index,
                "middle": curl_middle,
                "ring": curl_ring,
                "pinky": curl_pinky,
            }
            for ftype, c_val in curls.items():
                prev = self.finger_smooth[side][ftype]
                diff = abs(c_val - prev)
                # Adaptive smoothing: responsive to fine twitches & fast punch clenches
                alpha = 0.75 if diff > 0.10 else 0.50
                smooth = prev * (1.0 - alpha) + c_val * alpha
                self.finger_smooth[side][ftype] = smooth
                frame_data.fingers[side][ftype] = round(smooth, 2)

            # 3D Palm Orientation (Wrist rotation & palm twist) in Three.js coordinates
            # Points in Three.js coordinates: X right, Y up, Z towards camera
            w_pt = np.array([h_pts[0][0], -h_pts[0][1], -h_pts[0][2]])
            m_pt = np.array([h_pts[9][0], -h_pts[9][1], -h_pts[9][2]])
            i_pt = np.array([h_pts[5][0], -h_pts[5][1], -h_pts[5][2]])
            p_pt = np.array([h_pts[17][0], -h_pts[17][1], -h_pts[17][2]])

            v_fwd = m_pt - w_pt
            len_fwd = float(np.linalg.norm(v_fwd))
            if len_fwd > 1e-4:
                v_fwd /= len_fwd
            else:
                v_fwd = np.array([0.0, 1.0, 0.0])

            # Cross product produces outward palm normal for both left and right hands
            v_across = (p_pt - i_pt) if side == "left" else (i_pt - p_pt)
            len_across = float(np.linalg.norm(v_across))
            if len_across > 1e-4:
                v_across /= len_across
            else:
                v_across = np.array([1.0, 0.0, 0.0])

            v_norm = np.cross(v_across, v_fwd)
            len_norm = float(np.linalg.norm(v_norm))
            if len_norm > 1e-4:
                v_norm /= len_norm
            else:
                v_norm = np.array([0.0, 0.0, 1.0])

            # Detailed individual phalanx angles (MCP, PIP, DIP) and abduction
            u_across_hand = (h_pts[17] - h_pts[5]) if side == "left" else (h_pts[5] - h_pts[17])
            n_ac = float(np.linalg.norm(u_across_hand))
            u_across_hand = (u_across_hand / n_ac) if n_ac > 1e-6 else np.array([1.0, 0.0, 0.0])

            ang_idx, abd_idx = calc_phalanx_angles(h_pts[5], h_pts[6], h_pts[7], h_pts[8], h_pts[0], u_across_hand)
            ang_mid, abd_mid = calc_phalanx_angles(h_pts[9], h_pts[10], h_pts[11], h_pts[12], h_pts[0], u_across_hand)
            ang_rng, abd_rng = calc_phalanx_angles(h_pts[13], h_pts[14], h_pts[15], h_pts[16], h_pts[0], u_across_hand)
            ang_pnk, abd_pnk = calc_phalanx_angles(h_pts[17], h_pts[18], h_pts[19], h_pts[20], h_pts[0], u_across_hand)
            ang_thb, opp_thb = calc_thumb_phalanx_angles(h_pts[1], h_pts[2], h_pts[3], h_pts[4], h_pts[0], h_pts[5])

            frame_data.fingers[side]["phalanges"] = {
                "thumb": ang_thb,
                "index": ang_idx,
                "middle": ang_mid,
                "ring": ang_rng,
                "pinky": ang_pnk,
            }
            frame_data.fingers[side]["abduction"] = {
                "thumb": opp_thb,
                "index": abd_idx,
                "middle": 0.0,
                "ring": abd_rng,
                "pinky": abd_pnk,
            }

            frame_data.fingers[side]["palm_normal"] = [round(float(v), 3) for v in v_norm]
            frame_data.fingers[side]["hand_direction"] = [round(float(v), 3) for v in v_fwd]
            frame_data.fingers[side]["detected"] = True

        # Multi-Tier Hand Tracking: Fallback to BlazePose Hand Kinematics when 21-landmark model is not resolved
        for side in ["left", "right"]:
            if side not in detected_sides:
                wrist_name = f"{side}_wrist"
                elbow_name = f"{side}_elbow"
                idx_name = f"{side}_index"
                pnk_name = f"{side}_pinky"
                thb_name = f"{side}_thumb"

                has_wrist = wrist_name in frame_data.joints and elbow_name in frame_data.joints
                has_fingertips = has_wrist and (idx_name in frame_data.joints or pnk_name in frame_data.joints)

                if has_fingertips:
                    w_p = np.array(frame_data.joints[wrist_name])
                    el_p = np.array(frame_data.joints[elbow_name])
                    v_arm = w_p - el_p
                    len_arm = float(np.linalg.norm(v_arm))
                    len_arm = max(0.12, len_arm)

                    # Get index, pinky, thumb (with natural projection fallback if missing)
                    i_p = np.array(frame_data.joints[idx_name]) if idx_name in frame_data.joints else (w_p + (v_arm / len_arm) * 0.10)
                    p_p = np.array(frame_data.joints[pnk_name]) if pnk_name in frame_data.joints else (w_p + (v_arm / len_arm) * 0.09)
                    t_p = np.array(frame_data.joints[thb_name]) if thb_name in frame_data.joints else (w_p + (v_arm / len_arm) * 0.07)

                    # Hand extension ratios relative to forearm length
                    r_idx = float(np.linalg.norm(i_p - w_p)) / len_arm
                    r_pnk = float(np.linalg.norm(p_p - w_p)) / len_arm
                    r_thb = float(np.linalg.norm(t_p - i_p)) / len_arm

                    # Calculate continuous finger curls: 0.0 = fully open hand (Shuto/Nukite), 1.0 = tight clenched fist (Seiken)
                    curl_idx = float(np.clip((0.46 - r_idx) / (0.46 - 0.20), 0.0, 1.0))
                    curl_pnk = float(np.clip((0.40 - r_pnk) / (0.40 - 0.16), 0.0, 1.0))
                    curl_thb = float(np.clip((0.32 - r_thb) / (0.32 - 0.08), 0.0, 1.0))

                    # In martial arts (Seiken), fingers clenching into a fist automatically fold the thumb over them
                    fist_core = 0.55 * curl_idx + 0.45 * curl_pnk
                    if fist_core > 0.35:
                        fist_boost = (fist_core - 0.35) / 0.65
                        curl_thb = max(curl_thb, fist_core * 0.95 + fist_boost * 0.05)
                        curl_idx = min(1.0, curl_idx * 1.15)
                        curl_pnk = min(1.0, curl_pnk * 1.15)

                    curl_mid = 0.55 * curl_idx + 0.45 * curl_pnk
                    curl_rng = 0.45 * curl_idx + 0.55 * curl_pnk

                    # Adaptive temporal smoothing
                    curls = {
                        "thumb": curl_thb,
                        "index": curl_idx,
                        "middle": curl_mid,
                        "ring": curl_rng,
                        "pinky": curl_pnk,
                    }
                    for ftype, c_val in curls.items():
                        prev = self.finger_smooth[side][ftype]
                        diff = abs(c_val - prev)
                        alpha = 0.75 if diff > 0.08 else 0.45
                        smooth = prev * (1.0 - alpha) + c_val * alpha
                        self.finger_smooth[side][ftype] = smooth
                        frame_data.fingers[side][ftype] = round(smooth, 2)

                    # Compute 3D palm orientation from Pose landmarks
                    v_fwd = (i_p + p_p) * 0.5 - w_p
                    len_fwd = float(np.linalg.norm(v_fwd))
                    v_fwd = (v_fwd / len_fwd) if len_fwd > 1e-4 else (v_arm / len_arm)

                    v_across = (p_p - i_p) if side == "left" else (i_p - p_p)
                    len_across = float(np.linalg.norm(v_across))
                    v_across = (v_across / len_across) if len_across > 1e-4 else np.array([1.0, 0.0, 0.0])

                    v_norm = np.cross(v_across, v_fwd)
                    len_norm = float(np.linalg.norm(v_norm))
                    v_norm = (v_norm / len_norm) if len_norm > 1e-4 else np.array([0.0, 0.0, 1.0])

                    frame_data.fingers[side]["palm_normal"] = [round(float(v), 3) for v in v_norm]
                    frame_data.fingers[side]["hand_direction"] = [round(float(v), 3) for v in v_fwd]
                    frame_data.fingers[side]["general_curl"] = round((curl_idx + curl_pnk + curl_thb) / 3.0, 2)
                    frame_data.fingers[side]["detected"] = True
                    frame_data.fingers[side]["method"] = "pose_kinematics"
                else:
                    # When hand is in tight fist (Seiken) or fingertips tucked into palm,
                    # retain the clench state rather than forcefully resetting to open hand!
                    frame_data.fingers[side]["detected"] = True
                    for ftype in ["thumb", "index", "middle", "ring", "pinky"]:
                        # Retain current curl smoothly without abrupt pop to 0.15
                        smooth = self.finger_smooth[side][ftype]
                        frame_data.fingers[side][ftype] = round(smooth, 2)
                    frame_data.fingers[side]["general_curl"] = round(sum(self.finger_smooth[side].values()) / 5.0, 2)

        # 4. Populate 2D Hand Landmark Coordinates
        for hand_lms, side in matched_hands:
            pts_h = []
            for p in hand_lms.landmark:
                nx = (p.x * dim_max - pad_left) / max(1, w)
                ny = (p.y * dim_max - pad_top) / max(1, h)
                if mirror:
                    nx = 1.0 - nx
                pts_h.append([round(float(np.clip(nx, 0.0, 1.0)), 4), round(float(np.clip(ny, 0.0, 1.0)), 4)])
            frame_data.hands_2d[side] = pts_h

        # 5. Native OpenCV Anti-Aliased Skeleton and Hand Overlay
        if draw_skeleton:
            if res_pose.pose_landmarks:
                self._draw_pose_overlay(
                    display_frame,
                    res_pose.pose_landmarks.landmark,
                    dim_max,
                    pad_left,
                    pad_top,
                    mirror,
                    fps=fps,
                    frame_data=frame_data,
                )
            for hand_lms, side in matched_hands:
                # Left hand in cyan, Right hand in amber
                color = (0, 255, 200) if side == "left" else (255, 200, 0)
                self._draw_hand_overlay(
                    display_frame,
                    hand_lms,
                    dim_max,
                    pad_left,
                    pad_top,
                    mirror,
                    color,
                )

        return display_frame, frame_data

    def _draw_pose_overlay(
        self,
        frame: np.ndarray,
        lm_2d,
        dim_max: int,
        pad_left: int,
        pad_top: int,
        mirror: bool,
        fps: float = 0.0,
        frame_data: Optional[FrameData] = None,
    ):
        """
        Multi-Level Diagnostic Karate Visualization on Video Stream:
        Level 1: Raw MediaPipe landmarks (hollow cyan/orange indicator rings).
        Level 2: Biomechanically corrected, length-stabilized skeleton lines (high-contrast neon).
        Level 3: Joint angles HUD (knees, elbows, stance, foot grounding on tatami, kime indicator).
        """
        h, w = frame.shape[:2]
        coords: Dict[str, Tuple[int, int]] = {}
        raw_coords: Dict[str, Tuple[int, int]] = {}

        # Raw landmark 2D coordinates (Level 1)
        for name, idx in POSE_LM.items():
            if idx < len(lm_2d):
                p = lm_2d[idx]
                if getattr(p, "visibility", 1.0) > 0.25:
                    raw_px = p.x * dim_max - pad_left
                    raw_py = p.y * dim_max - pad_top
                    px = int(w - 1 - raw_px) if mirror else int(raw_px)
                    py = int(raw_py)
                    if 0 <= px < w and 0 <= py < h:
                        raw_coords[name] = (px, py)

        # Filtered & Stabilized 2D coordinates (Level 2)
        if frame_data and frame_data.landmarks_2d:
            for name, (norm_x, norm_y) in frame_data.landmarks_2d.items():
                px = int(norm_x * w)
                py = int(norm_y * h)
                if 0 <= px < w and 0 <= py < h:
                    coords[name] = (px, py)
        else:
            coords = dict(raw_coords)

        # LEVEL 1: Draw Raw Detection Rings (Semi-transparent / hollow markers)
        for name, pt in raw_coords.items():
            col_raw = (0, 180, 255) if name.startswith("left") else (255, 180, 0)
            cv2.circle(frame, pt, 7, col_raw, 1, cv2.LINE_AA)

        # LEVEL 2: Draw Biomechanically Corrected Skeleton Bones (High-contrast neon)
        for a, b, color in POSE_DRAW_CONNECTIONS:
            if a in coords and b in coords:
                cv2.line(frame, coords[a], coords[b], (15, 20, 28), 5, cv2.LINE_AA)  # Black drop outline
                cv2.line(frame, coords[a], coords[b], color, 3, cv2.LINE_AA)

        # Draw Solid Joint Centers
        for name, pt in coords.items():
            color = (0, 255, 255) if ("wrist" in name or "ankle" in name) else (255, 255, 255)
            cv2.circle(frame, pt, 5, color, -1, cv2.LINE_AA)
            cv2.circle(frame, pt, 7, (0, 0, 0), 1, cv2.LINE_AA)

        # LEVEL 3: Real-Time Karate Biomechanics & Posture Evaluation HUD
        metrics = analyze_karate_biomechanics(frame_data.joints if frame_data else {})

        # Draw Angle Callouts near knees
        if "left_knee" in coords:
            cv2.putText(frame, f"{metrics['knee_l']:.0f}°", (coords["left_knee"][0] + 10, coords["left_knee"][1]),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 180), 1, cv2.LINE_AA)
        if "right_knee" in coords:
            cv2.putText(frame, f"{metrics['knee_r']:.0f}°", (coords["right_knee"][0] + 10, coords["right_knee"][1]),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 180), 1, cv2.LINE_AA)

        # Draw Elbow Callouts
        if "left_elbow" in coords:
            cv2.putText(frame, f"{metrics['elbow_l']:.0f}°", (coords["left_elbow"][0] + 10, coords["left_elbow"][1]),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 220, 255), 1, cv2.LINE_AA)
        if "right_elbow" in coords:
            cv2.putText(frame, f"{metrics['elbow_r']:.0f}°", (coords["right_elbow"][0] + 10, coords["right_elbow"][1]),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 150, 0), 1, cv2.LINE_AA)

        # Foot Grounding Markers near ankles
        if "left_ankle" in coords:
            g_str = "ОПОРА" if metrics.get("grounded_l", True) else "В ВОЗДУХЕ"
            g_col = (0, 255, 120) if metrics.get("grounded_l", True) else (0, 200, 255)
            cv2.putText(frame, f"L:{g_str}", (coords["left_ankle"][0] - 30, coords["left_ankle"][1] + 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.40, g_col, 1, cv2.LINE_AA)
        if "right_ankle" in coords:
            g_str = "ОПОРА" if metrics.get("grounded_r", True) else "В ВОЗДУХЕ"
            g_col = (0, 255, 120) if metrics.get("grounded_r", True) else (0, 200, 255)
            cv2.putText(frame, f"R:{g_str}", (coords["right_ankle"][0] - 30, coords["right_ankle"][1] + 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.40, g_col, 1, cv2.LINE_AA)

        # Hand Curl Callouts near wrists
        if frame_data and frame_data.fingers:
            for side in ["left", "right"]:
                wr_key = f"{side}_wrist"
                f_info = frame_data.fingers.get(side, {})
                if wr_key in coords and f_info.get("detected"):
                    curl = f_info.get("general_curl", f_info.get("index", 0.15))
                    status_str = "СЭЙКЭН" if curl > 0.45 else "ШУТО"
                    col = (0, 140, 255) if curl > 0.45 else (0, 255, 120)
                    pt = coords[wr_key]
                    cv2.putText(frame, f"{status_str} {int(curl*100)}%", (pt[0] - 25, pt[1] - 12),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, col, 1, cv2.LINE_AA)

        # Top Diagnostic HUD Banner
        hud_stance = metrics.get("stance", "Йой-дати")
        hud_tech = metrics.get("technique", "Позиция ожидания")
        hud_score = metrics.get("score", 92)
        hud_kime = metrics.get("kime_active", False)

        cv2.rectangle(frame, (10, h - 68), (min(w - 10, 480), h - 10), (12, 14, 20), -1)
        cv2.rectangle(frame, (10, h - 68), (min(w - 10, 480), h - 10), (45, 55, 72), 1)

        cv2.putText(frame, f"СТОЙКА: {hud_stance}", (20, h - 46),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 1, cv2.LINE_AA)
        tech_col = (0, 255, 255) if hud_kime else (200, 210, 225)
        kime_tag = " [КИМЭ!]" if hud_kime else ""
        cv2.putText(frame, f"ТЕХНИКА: {hud_tech}{kime_tag}", (20, h - 26),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.44, tech_col, 1, cv2.LINE_AA)
        cv2.putText(frame, f"ОЦЕНКА: {hud_score}%", (min(w - 10, 480) - 95, h - 46),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (16, 185, 129), 1, cv2.LINE_AA)

    def _draw_hand_overlay(
        self,
        frame: np.ndarray,
        hand_lms,
        dim_max: int,
        pad_left: int,
        pad_top: int,
        mirror: bool,
        color: Tuple[int, int, int],
    ):
        """Draws all 21 joints and finger bones per hand using OpenCV."""
        h, w = frame.shape[:2]
        pts = []
        for p in hand_lms.landmark:
            raw_px = p.x * dim_max - pad_left
            raw_py = p.y * dim_max - pad_top
            px = int(w - 1 - raw_px) if mirror else int(raw_px)
            py = int(raw_py)
            pts.append((px, py))

        for a, b in HAND_CONNECTIONS:
            if 0 <= a < len(pts) and 0 <= b < len(pts):
                cv2.line(frame, pts[a], pts[b], color, 2, cv2.LINE_AA)
        for pt in pts:
            if 0 <= pt[0] < w and 0 <= pt[1] < h:
                cv2.circle(frame, pt, 3, (255, 255, 255), -1, cv2.LINE_AA)

    def analyze_video_file(
        self,
        video_path: Path | str,
        technique_name: str = "karate_technique",
        stride: int = 1,
        progress_callback: Optional[Callable[[int, int, float], None]] = None,
        cancel_check: Optional[Callable[[], bool]] = None,
    ) -> KarateMotionProject:
        """
        Mode A: Analyzes a video file frame-by-frame and produces a KarateMotionProject.
        """
        path = Path(video_path)
        if not path.is_file():
            raise FileNotFoundError(f"Video file not found: {path}")

        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            raise ValueError(f"OpenCV could not open video: {path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1

        self.calibrate()
        raw_frames: List[FrameData] = []
        frame_idx = 0
        analyzed_count = 0
        t0 = time.time()

        try:
            while True:
                if cancel_check and cancel_check():
                    break

                ok, frame = cap.read()
                if not ok:
                    break

                if frame_idx % stride == 0:
                    simulated_time = frame_idx / fps
                    _, fdata = self.process_frame(frame, analyzed_count, simulated_time, mirror=False)
                    raw_frames.append(fdata)
                    analyzed_count += 1

                    if progress_callback:
                        progress_callback(frame_idx, total_frames, analyzed_count / max(0.01, time.time() - t0))

                frame_idx += 1
        finally:
            cap.release()

        # Build Project
        meta = Metadata(
            name=path.stem,
            technique=technique_name,
            sourceType="video",
            sourceFile=path.name,
            fps=round(fps / stride, 2),
            duration=round(len(raw_frames) / (fps / stride), 4) if raw_frames else 0.0,
            frameCount=len(raw_frames),
            trimRange=[0, max(0, len(raw_frames) - 1)],
        )

        project = KarateMotionProject(
            metadata=meta,
            rawFrames=raw_frames,
            filteredFrames=[],
        )
        return project
