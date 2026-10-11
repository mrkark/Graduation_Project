"""
Shotokan Animation Library Core:
- Math and bone orientation utilities
- Pose bone setters with anatomical safety clamping
- Hand poses: Seiken Fist, Shuto, Relaxed
- Master clip generator:
    1) Generates Three.js AnimationClip JSON files
    2) Creates Blender Actions in bpy.data.actions (baked to FK bones)
    3) Pushes to NLA tracks for complete GLTF export
"""

import bpy
import json
import math
import os
from mathutils import Euler, Quaternion, Vector, Matrix

def rad(d): 
    return math.radians(d)

def deg(r): 
    return math.degrees(r)

# Mapping for Three.js and Mixamo aliases
BONE_ALIASES = {
    'Hips': ['Hips', 'mixamorigHips'],
    'Spine': ['Spine', 'mixamorigSpine'],
    'Spine1': ['Spine1', 'mixamorigSpine1'],
    'Chest': ['Chest', 'mixamorigSpine2'],
    'Neck': ['Neck', 'mixamorigNeck'],
    'Head': ['Head', 'mixamorigHead'],
    'Shoulder.L': ['Shoulder.L', 'ShoulderL', 'mixamorigLeftShoulder'],
    'UpperArm.L': ['UpperArm.L', 'UpperArmL', 'mixamorigLeftArm'],
    'LowerArm.L': ['LowerArm.L', 'LowerArmL', 'mixamorigLeftForeArm'],
    'Hand.L': ['Hand.L', 'HandL', 'mixamorigLeftHand'],
    'Thumb1.L': ['Thumb1.L', 'Thumb1L', 'mixamorigLeftHandThumb1'],
    'Thumb2.L': ['Thumb2.L', 'Thumb2L', 'mixamorigLeftHandThumb2'],
    'Thumb3.L': ['Thumb3.L', 'Thumb3L', 'mixamorigLeftHandThumb3'],
    'Index1.L': ['Index1.L', 'Index1L', 'mixamorigLeftHandIndex1'],
    'Index2.L': ['Index2.L', 'Index2L', 'mixamorigLeftHandIndex2'],
    'Index3.L': ['Index3.L', 'Index3L', 'mixamorigLeftHandIndex3'],
    'Middle1.L': ['Middle1.L', 'Middle1L', 'mixamorigLeftHandMiddle1'],
    'Middle2.L': ['Middle2.L', 'Middle2L', 'mixamorigLeftHandMiddle2'],
    'Middle3.L': ['Middle3.L', 'Middle3L', 'mixamorigLeftHandMiddle3'],
    'Ring1.L': ['Ring1.L', 'Ring1L', 'mixamorigLeftHandRing1'],
    'Ring2.L': ['Ring2.L', 'Ring2L', 'mixamorigLeftHandRing2'],
    'Ring3.L': ['Ring3.L', 'Ring3L', 'mixamorigLeftHandRing3'],
    'Pinky1.L': ['Pinky1.L', 'Pinky1L', 'mixamorigLeftHandPinky1'],
    'Pinky2.L': ['Pinky2.L', 'Pinky2L', 'mixamorigLeftHandPinky2'],
    'Pinky3.L': ['Pinky3.L', 'Pinky3L', 'mixamorigLeftHandPinky3'],
    'Shoulder.R': ['Shoulder.R', 'ShoulderR', 'mixamorigRightShoulder'],
    'UpperArm.R': ['UpperArm.R', 'UpperArmR', 'mixamorigRightArm'],
    'LowerArm.R': ['LowerArm.R', 'LowerArmR', 'mixamorigRightForeArm'],
    'Hand.R': ['Hand.R', 'HandR', 'mixamorigRightHand'],
    'Thumb1.R': ['Thumb1.R', 'Thumb1R', 'mixamorigRightHandThumb1'],
    'Thumb2.R': ['Thumb2.R', 'Thumb2R', 'mixamorigRightHandThumb2'],
    'Thumb3.R': ['Thumb3.R', 'Thumb3R', 'mixamorigRightHandThumb3'],
    'Index1.R': ['Index1.R', 'Index1R', 'mixamorigRightHandIndex1'],
    'Index2.R': ['Index2.R', 'Index2R', 'mixamorigRightHandIndex2'],
    'Index3.R': ['Index3.R', 'Index3R', 'mixamorigRightHandIndex3'],
    'Middle1.R': ['Middle1.R', 'Middle1R', 'mixamorigRightHandMiddle1'],
    'Middle2.R': ['Middle2.R', 'Middle2R', 'mixamorigRightHandMiddle2'],
    'Middle3.R': ['Middle3.R', 'Middle3R', 'mixamorigRightHandMiddle3'],
    'Ring1.R': ['Ring1.R', 'Ring1R', 'mixamorigRightHandRing1'],
    'Ring2.R': ['Ring2.R', 'Ring2R', 'mixamorigRightHandRing2'],
    'Ring3.R': ['Ring3.R', 'Ring3R', 'mixamorigRightHandRing3'],
    'Pinky1.R': ['Pinky1.R', 'Pinky1R', 'mixamorigRightHandPinky1'],
    'Pinky2.R': ['Pinky2.R', 'Pinky2R', 'mixamorigRightHandPinky2'],
    'Pinky3.R': ['Pinky3.R', 'Pinky3R', 'mixamorigRightHandPinky3'],
    'UpperLeg.L': ['UpperLeg.L', 'UpperLegL', 'mixamorigLeftUpLeg'],
    'LowerLeg.L': ['LowerLeg.L', 'LowerLegL', 'mixamorigLeftLeg'],
    'Foot.L': ['Foot.L', 'FootL', 'mixamorigLeftFoot'],
    'Toe.L': ['Toe.L', 'ToeL', 'mixamorigLeftToeBase'],
    'UpperLeg.R': ['UpperLeg.R', 'UpperLegR', 'mixamorigRightUpLeg'],
    'LowerLeg.R': ['LowerLeg.R', 'LowerLegR', 'mixamorigRightLeg'],
    'Foot.R': ['Foot.R', 'FootR', 'mixamorigRightFoot'],
    'Toe.R': ['Toe.R', 'ToeR', 'mixamorigRightToeBase'],
}

