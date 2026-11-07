"""
Trajectory Filtering and Smoothing Algorithms for Karate Motion Studio.
Implements the 1€ (One-Euro) Filter to eliminate high-frequency micro-jitter
while strictly preserving sharp, explosive Karate strikes (Kime),
plus bounded linear/spline interpolation for short occlusions.
"""
from __future__ import annotations
import math
from typing import Dict, List, Optional
import numpy as np


class LowPassFilter:
    def __init__(self, alpha: float = 0.5):
        self.alpha = alpha
        self.y: Optional[float] = None
        self.s: Optional[float] = None

    def filter(self, value: float, alpha: Optional[float] = None) -> float:
        if alpha is not None:
            self.alpha = alpha
        if self.s is None:
            self.s = value
        else:
            self.s = self.alpha * value + (1.0 - self.alpha) * self.s
        self.y = value
        return self.s

    def reset(self):
        self.s = None
        self.y = None


class OneEuroFilter:
    """
    Adaptive 1€ Filter (Casiez et al., CHI 2012).
    Dynamically adjusts low-pass cutoff based on derivative (velocity):
    - At rest: low cutoff frequency eliminates micro-jitter.
    - During rapid strikes (Kime): cutoff expands, eliminating lag and preserving sharp peaks.
    """

    def __init__(self, freq: float = 30.0, min_cutoff: float = 1.0, beta: float = 0.05, d_cutoff: float = 1.0):
        self.freq = max(1e-3, freq)
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff

        self.x_filter = LowPassFilter(self._alpha(min_cutoff))
        self.dx_filter = LowPassFilter(self._alpha(d_cutoff))
        self.last_time: Optional[float] = None

    def _alpha(self, cutoff: float) -> float:
        tau = 1.0 / (2.0 * math.pi * cutoff)
        te = 1.0 / self.freq
        return 1.0 / (1.0 + tau / te)

    def filter(self, x: float, timestamp: Optional[float] = None) -> float:
        if self.last_time is not None and timestamp is not None:
            dt = timestamp - self.last_time
            if dt > 1e-4:
                self.freq = 1.0 / dt
        self.last_time = timestamp

        # Estimate velocity
        prev_x = self.x_filter.y
        raw_diff = 0.0 if prev_x is None else abs(x - prev_x)
        dx = 0.0 if prev_x is None else (x - prev_x) * self.freq
        # Deadband suppression for stationary sensor noise / micro-tremor:
        if raw_diff < 0.006:
            dx *= 0.15
        edx = self.dx_filter.filter(dx, self._alpha(self.d_cutoff))

        # Dynamic cutoff
        cutoff = self.min_cutoff + self.beta * abs(edx)
        return self.x_filter.filter(x, self._alpha(cutoff))

    def reset(self):
        self.x_filter.reset()
        self.dx_filter.reset()
        self.last_time = None


class Vector3DOneEuroFilter:
    """3D point filter maintaining 3 independent 1€ filters for X, Y, Z."""

    def __init__(self, freq: float = 30.0, min_cutoff: float = 1.2, beta: float = 0.08, d_cutoff: float = 1.0):
        self.fx = OneEuroFilter(freq, min_cutoff, beta, d_cutoff)
        self.fy = OneEuroFilter(freq, min_cutoff, beta, d_cutoff)
        self.fz = OneEuroFilter(freq, min_cutoff, beta, d_cutoff)

    def filter(self, pt: List[float], timestamp: Optional[float] = None) -> List[float]:
        return [
            round(self.fx.filter(pt[0], timestamp), 4),
            round(self.fy.filter(pt[1], timestamp), 4),
            round(self.fz.filter(pt[2], timestamp), 4),
        ]

    def reset(self):
        self.fx.reset()
        self.fy.reset()
        self.fz.reset()


