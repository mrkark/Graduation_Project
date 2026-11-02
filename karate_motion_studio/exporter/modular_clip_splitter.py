"""
Modular Clip Splitter for Karate Motion Studio.
Splits full-body captures and retargeted animations into modular layers:
- Lower Body (Stances, Steps, Turns, In-Place Root centering)
- Upper Body (Techniques: Punches, Blocks, Strikes, Spine twisting)
- Full Body (Kicks, Sweeps, Forms)
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Dict, Any, List, Optional, Set

# Standard anatomical bone groupings for Karateka_Armature / Mixamo / MediaPipe retargeting
LOWER_BODY_BONES: Set[str] = {
    "Hips",
    "LeftUpLeg", "RightUpLeg",
    "LeftLeg", "RightLeg",
    "LeftFoot", "RightFoot",
    "LeftToeBase", "RightToeBase",
    # Mixamo / Blender aliases
    "mixamorig:Hips",
    "mixamorig:LeftUpLeg", "mixamorig:RightUpLeg",
    "mixamorig:LeftLeg", "mixamorig:RightLeg",
    "mixamorig:LeftFoot", "mixamorig:RightFoot",
    "mixamorig:LeftToeBase", "mixamorig:RightToeBase",
    "Thigh.L", "Thigh.R",
    "Shin.L", "Shin.R",
    "Foot.L", "Foot.R",
    "Toe.L", "Toe.R",
    "pelvis", "thigh_l", "thigh_r", "calf_l", "calf_r", "foot_l", "foot_r",
}

UPPER_BODY_BONES: Set[str] = {
    "Spine", "Spine1", "Spine2", "Chest", "UpperChest",
    "Neck", "Head",
    "LeftShoulder", "RightShoulder",
    "LeftArm", "RightArm",
    "LeftForeArm", "RightForeArm",
    "LeftHand", "RightHand",
    # Fingers
    "LeftHandThumb1", "LeftHandThumb2", "LeftHandThumb3",
    "LeftHandIndex1", "LeftHandIndex2", "LeftHandIndex3",
    "LeftHandMiddle1", "LeftHandMiddle2", "LeftHandMiddle3",
    "LeftHandRing1", "LeftHandRing2", "LeftHandRing3",
    "LeftHandPinky1", "LeftHandPinky2", "LeftHandPinky3",
    "RightHandThumb1", "RightHandThumb2", "RightHandThumb3",
    "RightHandIndex1", "RightHandIndex2", "RightHandIndex3",
    "RightHandMiddle1", "RightHandMiddle2", "RightHandMiddle3",
    "RightHandRing1", "RightHandRing2", "RightHandRing3",
    "RightHandPinky1", "RightHandPinky2", "RightHandPinky3",
    # Mixamo aliases
    "mixamorig:Spine", "mixamorig:Spine1", "mixamorig:Spine2",
    "mixamorig:Neck", "mixamorig:Head",
    "mixamorig:LeftShoulder", "mixamorig:RightShoulder",
    "mixamorig:LeftArm", "mixamorig:RightArm",
    "mixamorig:LeftForeArm", "mixamorig:RightForeArm",
    "mixamorig:LeftHand", "mixamorig:RightHand",
    "UpperArm.L", "UpperArm.R",
    "LowerArm.L", "LowerArm.R",
    "Hand.L", "Hand.R",
}


def is_lower_bone(name: str) -> bool:
    clean = name.split(".")[-1] if "." in name else name
    return name in LOWER_BODY_BONES or clean in LOWER_BODY_BONES or any(k in name.lower() for k in ["leg", "foot", "toe", "thigh", "shin"])


def is_upper_bone(name: str) -> bool:
    clean = name.split(".")[-1] if "." in name else name
    return name in UPPER_BODY_BONES or clean in UPPER_BODY_BONES or any(k in name.lower() for k in ["spine", "chest", "arm", "hand", "shoulder", "neck", "head", "finger", "thumb", "index"])


def split_retargeted_json(
    data: Dict[str, Any],
    zero_horizontal_root: bool = True,
) -> Dict[str, Dict[str, Any]]:
    """
    Splits a retargeted animation JSON into two modular layers:
    - 'lower': contains only lower-body rotations and stabilized root (In-Place)
    - 'upper': contains only upper-body rotations (Spine upwards)
    """
    frames = data.get("frames", [])
    if not frames:
        return {"lower": data, "upper": data}

    # Reference root position from first frame
    first_root = frames[0].get("rootPosition", [0.0, 0.95, 0.0])
    base_x = first_root[0]
    base_z = first_root[2]

    lower_frames = []
    upper_frames = []

    for f in frames:
        orig_pos = f.get("rootPosition", [0.0, 0.95, 0.0])
        orig_rot = f.get("rootRotation", [0.0, 0.0, 0.0, 1.0])
        bones = f.get("bones", {})

        # Lower-body frame: keep only lower bones; zero out horizontal displacement (X, Z) to prevent foot sliding
        if zero_horizontal_root:
            stabilized_pos = [0.0, orig_pos[1], 0.0]
        else:
            stabilized_pos = [orig_pos[0] - base_x, orig_pos[1], orig_pos[2] - base_z]

        lower_bones = {k: v for k, v in bones.items() if is_lower_bone(k)}
        upper_bones = {k: v for k, v in bones.items() if is_upper_bone(k)}

        lower_frames.append({
            "frame": f.get("frame", 0),
            "time": f.get("time", 0.0),
            "rootPosition": stabilized_pos,
            "rootRotation": orig_rot,
            "bones": lower_bones,
            "layer": "lower_stance",
        })

        # Upper-body frame: neutral root, contains torso, spine and arm rotations
        upper_frames.append({
            "frame": f.get("frame", 0),
            "time": f.get("time", 0.0),
            "rootPosition": [0.0, 0.0, 0.0],
            "rootRotation": [0.0, 0.0, 0.0, 1.0],
            "bones": upper_bones,
            "fingers": f.get("fingers", {}),
            "layer": "upper_technique",
        })

    lower_data = dict(data)
    lower_data["name"] = f"{data.get('name', 'technique')}_lower"
    lower_data["layerType"] = "lower_stance"
    lower_data["frames"] = lower_frames

    upper_data = dict(data)
    upper_data["name"] = f"{data.get('name', 'technique')}_upper"
    upper_data["layerType"] = "upper_technique"
    upper_data["frames"] = upper_frames

    return {
        "lower": lower_data,
        "upper": upper_data,
    }


def export_modular_layers(
    project_or_json: Any,
    output_dir: Path | str,
    base_name: str,
    zero_horizontal_root: bool = True,
) -> Dict[str, str]:
    """
    Exports clean modular JSON layers to disk:
    - {base_name}_lower.json
    - {base_name}_upper.json
    - {base_name}_full.json
    """
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if hasattr(project_or_json, "export_retargeted_json"):
        full_data = project_or_json.export_retargeted_json()
    elif isinstance(project_or_json, dict):
        full_data = project_or_json
    elif isinstance(project_or_json, (str, Path)) and Path(project_or_json).is_file():
        full_data = json.loads(Path(project_or_json).read_text(encoding="utf-8"))
    else:
        raise ValueError("Invalid project or json input for modular export")

    layers = split_retargeted_json(full_data, zero_horizontal_root=zero_horizontal_root)

    full_path = out_dir / f"{base_name}_full.json"
    lower_path = out_dir / f"{base_name}_lower.json"
    upper_path = out_dir / f"{base_name}_upper.json"

    full_path.write_text(json.dumps(full_data, indent=2, ensure_ascii=False), encoding="utf-8")
    lower_path.write_text(json.dumps(layers["lower"], indent=2, ensure_ascii=False), encoding="utf-8")
    upper_path.write_text(json.dumps(layers["upper"], indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "full": str(full_path),
        "lower": str(lower_path),
        "upper": str(upper_path),
    }
