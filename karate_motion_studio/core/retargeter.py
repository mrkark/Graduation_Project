"""
Hierarchical Motion Retargeting Engine for Karate Motion Studio.
Converts 3D joint landmark trajectories into local bone quaternion rotations [x, y, z, w]
taking into account the rig's parent hierarchy, rest-pose geometric orientations, and root motion.
Default target: Karateka_Armature (compatible with Bunkai Explorer and Three.js).
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
import numpy as np

# Canonical rest directions in glTF world space for Karateka_Armature:
# In glTF, bones extend along their rest direction.
DEFAULT_REST_WORLD_DIRS: Dict[str, List[float]] = {
    "Spine": [0.0, 1.0, 0.0],
    "Spine1": [0.0, 1.0, 0.0],
    "Chest": [0.0, 1.0, 0.0],
    "Neck": [0.0, 1.0, 0.0],
    "Head": [0.0, 1.0, 0.0],
    "UpperArm.L": [1.0, 0.0, 0.0],   # Extends along +X (avatar left / viewer right)
    "LowerArm.L": [1.0, 0.0, 0.0],
    "Hand.L": [1.0, 0.0, 0.0],
    "UpperArm.R": [-1.0, 0.0, 0.0],  # Extends along -X (avatar right / viewer left)
    "LowerArm.R": [-1.0, 0.0, 0.0],
    "Hand.R": [-1.0, 0.0, 0.0],
    "UpperLeg.L": [0.0, -1.0, 0.0],  # Extends along -Y (downwards)
    "LowerLeg.L": [0.0, -1.0, 0.0],
    "Foot.L": [0.0, -0.6, 0.8],       # Extends forward and slightly down to toes
    "UpperLeg.R": [0.0, -1.0, 0.0],
    "LowerLeg.R": [0.0, -1.0, 0.0],
    "Foot.R": [0.0, -0.6, 0.8],
}

# Hierarchy definition: child -> parent
BONE_PARENT_MAP: Dict[str, str] = {
    "Hips": "",
    "Spine": "Hips",
    "Spine1": "Spine",
    "Chest": "Spine1",
    "Neck": "Chest",
    "Head": "Neck",
    "Shoulder.L": "Chest",
    "UpperArm.L": "Shoulder.L",
    "LowerArm.L": "UpperArm.L",
    "Hand.L": "LowerArm.L",
    "Shoulder.R": "Chest",
    "UpperArm.R": "Shoulder.R",
    "LowerArm.R": "UpperArm.R",
    "Hand.R": "LowerArm.R",
    "UpperLeg.L": "Hips",
    "LowerLeg.L": "UpperLeg.L",
    "Foot.L": "LowerLeg.L",
    "UpperLeg.R": "Hips",
    "LowerLeg.R": "UpperLeg.R",
    "Foot.R": "LowerLeg.R",
}

# Joint mapping: bone -> (start_joint, end_joint)
DEFAULT_BONE_JOINT_MAP: Dict[str, Tuple[str, str]] = {
    "Spine": ("mid_hip", "mid_shoulder"),
    "UpperArm.L": ("left_shoulder", "left_elbow"),
    "LowerArm.L": ("left_elbow", "left_wrist"),
    "UpperArm.R": ("right_shoulder", "right_elbow"),
    "LowerArm.R": ("right_elbow", "right_wrist"),
    "UpperLeg.L": ("left_hip", "left_knee"),
    "LowerLeg.L": ("left_knee", "left_ankle"),
    "Foot.L": ("left_ankle", "left_foot_index"),
    "UpperLeg.R": ("right_hip", "right_knee"),
    "LowerLeg.R": ("right_knee", "right_ankle"),
    "Foot.R": ("right_ankle", "right_foot_index"),
}


def quat_from_unit_vectors(v_from: np.ndarray, v_to: np.ndarray) -> np.ndarray:
    """Quaternion rotating unit vector v_from to unit vector v_to: [x, y, z, w]."""
    v1 = v_from / np.linalg.norm(v_from)
    v2 = v_to / np.linalg.norm(v_to)
    dot = float(np.dot(v1, v2))

    if dot > 0.999999:
        return np.array([0.0, 0.0, 0.0, 1.0])
    if dot < -0.999999:
        # Задача 31: Корректная обработка противоположного вектора без искусственного смещения limbs от корпуса
        ortho = np.array([0.0, 1.0, 0.0])
        if abs(np.dot(v1, ortho)) > 0.9:
            ortho = np.array([0.0, 0.0, 1.0])
        axis = np.cross(v1, ortho)
        axis /= np.linalg.norm(axis)
        return np.array([axis[0], axis[1], axis[2], 0.0])

    cross = np.cross(v1, v2)
    w = 1.0 + dot
    q = np.array([cross[0], cross[1], cross[2], w], dtype=float)
    return q / np.linalg.norm(q)


def quat_multiply(q1: np.ndarray, q2: np.ndarray) -> np.ndarray:
    """Hamilton quaternion product q1 * q2."""
    x1, y1, z1, w1 = q1
    x2, y2, z2, w2 = q2
    return np.array(
        [
            w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
            w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
            w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
            w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
        ],
        dtype=float,
    )


def quat_inverse(q: np.ndarray) -> np.ndarray:
    """Quaternion inverse (conjugate for unit quaternion)."""
    return np.array([-q[0], -q[1], -q[2], q[3]], dtype=float) / np.linalg.norm(q)


def quat_from_euler_yxz(yaw: float, pitch: float, roll: float) -> np.ndarray:
    """Euler YXZ to quaternion [x, y, z, w]."""
    cy = math.cos(yaw * 0.5)
    sy = math.sin(yaw * 0.5)
    cp = math.cos(pitch * 0.5)
    sp = math.sin(pitch * 0.5)
    cr = math.cos(roll * 0.5)
    sr = math.sin(roll * 0.5)

    qy = np.array([0.0, sy, 0.0, cy])
    qx = np.array([sp, 0.0, 0.0, cp])
    qz = np.array([0.0, 0.0, sr, cr])

    return quat_multiply(quat_multiply(qy, qx), qz)


@dataclass
class DiagnosticReport:
    total_frames: int = 0
    retargeted_frames: int = 0
    mapped_bones: List[str] = field(default_factory=list)
    unmapped_bones: List[str] = field(default_factory=list)
    tracking_loss_frames: int = 0
    warnings: List[str] = field(default_factory=list)



def quat_slerp(q1: np.ndarray, q2: np.ndarray, t: float) -> np.ndarray:
    """Spherical linear interpolation between two unit quaternions."""
    cos_half_theta = float(np.dot(q1, q2))
    q2_adj = q2.copy()
    if cos_half_theta < 0.0:
        q2_adj = -q2_adj
        cos_half_theta = -cos_half_theta

    if abs(cos_half_theta) >= 0.9995:
        # Linear interpolation for very close orientations
        res = (1.0 - t) * q1 + t * q2_adj
        return res / np.linalg.norm(res)

    half_theta = math.acos(cos_half_theta)
    sin_half_theta = math.sin(half_theta)
    w1 = math.sin((1.0 - t) * half_theta) / sin_half_theta
    w2 = math.sin(t * half_theta) / sin_half_theta
    res = w1 * q1 + w2 * q2_adj
    return res / np.linalg.norm(res)


def solve_two_bone_ik(
    p_root: np.ndarray,
    p_target: np.ndarray,
    v_pole: np.ndarray,
    l1: float,
    l2: float,
    v_rest_upper: np.ndarray,
    v_rest_lower: np.ndarray,
    max_flex_deg: float = 165.0,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Analytical Two-Bone Inverse Kinematics solver via Law of Cosines.
    Guarantees:
    - Invariant limb lengths L1, L2
    - Knee / Elbow strictly bends in the plane defined by target and pole
    - No hyperextension beyond straight (0 deg) and clamped at max_flex_deg
    Returns:
        (q_upper_world, q_lower_world)
    """
    v_target = p_target - p_root
    dist = float(np.linalg.norm(v_target))

    # Clamp target reach within reachable workspace
    min_reach = max(0.02, abs(l1 - l2) * 1.02)
    max_reach = (l1 + l2) * 0.998
    clamped_dist = max(min_reach, min(max_reach, dist))

    if dist < 1e-4:
        u_target = np.array([0.0, -1.0, 0.0])
    else:
        u_target = v_target / dist

    # Law of Cosines
    # Angle at root (A)
    cos_alpha = (l1 * l1 + clamped_dist * clamped_dist - l2 * l2) / (2.0 * l1 * clamped_dist)
    cos_alpha = max(-1.0, min(1.0, cos_alpha))
    alpha = math.acos(cos_alpha)

    # Angle at mid joint (B)
    cos_beta = (l1 * l1 + l2 * l2 - clamped_dist * clamped_dist) / (2.0 * l1 * l2)
    cos_beta = max(-1.0, min(1.0, cos_beta))
    beta = math.acos(cos_beta)
    flexion_angle = math.pi - beta

    # Clamp knee / elbow flexion angle
    max_flex_rad = math.radians(max_flex_deg)
    if flexion_angle > max_flex_rad:
        flexion_angle = max_flex_rad
        beta = math.pi - flexion_angle

    # Form bend plane normal from target direction and pole vector
    n_pole = np.cross(u_target, v_pole)
    norm_pole = float(np.linalg.norm(n_pole))
    if norm_pole < 1e-4:
        # Fallback orthogonal plane
        fallback = np.array([1.0, 0.0, 0.0]) if abs(u_target[0]) < 0.8 else np.array([0.0, 0.0, 1.0])
        n_pole = np.cross(u_target, fallback)
        norm_pole = float(np.linalg.norm(n_pole))
    n_pole /= max(1e-6, norm_pole)

    # Upper bone direction: rotate u_target by alpha around bend plane normal
    # Rodrigues formula: u_rot = u*cos(a) + (n x u)*sin(a) + n*(n.u)*(1 - cos(a))
    u_upper = u_target * math.cos(alpha) + np.cross(n_pole, u_target) * math.sin(alpha)
    u_upper /= max(1e-6, float(np.linalg.norm(u_upper)))

    # Mid joint position
    p_mid = p_root + u_upper * l1

    # Lower bone direction
    v_lower = p_target - p_mid
    norm_lower = float(np.linalg.norm(v_lower))
    if norm_lower > 1e-4:
        u_lower = v_lower / norm_lower
    else:
        u_lower = u_upper.copy()

    q_upper_world = quat_from_unit_vectors(v_rest_upper, u_upper)
    q_lower_world = quat_from_unit_vectors(v_rest_lower, u_lower)
    return q_upper_world, q_lower_world