class AdaptiveKarateKimeFilter:
    """
    Shotokan Karate Adaptive Kime Filter for 3D trajectory tracking.
    - Low speed (Kamae / stationary stance): low cutoff (0.8 Hz) suppresses sensor jitter completely.
    - Explosive strike initiation (Oi-zuki, Gyaku-zuki, blocks): expands cutoff up to 45 Hz with zero lag.
    - Impact / Kime deceleration: detects rapid negative acceleration and immediately latches the peak
      position, preventing overshoot, drift, or sluggish recovery.
    """

    def __init__(self, freq: float = 30.0, base_cutoff: float = 0.8, max_cutoff: float = 45.0):
        self.freq = max(1e-3, freq)
        self.base_cutoff = base_cutoff
        self.max_cutoff = max_cutoff
        self.prev_pt = None
        self.prev_vel = None
        self.prev_time = None
        self.filter_3d = Vector3DOneEuroFilter(freq=freq, min_cutoff=base_cutoff, beta=0.12)
        self.kime_latched: bool = False
        self.kime_latch_timer: int = 0
        self.latched_pt = None

    def reset(self):
        self.prev_pt = None
        self.prev_vel = None
        self.prev_time = None
        self.filter_3d.reset()
        self.kime_latched = False
        self.kime_latch_timer = 0
        self.latched_pt = None

    def filter(self, pt: List[float], timestamp: Optional[float] = None) -> List[float]:
        cur_pt = np.array(pt, dtype=float)
        now = timestamp if timestamp is not None else 0.0

        if self.prev_pt is None or self.prev_time is None:
            self.prev_pt = cur_pt.copy()
            self.prev_vel = np.zeros(3, dtype=float)
            self.prev_time = now
            return self.filter_3d.filter(pt, timestamp)

        dt = max(0.003, now - self.prev_time)
        cur_vel = (cur_pt - self.prev_pt) / dt
        speed = float(np.linalg.norm(cur_vel))

        # Velocity-adaptive cutoff
        # For martial arts strikes: normal human punch reaches 5-10 m/s; slow movement is < 0.3 m/s
        if speed > 1.8:
            # High speed strike: scale cutoff up to 45 Hz
            factor = min(1.0, (speed - 1.8) / 4.0)
            cur_cutoff = self.base_cutoff + factor * (self.max_cutoff - self.base_cutoff)
            self.filter_3d.fx.min_cutoff = cur_cutoff
            self.filter_3d.fy.min_cutoff = cur_cutoff
            self.filter_3d.fz.min_cutoff = cur_cutoff
            self.kime_latched = False
            self.kime_latch_timer = 0
        else:
            # Low speed / stance: restore stable low cutoff
            self.filter_3d.fx.min_cutoff = self.base_cutoff
            self.filter_3d.fy.min_cutoff = self.base_cutoff
            self.filter_3d.fz.min_cutoff = self.base_cutoff

        # Kime (Sudden Impact Lock): if previous velocity was high and dropped sharply (> 65% drop)
        prev_speed = float(np.linalg.norm(self.prev_vel)) if self.prev_vel is not None else 0.0
        if prev_speed > 2.2 and speed < 0.65:
            self.kime_latched = True
            self.kime_latch_timer = 3  # latch for ~3 frames
            self.latched_pt = cur_pt.copy()

        if self.kime_latched and self.kime_latch_timer > 0 and self.latched_pt is not None:
            self.kime_latch_timer -= 1
            filtered = self.filter_3d.filter(self.latched_pt.tolist(), timestamp)
        else:
            self.kime_latched = False
            filtered = self.filter_3d.filter(pt, timestamp)

        self.prev_pt = cur_pt.copy()
        self.prev_vel = cur_vel.copy()
        self.prev_time = now
        return filtered