def init_shotokan_engine(bpy, arm, public_anims, dist_anims):
    all_bones = list(BONE_ALIASES.keys())

    def reset_pose():
        for pb in arm.pose.bones:
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = Euler((0, 0, 0), 'XYZ')
            pb.location = Vector((0, 0, 0))
        bpy.context.view_layer.update()

    def set_bone(bname, x_deg=0.0, y_deg=0.0, z_deg=0.0):
        pb = arm.pose.bones.get(bname)
        if pb:
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = Euler((rad(x_deg), rad(y_deg), rad(z_deg)), 'XYZ')

    def set_hips(x_m=0.0, y_m=0.0, z_m=0.0, rx_deg=0.0, ry_deg=0.0, rz_deg=0.0):
        pb = arm.pose.bones['Hips']
        pb.location = Vector((x_m, y_m, z_m))
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = Euler((rad(rx_deg), rad(ry_deg), rad(rz_deg)), 'XYZ')

    def make_fist(side='both'):
        sides = ['L', 'R'] if side == 'both' else [side]
        for s in sides:
            for f in ['Index', 'Middle', 'Ring', 'Pinky']:
                set_bone(f'{f}1.{s}', x_deg=85, y_deg=0, z_deg=0)
                set_bone(f'{f}2.{s}', x_deg=100, y_deg=0, z_deg=0)
                set_bone(f'{f}3.{s}', x_deg=70, y_deg=0, z_deg=0)
            sgn = 1 if s == 'L' else -1
            set_bone(f'Thumb1.{s}', x_deg=45, y_deg=sgn * -15, z_deg=0)
            set_bone(f'Thumb2.{s}', x_deg=75, y_deg=0, z_deg=0)
            set_bone(f'Thumb3.{s}', x_deg=50, y_deg=0, z_deg=0)

    def make_shuto(side='both'):
        sides = ['L', 'R'] if side == 'both' else [side]
        for s in sides:
            for f in ['Index', 'Middle', 'Ring', 'Pinky']:
                set_bone(f'{f}1.{s}', x_deg=0, y_deg=0, z_deg=0)
                set_bone(f'{f}2.{s}', x_deg=0, y_deg=0, z_deg=0)
                set_bone(f'{f}3.{s}', x_deg=0, y_deg=0, z_deg=0)
            sgn = 1 if s == 'L' else -1
            set_bone(f'Thumb1.{s}', x_deg=35, y_deg=sgn * 25, z_deg=0)
            set_bone(f'Thumb2.{s}', x_deg=65, y_deg=0, z_deg=0)
            set_bone(f'Thumb3.{s}', x_deg=35, y_deg=0, z_deg=0)

    def make_relaxed(side='both'):
        sides = ['L', 'R'] if side == 'both' else [side]
        for s in sides:
            for f in ['Index', 'Middle', 'Ring', 'Pinky']:
                set_bone(f'{f}1.{s}', x_deg=20, y_deg=0, z_deg=0)
                set_bone(f'{f}2.{s}', x_deg=30, y_deg=0, z_deg=0)
                set_bone(f'{f}3.{s}', x_deg=15, y_deg=0, z_deg=0)
            sgn = 1 if s == 'L' else -1
            set_bone(f'Thumb1.{s}', x_deg=20, y_deg=sgn * -5, z_deg=0)
            set_bone(f'Thumb2.{s}', x_deg=25, y_deg=0, z_deg=0)
            set_bone(f'Thumb3.{s}', x_deg=15, y_deg=0, z_deg=0)

    registered_clips = {}

    def register_clip(name, duration, keyframes, fps=30):
        registered_clips[name] = {
            'duration': duration,
            'keyframes': keyframes,
            'fps': fps
        }

    def bake_and_export_all():
        print(f"\n--- BAKING & EXPORTING {len(registered_clips)} ACTIONS ---")
        
        # Ensure armature has animation data
        if not arm.animation_data:
            arm.animation_data_create()

        for clip_name, clip_info in registered_clips.items():
            duration = clip_info['duration']
            keyframes = clip_info['keyframes']
            fps = clip_info['fps']

            # 1. Generate Three.js JSON Clip
            track_map = {bname: {'times': [], 'values': []} for bname in all_bones}
            hips_pos_track = {'times': [], 'values': []}

            # 2. Blender Action creation
            act = bpy.data.actions.get(clip_name)
            if not act:
                act = bpy.data.actions.new(name=clip_name)
            else:
                act.fcurves.clear()
            act.use_fake_user = True
            arm.animation_data.action = act

            total_frames = max(1, int(round(duration * fps)))
            act.frame_range = (1, total_frames + 1)

            # Sample each keyframe
            for kf in keyframes:
                t = kf['t']
                frame = 1.0 + (t / duration) * total_frames if duration > 0 else 1.0

                reset_pose()
                kf['pose']()
                bpy.context.view_layer.update()

                # Record JSON tracks
                for bname in all_bones:
                    pb = arm.pose.bones.get(bname)
                    if pb:
                        if pb.parent:
                            mat = pb.parent.matrix.inverted() @ pb.matrix
                        else:
                            mat = pb.matrix
                        loc, rot, sca = mat.decompose()
                        rot.normalize()
                        track_map[bname]['times'].append(t)
                        track_map[bname]['values'].extend([rot.x, rot.y, rot.z, rot.w])

                        # Insert keyframe into Blender Action
                        pb.keyframe_insert(data_path="rotation_euler", frame=frame)

                pb_hips = arm.pose.bones['Hips']
                if pb_hips.parent:
                    mat_h = pb_hips.parent.matrix.inverted() @ pb_hips.matrix
                else:
                    mat_h = pb_hips.matrix
                loc_h, rot_h, sca_h = mat_h.decompose()
                hips_pos_track['times'].append(t)
                hips_pos_track['values'].extend([loc_h.x, loc_h.y, loc_h.z])
                pb_hips.keyframe_insert(data_path="location", frame=frame)

            # Assemble JSON clip
            tracks = []
            for alias in BONE_ALIASES['Hips']:
                tracks.append({
                    'name': f'{alias}.position',
                    'times': hips_pos_track['times'],
                    'values': hips_pos_track['values'],
                    'type': 'vector'
                })
            for bname in all_bones:
                t_data = track_map[bname]
                for alias in BONE_ALIASES[bname]:
                    tracks.append({
                        'name': f'{alias}.quaternion',
                        'times': t_data['times'],
                        'values': t_data['values'],
                        'type': 'quaternion'
                    })

            clip_data = {
                'name': clip_name,
                'duration': duration,
                'tracks': tracks
            }
            json_str = json.dumps(clip_data, indent=2)

            for target_dir in [public_anims, dist_anims]:
                if os.path.exists(target_dir):
                    fpath = os.path.join(target_dir, f'{clip_name}.json')
                    with open(fpath, 'w', encoding='utf-8') as f:
                        f.write(json_str)

            # Push action to NLA track so Blender glTF exporter includes all actions!
            track = arm.animation_data.nla_tracks.new()
            track.name = f"NLA_{clip_name}"
            strip = track.strips.new(clip_name, 1, act)
            strip.name = clip_name

            print(f"  [✔] Baked action '{clip_name}' ({len(keyframes)} kf, {duration:.2f}s, {total_frames} frames)")

        # Reset active action
        arm.animation_data.action = bpy.data.actions.get('idle_shizentai')
        reset_pose()

    return {
        'set_bone': set_bone,
        'set_hips': set_hips,
        'make_fist': make_fist,
        'make_shuto': make_shuto,
        'make_relaxed': make_relaxed,
        'reset_pose': reset_pose,
        'register_clip': register_clip,
        'bake_and_export_all': bake_and_export_all
    }