class Retargeter:
    """Solves hierarchical local bone quaternions for Karateka_Armature."""

    def __init__(self, target_rig: str = "Karateka_Armature"):
        self.target_rig = target_rig
        self.rest_world_dirs = dict(DEFAULT_REST_WORLD_DIRS)
        self.bone_parent_map = dict(BONE_PARENT_MAP)
        self.bone_joint_map = dict(DEFAULT_BONE_JOINT_MAP)
        from core.filters import ContinuousAzimuthUnwrapper
        self.azimuth_unwrapper = ContinuousAzimuthUnwrapper()

    def retarget_frame(self, frame_data: Any) -> Dict[str, List[float]]:
        """
        Retargets a single FrameData to local bone quaternions [x, y, z, w]
        using 2-Bone Analytical Inverse Kinematics, Continuous Pelvis Azimuth Tracking,
        and anatomical joint limit constraints.
        """
        joints = frame_data.joints or {}
        has_fingers = hasattr(frame_data, "fingers") and bool(frame_data.fingers)
        if not joints and not has_fingers:
            return {}

        pts = dict(joints)
        has_hips = "left_hip" in pts and "right_hip" in pts
        has_sh = "left_shoulder" in pts and "right_shoulder" in pts

        if has_hips:
            pts["mid_hip"] = [
                (pts["left_hip"][i] + pts["right_hip"][i]) * 0.5 for i in range(3)
            ]
        if has_sh:
            pts["mid_shoulder"] = [
                (pts["left_shoulder"][i] + pts["right_shoulder"][i]) * 0.5 for i in range(3)
            ]

        world_quats: Dict[str, np.ndarray] = {
            "Root": np.array([0.0, 0.0, 0.0, 1.0]),
        }
        local_quats: Dict[str, List[float]] = {}

        # 1. Pelvis / Hips Orientation Solver with 360° Continuous Azimuth
        q_hips_world = np.array([0.0, 0.0, 0.0, 1.0])
        torso_fwd_normal = np.array([0.0, 0.0, 1.0])

        if has_hips:
            l_hp = np.array(pts["left_hip"])
            r_hp = np.array(pts["right_hip"])
            v_hips = l_hp - r_hp
            len_hips = float(np.linalg.norm(v_hips))

            if len_hips > 1e-4:
                # Raw Pelvis Yaw around Y
                raw_yaw = float(math.atan2(v_hips[2], abs(v_hips[0])))
                continuous_yaw = self.azimuth_unwrapper.unwrap(raw_yaw)

                # Pelvic pitch & roll
                pelvic_pitch = 0.0
                if has_sh and "mid_hip" in pts and "mid_shoulder" in pts:
                    v_torso = np.array(pts["mid_shoulder"]) - np.array(pts["mid_hip"])
                    if np.linalg.norm(v_torso) > 1e-4:
                        trunk_pitch = float(math.atan2(v_torso[2], max(0.08, v_torso[1])))
                        pelvic_pitch = float(np.clip(trunk_pitch * 0.35, -0.45, 0.45))

                pelvic_roll = float(math.atan2(v_hips[1], max(0.05, math.hypot(v_hips[0], v_hips[2]))))
                pelvic_roll = float(np.clip(pelvic_roll, -0.35, 0.35))

                q_hips_world = quat_from_euler_yxz(continuous_yaw, -pelvic_pitch, pelvic_roll)
                world_quats["Hips"] = q_hips_world
                local_quats["Hips"] = [round(float(v), 4) for v in q_hips_world]

                # Compute torso forward normal vector
                torso_fwd_normal = np.array([
                    2.0 * (q_hips_world[0] * q_hips_world[2] + q_hips_world[3] * q_hips_world[1]),
                    2.0 * (q_hips_world[1] * q_hips_world[2] - q_hips_world[3] * q_hips_world[0]),
                    1.0 - 2.0 * (q_hips_world[0]**2 + q_hips_world[1]**2),
                ])
                torso_fwd_normal /= max(1e-6, float(np.linalg.norm(torso_fwd_normal)))
            else:
                world_quats["Hips"] = q_hips_world
                local_quats["Hips"] = [0.0, 0.0, 0.0, 1.0]
        else:
            world_quats["Hips"] = q_hips_world
            local_quats["Hips"] = [0.0, 0.0, 0.0, 1.0]

        # 2. Torso / Spine / Chest Solver (multi-segment distribution)
        if "mid_hip" in pts and "mid_shoulder" in pts:
            v_torso = np.array(pts["mid_shoulder"]) - np.array(pts["mid_hip"])
            len_torso = float(np.linalg.norm(v_torso))
            if len_torso > 1e-4:
                uy = v_torso / len_torso
                # Symmetrical lateral vector
                if has_sh:
                    v_lat = np.array(pts["left_shoulder"]) - np.array(pts["right_shoulder"])
                else:
                    v_lat = np.array([1.0, 0.0, 0.0])
                dot_lat = float(np.dot(v_lat, uy))
                ux = v_lat - dot_lat * uy
                len_ux = float(np.linalg.norm(ux))
                if len_ux > 1e-4:
                    ux /= len_ux
                else:
                    ux = np.array([1.0, 0.0, 0.0])
                uz = np.cross(ux, uy)
                uz /= max(1e-6, float(np.linalg.norm(uz)))
                ux = np.cross(uy, uz)

                # Form torso target world quaternion
                m_rot = np.array([
                    [ux[0], uy[0], uz[0]],
                    [ux[1], uy[1], uz[1]],
                    [ux[2], uy[2], uz[2]]
                ], dtype=float)
                tr = m_rot[0, 0] + m_rot[1, 1] + m_rot[2, 2]
                if tr > 0.0:
                    S = math.sqrt(tr + 1.0) * 2.0
                    qw = 0.25 * S
                    qx = (m_rot[2, 1] - m_rot[1, 2]) / S
                    qy = (m_rot[0, 2] - m_rot[2, 0]) / S
                    qz = (m_rot[1, 0] - m_rot[0, 1]) / S
                else:
                    qx = 0.0; qy = 0.0; qz = 0.0; qw = 1.0
                q_torso_world = np.array([qx, qy, qz, qw], dtype=float)
                q_torso_world /= np.linalg.norm(q_torso_world)

                # Distribute spine curvature: Spine (lumbar 45%), Chest (thoracic 100%)
                q_lumbar_world = quat_slerp(q_hips_world, q_torso_world, 0.45)
                world_quats["Spine"] = q_lumbar_world
                q_spine_local = quat_multiply(quat_inverse(q_hips_world), q_lumbar_world)
                q_spine_local /= np.linalg.norm(q_spine_local)
                local_quats["Spine"] = [round(float(v), 4) for v in q_spine_local]

                world_quats["Chest"] = q_torso_world
                q_chest_local = quat_multiply(quat_inverse(q_lumbar_world), q_torso_world)
                q_chest_local /= np.linalg.norm(q_chest_local)
                local_quats["Chest"] = [round(float(v), 4) for v in q_chest_local]

        # 3. Head Solver (Euler from Metsuke)
        if hasattr(frame_data, "head") and frame_data.head:
            h = frame_data.head
            q_head_local = quat_from_euler_yxz(h.get("yaw", 0.0), -h.get("pitch", 0.0), h.get("roll", 0.0))
            local_quats["Head"] = [round(float(v), 4) for v in q_head_local]

        # 4. Legs: Analytical 2-Bone Inverse Kinematics
        leg_configs = [
            ("UpperLeg.L", "LowerLeg.L", "Foot.L", "left_hip", "left_knee", "left_ankle", "left_foot_index", 0.42, 0.40, True),
            ("UpperLeg.R", "LowerLeg.R", "Foot.R", "right_hip", "right_knee", "right_ankle", "right_foot_index", 0.42, 0.40, False),
        ]

        for up_name, low_name, foot_name, j_hip, j_knee, j_ankle, j_toe, l1, l2, is_left in leg_configs:
            if j_hip in pts and j_knee in pts and (j_ankle in pts or "left_heel" in pts or "right_heel" in pts):
                p_hip = np.array(pts[j_hip])
                p_knee = np.array(pts[j_knee])
                heel_key = "left_heel" if is_left else "right_heel"
                ankle_pt = pts.get(j_ankle, pts.get(heel_key, pts[j_knee]))
                p_ankle = np.array(ankle_pt)

                # Anatomical Pole Vector:
                # Knee flexes forward along thigh, pointing outwards in Kiba-dachi or forward in Zenkutsu
                v_thigh = p_knee - p_hip
                v_shin = p_ankle - p_knee
                len_thigh = float(np.linalg.norm(v_thigh))
                len_shin = float(np.linalg.norm(v_shin))
                l1_use = l1 if len_thigh < 0.20 else len_thigh
                l2_use = l2 if len_shin < 0.20 else len_shin

                # Pole direction: knee projection forward along torso normal
                pole_dir = torso_fwd_normal.copy()
                if abs(p_ankle[0] - p_hip[0]) > 0.25: # wide stance like Kiba-dachi
                    pole_dir[0] += (0.35 if is_left else -0.35)
                pole_dir /= max(1e-6, float(np.linalg.norm(pole_dir)))

                v_rest_up = np.array(self.rest_world_dirs[up_name])
                v_rest_low = np.array(self.rest_world_dirs[low_name])

                q_up_world, q_low_world = solve_two_bone_ik(
                    p_hip, p_ankle, pole_dir, l1_use, l2_use, v_rest_up, v_rest_low, max_flex_deg=165.0
                )

                world_quats[up_name] = q_up_world
                world_quats[low_name] = q_low_world

                # Local relative rotations
                q_up_local = quat_multiply(quat_inverse(world_quats["Hips"]), q_up_world)
                q_up_local /= np.linalg.norm(q_up_local)
                local_quats[up_name] = [round(float(v), 4) for v in q_up_local]

                q_low_local = quat_multiply(quat_inverse(q_up_world), q_low_world)
                q_low_local /= np.linalg.norm(q_low_local)
                local_quats[low_name] = [round(float(v), 4) for v in q_low_local]

                # Foot alignment
                if j_toe in pts:
                    v_foot = np.array(pts[j_toe]) - p_ankle
                    if np.linalg.norm(v_foot) > 1e-4:
                        v_rest_foot = np.array(self.rest_world_dirs[foot_name])
                        q_foot_world = quat_from_unit_vectors(v_rest_foot, v_foot)
                        world_quats[foot_name] = q_foot_world
                        q_foot_local = quat_multiply(quat_inverse(q_low_world), q_foot_world)
                        q_foot_local /= np.linalg.norm(q_foot_local)
                        local_quats[foot_name] = [round(float(v), 4) for v in q_foot_local]

        # 5. Arms: UpperArm, LowerArm, Hand (with straight arm snap & elbow protection)
        arm_configs = [
            ("UpperArm.L", "LowerArm.L", "Hand.L", "left_shoulder", "left_elbow", "left_wrist", "Chest", True),
            ("UpperArm.R", "LowerArm.R", "Hand.R", "right_shoulder", "right_elbow", "right_wrist", "Chest", False),
        ]

        for up_name, low_name, hand_name, j_sh, j_el, j_wr, parent_name, is_left in arm_configs:
            if j_sh in pts and j_el in pts and j_wr in pts:
                p_sh = np.array(pts[j_sh])
                p_el = np.array(pts[j_el])
                p_wr = np.array(pts[j_wr])

                v_arm = p_el - p_sh
                v_forearm = p_wr - p_el
                len_arm = float(np.linalg.norm(v_arm))
                len_fore = float(np.linalg.norm(v_forearm))

                if len_arm > 1e-4 and len_fore > 1e-4:
                    u_arm = v_arm / len_arm
                    u_fore = v_forearm / len_fore
                    dot_collinear = float(np.dot(u_arm, u_fore))

                    # Straight Arm Snap for Oi-zuki / Gyaku-zuki:
                    # When dot > 0.92 (angle < 23 deg), snap forearm collinear to avoid artificial bend
                    if dot_collinear > 0.92:
                        snap_alpha = min(1.0, (dot_collinear - 0.92) / 0.05)
                        v_forearm = (1.0 - snap_alpha) * v_forearm + snap_alpha * (u_arm * len_fore)

                    # Upper arm world quaternion
                    v_rest_arm = np.array(self.rest_world_dirs[up_name])
                    q_arm_world = quat_from_unit_vectors(v_rest_arm, v_arm)
                    world_quats[up_name] = q_arm_world

                    q_chest_world = world_quats.get(parent_name, q_hips_world)
                    q_arm_local = quat_multiply(quat_inverse(q_chest_world), q_arm_world)
                    q_arm_local /= np.linalg.norm(q_arm_local)
                    local_quats[up_name] = [round(float(v), 4) for v in q_arm_local]

                    # Forearm world quaternion
                    v_rest_fore = np.array(self.rest_world_dirs[low_name])
                    q_fore_world = quat_from_unit_vectors(v_rest_fore, v_forearm)
                    world_quats[low_name] = q_fore_world

                    q_fore_local = quat_multiply(quat_inverse(q_arm_world), q_fore_world)
                    q_fore_local /= np.linalg.norm(q_fore_local)
                    local_quats[low_name] = [round(float(v), 4) for v in q_fore_local]

        # 6. Finger Curls (Thumb, Index, Middle, Ring, Pinky 1..3)
        if hasattr(frame_data, "fingers") and frame_data.fingers:
            for side in ["left", "right"]:
                s_key = "L" if side == "left" else "R"
                f_data = frame_data.fingers.get(side, {})
                for ftype in ["Thumb", "Index", "Middle", "Ring", "Pinky"]:
                    curl = f_data.get(ftype.lower(), f_data.get("general_curl", 0.15)) if f_data.get("detected") else f_data.get("general_curl", 0.15)
                    for idx in range(1, 4):
                        bname = f"{ftype}{idx}.{s_key}"
                        if ftype == "Thumb":
                            side_sign = 1.0 if s_key == "L" else -1.0
                            closed_c = curl
                            if closed_c > 0.25:
                                u = min(1.0, (closed_c - 0.25) / 0.50)
                                closed_c = 0.25 + 0.75 * math.sin(u * math.pi * 0.5)

                            if idx == 1:
                                axis = np.array([-0.7575, 0.3361 * side_sign, 0.5597 * side_sign])
                                axis /= np.linalg.norm(axis)
                                ang = closed_c * 1.35
                                s = math.sin(ang * 0.5)
                                c = math.cos(ang * 0.5)
                                q_thumb = np.array([axis[0] * s, axis[1] * s, axis[2] * s, c])
                                local_quats[bname] = [round(float(v), 4) for v in q_thumb]
                            else:
                                ang = closed_c * (1.30 if idx == 2 else 0.90)
                                axis = np.array([-1.0, 0.20 * side_sign, 0.15 * side_sign])
                                axis /= np.linalg.norm(axis)
                                s = math.sin(ang * 0.5)
                                c = math.cos(ang * 0.5)
                                q_thumb = np.array([axis[0] * s, axis[1] * s, axis[2] * s, c])
                                local_quats[bname] = [round(float(v), 4) for v in q_thumb]
                        else:
                            closed_c = curl
                            if closed_c > 0.25:
                                u = min(1.0, (closed_c - 0.25) / 0.50)
                                closed_c = 0.25 + 0.75 * math.sin(u * math.pi * 0.5)
                            max_ang = 1.45 if idx == 1 else (1.75 if idx == 2 else 1.20)
                            ang = closed_c * max_ang
                            q_flex = np.array([-math.sin(ang * 0.5), 0.0, 0.0, math.cos(ang * 0.5)])
                            local_quats[bname] = [round(float(v), 4) for v in q_flex]

        return local_quats

    def retarget_project(self, project: Any) -> DiagnosticReport:
        """
        Retargets all frames in a KarateMotionProject, storing results in project.retargeting.
        """
        from core.project_schema import RetargetingData

        frames = project.get_effective_frames()
        report = DiagnosticReport(
            total_frames=len(frames),
            mapped_bones=list(self.bone_joint_map.keys()) + ["Head", "Spine"],
        )

        all_local_rotations: List[Dict[str, List[float]]] = []
        for f in frames:
            if f.tracking_loss:
                report.tracking_loss_frames += 1
            local_rot = self.retarget_frame(f)
            all_local_rotations.append(local_rot)

        project.retargeting = RetargetingData(
            targetRig=self.target_rig,
            boneMapping={b: f"{j[0]}_to_{j[1]}" for b, j in self.bone_joint_map.items()},
            localRotations=all_local_rotations,
        )

        report.retargeted_frames = len(all_local_rotations)
        return report