class BoneLengthStabilizer:
    """
    Anatomical Bone Length Invariance Constraint.
    Prevents limbs from telescoping, shrinking, or exploding during foreshortening,
    kicks (Mae-geri), punches (Oi-zuki/Gyaku-zuki), and deep stances (Zenkutsu/Kiba-dachi).
    Maintains rigid limb segments while strictly preserving true 3D joint orientation.
    """

    # Canonical anatomical segment pairs (parent_joint, child_joint, default_len_m)
    ANATOMICAL_SEGMENTS = [
        # Upper body
        ('left_shoulder', 'left_elbow', 0.28),
        ('left_elbow', 'left_wrist', 0.25),
        ('right_shoulder', 'right_elbow', 0.28),
        ('right_elbow', 'right_wrist', 0.25),
        # Torso
        ('left_shoulder', 'right_shoulder', 0.38),
        ('left_hip', 'right_hip', 0.26),
        # Lower body
        ('left_hip', 'left_knee', 0.42),
        ('left_knee', 'left_ankle', 0.40),
        ('left_ankle', 'left_foot_index', 0.17),
        ('right_hip', 'right_knee', 0.42),
        ('right_knee', 'right_ankle', 0.40),
        ('right_ankle', 'right_foot_index', 0.17),
    ]

    def __init__(self, adaptation_frames: int = 30):
        self.adaptation_frames = adaptation_frames
        self.frame_count = 0
        self.calibrated = False
        self.calib_samples = {
            (p, c): [] for p, c, _ in self.ANATOMICAL_SEGMENTS
        }
        self.bone_lengths = {
            (p, c): d for p, c, d in self.ANATOMICAL_SEGMENTS
        }

    def reset(self):
        self.frame_count = 0
        self.calibrated = False
        self.calib_samples = {(p, c): [] for p, c, _ in self.ANATOMICAL_SEGMENTS}
        self.bone_lengths = {(p, c): d for p, c, d in self.ANATOMICAL_SEGMENTS}

    def calibrate_step(self, joints: Dict[str, List[float]], confidences: Dict[str, float]):
        """Collect high-confidence limb lengths to adapt to the user's specific stature."""
        for p, c, d in self.ANATOMICAL_SEGMENTS:
            if p in joints and c in joints:
                cp = confidences.get(p, 0.5)
                cc = confidences.get(c, 0.5)
                if cp >= 0.65 and cc >= 0.65:
                    v = np.array(joints[c]) - np.array(joints[p])
                    dist = float(np.linalg.norm(v))
                    # Reasonable human limb length bounds (0.5x to 1.7x default)
                    if 0.5 * d <= dist <= 1.7 * d:
                        self.calib_samples[(p, c)].append(dist)
                        if len(self.calib_samples[(p, c)]) >= self.adaptation_frames:
                            self.bone_lengths[(p, c)] = round(float(np.median(self.calib_samples[(p, c)])), 3)

        self.frame_count += 1
        if self.frame_count >= self.adaptation_frames:
            self.calibrated = True

    def stabilize_joints(
        self,
        joints: Dict[str, List[float]],
        confidences: Optional[Dict[str, float]] = None,
    ) -> Dict[str, List[float]]:
        """
        Enforces rigid bone lengths in hierarchical order starting from root/torso:
        Torso -> Shoulders -> Elbows -> Wrists
        Hips -> Knees -> Ankles -> Feet
        """
        if not joints:
            return joints

        conf = confidences or {}
        self.calibrate_step(joints, conf)

        res = {k: list(v) for k, v in joints.items()}

        # 1. Torso width stabilization
        if 'left_shoulder' in res and 'right_shoulder' in res:
            l_sh = np.array(res['left_shoulder'])
            r_sh = np.array(res['right_shoulder'])
            mid_sh = (l_sh + r_sh) * 0.5
            v_sh = l_sh - r_sh
            len_sh = float(np.linalg.norm(v_sh))
            target_sh = self.bone_lengths.get(('left_shoulder', 'right_shoulder'), 0.38)
            if len_sh > 1e-4 and abs(len_sh - target_sh) > 0.02:
                u_sh = v_sh / len_sh
                half_t = target_sh * 0.5
                res['left_shoulder'] = [round(float(mid_sh[i] + u_sh[i] * half_t), 4) for i in range(3)]
                res['right_shoulder'] = [round(float(mid_sh[i] - u_sh[i] * half_t), 4) for i in range(3)]

        if 'left_hip' in res and 'right_hip' in res:
            l_hp = np.array(res['left_hip'])
            r_hp = np.array(res['right_hip'])
            mid_hp = (l_hp + r_hp) * 0.5
            v_hp = l_hp - r_hp
            len_hp = float(np.linalg.norm(v_hp))
            target_hp = self.bone_lengths.get(('left_hip', 'right_hip'), 0.26)
            if len_hp > 1e-4 and abs(len_hp - target_hp) > 0.02:
                u_hp = v_hp / len_hp
                half_t = target_hp * 0.5
                res['left_hip'] = [round(float(mid_hp[i] + u_hp[i] * half_t), 4) for i in range(3)]
                res['right_hip'] = [round(float(mid_hp[i] - u_hp[i] * half_t), 4) for i in range(3)]

        # 2. Sequential limb length stabilization (UpperArm -> LowerArm, Thigh -> Shin -> Foot)
        limb_chains = [
            ('left_shoulder', 'left_elbow'),
            ('left_elbow', 'left_wrist'),
            ('right_shoulder', 'right_elbow'),
            ('right_elbow', 'right_wrist'),
            ('left_hip', 'left_knee'),
            ('left_knee', 'left_ankle'),
            ('left_ankle', 'left_foot_index'),
            ('right_hip', 'right_knee'),
            ('right_knee', 'right_ankle'),
            ('right_ankle', 'right_foot_index'),
        ]

        for p, c in limb_chains:
            if p in res and c in res:
                p_pt = np.array(res[p])
                c_pt = np.array(res[c])
                v = c_pt - p_pt
                cur_len = float(np.linalg.norm(v))
                target_len = self.bone_lengths.get((p, c), 0.30)

                if cur_len < 1e-4:
                    v_dir = np.array([0.0, -1.0, 0.0]) if ('hip' in p or 'knee' in p) else np.array([0.0, 0.0, 1.0])
                else:
                    v_dir = v / cur_len

                d_xy = math.hypot(v[0], v[1])
                if d_xy < target_len * 0.96 and abs(v[2]) < target_len * 0.90:
                    sign_z = 1.0 if v[2] >= -0.01 else -1.0
                    rest_z = math.sqrt(max(0.0, target_len**2 - d_xy**2))
                    corrected_z = sign_z * rest_z
                    new_pt = np.array([p_pt[0] + v[0], p_pt[1] + v[1], p_pt[2] + corrected_z])
                else:
                    new_pt = p_pt + v_dir * target_len

                res[c] = [round(float(v_val), 4) for v_val in new_pt]

        return res


class ContinuousAzimuthUnwrapper:
    """
    Continuous 360° Azimuth Phase Unwrapper.
    Eliminates atan2(-pi, +pi) wrapping singularities during karate turns,
    allowing clean spins (45°, 90°, 180°, 360°) without avatar flip-flops.
    """

    def __init__(self):
        self.prev_raw_yaw = None
        self.unwrapped_yaw = 0.0

    def reset(self):
        self.prev_raw_yaw = None
        self.unwrapped_yaw = 0.0

    def unwrap(self, raw_yaw: float) -> float:
        if self.prev_raw_yaw is None:
            self.prev_raw_yaw = raw_yaw
            self.unwrapped_yaw = raw_yaw
            return self.unwrapped_yaw

        delta = raw_yaw - self.prev_raw_yaw
        while delta > math.pi:
            delta -= 2.0 * math.pi
        while delta < -math.pi:
            delta += 2.0 * math.pi

        self.unwrapped_yaw += delta
        self.prev_raw_yaw = raw_yaw
        return self.unwrapped_yaw



def interpolate_short_gaps(
    frames_joints: List[Dict[str, List[float]]],
    frames_conf: List[Dict[str, float]],
    joint_names: List[str],
    min_confidence: float = 0.15,
    max_gap: int = 5,
) -> Tuple[List[Dict[str, List[float]]], List[Dict[str, float]], List[bool]]:
    """
    Interpolates missing landmarks over short gaps (<= max_gap frames).
    For gaps longer than max_gap, preserves missing status and marks tracking_loss.
    """
    n_frames = len(frames_joints)
    if n_frames == 0:
        return [], [], []

    out_joints = [dict(fj) for fj in frames_joints]
    out_conf = [dict(fc) for fc in frames_conf]
    tracking_loss = [False] * n_frames

    for jname in joint_names:
        # Build visibility mask for this joint
        valid_indices = []
        for i in range(n_frames):
            c = frames_conf[i].get(jname, 0.0)
            if c >= min_confidence and jname in frames_joints[i]:
                valid_indices.append(i)

        if not valid_indices:
            continue

        # Check gaps between consecutive valid frames
        for k in range(len(valid_indices) - 1):
            i0 = valid_indices[k]
            i1 = valid_indices[k + 1]
            gap_len = i1 - i0 - 1

            if 1 <= gap_len <= max_gap:
                p0 = np.array(out_joints[i0][jname], dtype=float)
                p1 = np.array(out_joints[i1][jname], dtype=float)
                c0 = out_conf[i0].get(jname, min_confidence)
                c1 = out_conf[i1].get(jname, min_confidence)

                # Linear interpolation for short occlusion
                for step in range(1, gap_len + 1):
                    alpha = step / float(gap_len + 1)
                    p_interp = (1.0 - alpha) * p0 + alpha * p1
                    idx = i0 + step
                    out_joints[idx][jname] = [round(float(v), 4) for v in p_interp]
                    out_conf[idx][jname] = round(float((1.0 - alpha) * c0 + alpha * c1), 3)

    # Detect frames where major torso landmarks were lost
    major_joints = ["left_shoulder", "right_shoulder", "left_hip", "right_hip"]
    for i in range(n_frames):
        lost_count = sum(1 for mj in major_joints if out_conf[i].get(mj, 0.0) < min_confidence)
        if lost_count >= 2:
            tracking_loss[i] = True

    return out_joints, out_conf, tracking_loss


def smooth_project_frames(
    raw_frames: List[Any],
    joint_names: List[str],
    min_cutoff: float = 1.0,
    beta: float = 0.06,
    min_confidence: float = 0.15,
    max_gap: int = 5,
) -> List[Any]:
    """
    Full filtering pass on raw project frames:
    1. Bounded short-gap interpolation
    2. Adaptive 1€ filtering
    Returns new list of FrameData without altering raw inputs.
    """
    from core.project_schema import FrameData

    if not raw_frames:
        return []

    raw_joints = [f.joints for f in raw_frames]
    raw_conf = [f.confidence for f in raw_frames]

    # Step 1: Interpolate short gaps
    interp_joints, interp_conf, loss_flags = interpolate_short_gaps(
        raw_joints, raw_conf, joint_names, min_confidence, max_gap
    )

    # Step 2: Initialize 3D 1€ filters per joint
    filters: Dict[str, Vector3DOneEuroFilter] = {
        j: Vector3DOneEuroFilter(freq=30.0, min_cutoff=min_cutoff, beta=beta) for j in joint_names
    }

    filtered_frames: List[FrameData] = []
    for i, rf in enumerate(raw_frames):
        t = rf.time
        f_joints: Dict[str, List[float]] = {}

        for jname in joint_names:
            if jname in interp_joints[i]:
                pt = interp_joints[i][jname]
                filtered_pt = filters[jname].filter(pt, t)
                f_joints[jname] = filtered_pt

        # Smooth head angles with 1€ filter
        h = rf.head
        head_smooth = dict(h)

        filtered_frame = FrameData(
            frame=rf.frame,
            time=rf.time,
            rootPosition=list(rf.rootPosition),
            rootRotation=list(rf.rootRotation),
            joints=f_joints,
            confidence=interp_conf[i],
            tracking_loss=loss_flags[i],
            head=head_smooth,
            fingers=rf.fingers,
        )
        filtered_frames.append(filtered_frame)

    return filtered_frames


class Vector2DOneEuroFilter:
    """2D screen landmark filter maintaining 2 independent 1€ filters for X, Y."""

    def __init__(self, freq: float = 30.0, min_cutoff: float = 1.0, beta: float = 0.05, d_cutoff: float = 1.0):
        self.fx = OneEuroFilter(freq, min_cutoff, beta, d_cutoff)
        self.fy = OneEuroFilter(freq, min_cutoff, beta, d_cutoff)

    def filter(self, pt: List[float], timestamp: Optional[float] = None) -> List[float]:
        return [
            round(self.fx.filter(pt[0], timestamp), 4),
            round(self.fy.filter(pt[1], timestamp), 4),
        ]

    def reset(self):
        self.fx.reset()
        self.fy.reset()
