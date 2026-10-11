"""
Script for STEP 2 & STEP 3:
- Fix Arm EditBone rolls (Left: +90°, Right: -90°)
- Fix LowerArm and UpperArm constraints (Elbow flexion on X: [0°, 145°], Y twist: [-90°, 90°], Z carrying: [-8°, 8°])
- Fix Hips constraint: release Local Y limit to [-180°, 180°] (or no Y limit) for full Koshi/Hanmi rotation; keep safe X and Z tilt limits.
- Fix vertex defects 1792 and 2224 on Karateka_Mesh (assigned to Hips + UpperLeg)
- Add Spine1 vertex group and smooth spine weights across Karateka_Mesh and Karateka_Gi_Jacket
- Add finger vertex groups and skin fingers to allow proper Seiken fist curl
- Save the updated blend file to both client/public/models and client/dist/models
"""

import bpy
import math
from mathutils import Vector, Euler
import shutil
import os

print("="*60)
print("EXECUTING STEP 2 & STEP 3: REPAIR RIG CONSTRAINTS, AXES & SKINNING")
print("="*60)

arm = bpy.data.objects.get('Karateka_Armature')
mesh = bpy.data.objects.get('Karateka_Mesh')
jacket = bpy.data.objects.get('Karateka_Gi_Jacket')
pants = bpy.data.objects.get('Karateka_Gi_Pants')
obi = bpy.data.objects.get('Karateka_Belt_Obi')

def rad(d): return math.radians(d)

# -------------------------------------------------------------
# 1. EDIT BONE ROLLS (UpperArm, LowerArm, Hand)
# -------------------------------------------------------------
print("\n[1] Updating EditBone rolls...")
bpy.ops.object.mode_set(mode='EDIT')

for side, roll_deg in [('L', 90), ('R', -90)]:
    for part in ['Shoulder', 'UpperArm', 'LowerArm', 'Hand']:
        bname = f'{part}.{side}'
        eb = arm.data.edit_bones.get(bname)
        if eb:
            eb.roll = rad(roll_deg)
            print(f"  {bname}: roll set to {roll_deg}°")

bpy.ops.object.mode_set(mode='OBJECT')

# -------------------------------------------------------------
# 2. BONE CONSTRAINTS REPAIR
# -------------------------------------------------------------
print("\n[2] Repairing bone constraints...")

# Hips: allow full axial rotation for Hanmi, Shomen, turns, and pivots
pb_hips = arm.pose.bones.get('Hips')
if pb_hips:
    for c in pb_hips.constraints:
        if c.type == 'LIMIT_ROTATION':
            c.use_limit_x = True
            c.min_x = rad(-25)
            c.max_x = rad(25)
            c.use_limit_y = True
            c.min_y = rad(-180)
            c.max_y = rad(180)
            c.use_limit_z = True
            c.min_z = rad(-20)
            c.max_z = rad(20)
            print("  Hips: Limit Rotation updated to X:[-25°, 25°], Y:[-180°, 180°], Z:[-20°, 20°]")

# Spine & Spine1 & Chest: allow smooth natural torso rotation
for sp_name in ['Spine', 'Spine1', 'Chest']:
    pb = arm.pose.bones.get(sp_name)
    if pb:
        for c in pb.constraints:
            if c.type == 'LIMIT_ROTATION':
                c.use_limit_x = True
                c.min_x = rad(-25)
                c.max_x = rad(25)
                c.use_limit_y = True
                c.min_y = rad(-35)
                c.max_y = rad(35)
                c.use_limit_z = True
                c.min_z = rad(-25)
                c.max_z = rad(25)
                print(f"  {sp_name}: Limit Rotation updated to X:[-25°, 25°], Y:[-35°, 35°], Z:[-25°, 25°]")

# LowerArm.L & LowerArm.R: Natural elbow flexion on X, pronation/supination on Y, carrying angle on Z
for side in ['L', 'R']:
    pb_la = arm.pose.bones.get(f'LowerArm.{side}')
    if pb_la:
        for c in pb_la.constraints:
            if c.type == 'LIMIT_ROTATION':
                c.use_limit_x = True
                c.min_x = rad(0)       # 0° = straight arm (no hyperextension)
                c.max_x = rad(145)     # 145° = full anatomical flexion forward
                c.use_limit_y = True
                c.min_y = rad(-90)     # pronation / supination
                c.max_y = rad(90)
                c.use_limit_z = True
                c.min_z = rad(-8)      # carrying angle
                c.max_z = rad(8)
                print(f"  LowerArm.{side}: Limit Rotation updated to X:[0°, 145°] (flexion), Y:[-90°, 90°] (twist), Z:[-8°, 8°]")

# UpperArm.L & UpperArm.R:
for side in ['L', 'R']:
    pb_ua = arm.pose.bones.get(f'UpperArm.{side}')
    if pb_ua:
        for c in pb_ua.constraints:
            if c.type == 'LIMIT_ROTATION':
                # With roll 90°/-90°:
                # X: flexion forward / extension back [-90°, 180°]
                # Y: humeral rotation (twist) [-90°, 90°]
                # Z: abduction / adduction [-90°, 90°]
                c.use_limit_x = True
                c.min_x = rad(-90)
                c.max_x = rad(180)
                c.use_limit_y = True
                c.min_y = rad(-90)
                c.max_y = rad(90)
                c.use_limit_z = True
                c.min_z = rad(-90)
                c.max_z = rad(90)
                print(f"  UpperArm.{side}: Limit Rotation updated to X:[-90°, 180°], Y:[-90°, 90°], Z:[-90°, 90°]")

# Hand.L & Hand.R:
for side in ['L', 'R']:
    pb_h = arm.pose.bones.get(f'Hand.{side}')
    if pb_h:
        for c in pb_h.constraints:
            if c.type == 'LIMIT_ROTATION':
                c.use_limit_x = True
                c.min_x = rad(-45)
                c.max_x = rad(45)
                c.use_limit_y = True
                c.min_y = rad(-30)
                c.max_y = rad(30)
                c.use_limit_z = True
                c.min_z = rad(-25)
                c.max_z = rad(25)
                print(f"  Hand.{side}: Limit Rotation updated")

# -------------------------------------------------------------
# 3. VERTEX DEFECTS 1792 and 2224 REPAIR
# -------------------------------------------------------------
print("\n[3] Fixing vertex defects 1792 and 2224...")
vg_hips = mesh.vertex_groups.get('Hips')
vg_ul_l = mesh.vertex_groups.get('UpperLeg.L')
vg_ul_r = mesh.vertex_groups.get('UpperLeg.R')

vg_hips.add([1792], 0.5, 'REPLACE')
vg_ul_l.add([1792], 0.5, 'REPLACE')

vg_hips.add([2224], 0.5, 'REPLACE')
vg_ul_r.add([2224], 0.5, 'REPLACE')
print("  Vertices 1792 and 2224 assigned to Hips (0.5) and UpperLeg (0.5)")

# Check zero-weight vertices
zero_w = [v.index for v in mesh.data.vertices if len(v.groups) == 0 or max([g.weight for g in v.groups], default=0) < 0.001]
print(f"  Unweighted vertices in Karateka_Mesh: {len(zero_w)}")

# -------------------------------------------------------------
# 4. SPINE1 SMOOTHING ACROSS MESHES
# -------------------------------------------------------------
print("\n[4] Smoothing Spine1 weights...")
for target_obj in [mesh, jacket]:
    vg_s1 = target_obj.vertex_groups.get('Spine1')
    if not vg_s1:
        vg_s1 = target_obj.vertex_groups.new(name='Spine1')
    vg_s = target_obj.vertex_groups.get('Spine')
    vg_c = target_obj.vertex_groups.get('Chest')

    count_s1 = 0
    for v in target_obj.data.vertices:
        z = v.co.z
        if 1.15 <= z <= 1.35 and abs(v.co.x) < 0.35 and abs(v.co.y) < 0.25:
            w_s = 0.0
            w_c = 0.0
            for g in v.groups:
                if vg_s and g.group == vg_s.index: w_s = g.weight
                if vg_c and g.group == vg_c.index: w_c = g.weight
            
            total_sc = w_s + w_c
            if total_sc > 0.05:
                t = (z - 1.15) / (1.35 - 1.15)
                w_s1_factor = math.sin(t * math.pi) * 0.55
                rem = 1.0 - w_s1_factor
                
                new_w_s = total_sc * (rem * (1.0 - t))
                new_w_c = total_sc * (rem * t)
                new_w_s1 = total_sc * w_s1_factor
                
                vg_s.add([v.index], new_w_s, 'REPLACE')
                vg_c.add([v.index], new_w_c, 'REPLACE')
                vg_s1.add([v.index], new_w_s1, 'REPLACE')
                count_s1 += 1
    print(f"  Object {target_obj.name}: vertices smoothed to Spine1 = {count_s1}")

# -------------------------------------------------------------
# 5. FINGER SKINNING REPAIR
# -------------------------------------------------------------
print("\n[5] Repairing finger skinning on Karateka_Mesh...")
finger_bone_names = []
for side in ['L', 'R']:
    for f in ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']:
        for seg in [1, 2, 3]:
            finger_bone_names.append(f"{f}{seg}.{side}")

def dist_to_segment(p, a, b):
    ab = b - a
    ab_len_sq = ab.length_squared
    if ab_len_sq < 1e-8:
        return (p - a).length, 0.0
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab_len_sq))
    proj = a + t * ab
    return (p - proj).length, t

bpy.ops.object.mode_set(mode='EDIT')
bone_segs = {}
for bname in finger_bone_names + ['Hand.L', 'Hand.R']:
    eb = arm.data.edit_bones[bname]
    bone_segs[bname] = (eb.head.copy(), eb.tail.copy())
bpy.ops.object.mode_set(mode='OBJECT')

for side in ['L', 'R']:
    vg_hand = mesh.vertex_groups.get(f'Hand.{side}')
    hand_vert_indices = [v.index for v in mesh.data.vertices for g in v.groups if g.group == vg_hand.index and g.weight > 0.1]
    
    side_finger_groups = {}
    for f in ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']:
        for seg in [1, 2, 3]:
            bname = f"{f}{seg}.{side}"
            vg = mesh.vertex_groups.get(bname)
            if not vg:
                vg = mesh.vertex_groups.new(name=bname)
            side_finger_groups[bname] = vg

    hand_head, hand_tail = bone_segs[f'Hand.{side}']
    
    reweighted = 0
    for v_idx in hand_vert_indices:
        v = mesh.data.vertices[v_idx]
        pos = v.co
        
        best_dists = []
        for bname in side_finger_groups:
            head, tail = bone_segs[bname]
            d, t = dist_to_segment(pos, head, tail)
            best_dists.append((bname, d, t))
        
        d_palm, _ = dist_to_segment(pos, hand_head, hand_tail)
        best_dists.sort(key=lambda x: x[1])
        min_f_dist = best_dists[0][1]
        
        if min_f_dist < 0.022 and min_f_dist < d_palm * 0.95:
            reweighted += 1
            top_bones = [b for b in best_dists[:3] if b[1] < min_f_dist * 2.2]
            inv_weights = [1.0 / (b[1] + 0.003)**2 for b in top_bones]
            sum_w = sum(inv_weights)
            
            base_t = top_bones[0][2]
            is_base = '1' in top_bones[0][0] and base_t < 0.2
            palm_w = 0.25 if is_base else 0.0
            finger_w_total = 1.0 - palm_w
            
            vg_hand.add([v_idx], palm_w, 'REPLACE')
            for b_info, iw in zip(top_bones, inv_weights):
                w = (iw / sum_w) * finger_w_total
                side_finger_groups[b_info[0]].add([v_idx], w, 'REPLACE')
        else:
            vg_hand.add([v_idx], 1.0, 'REPLACE')

    print(f"  Side {side}: {reweighted} vertices weighted to fingers, {len(hand_vert_indices) - reweighted} in palm")

# -------------------------------------------------------------
# 6. SAVE UPDATED BLEND FILE
# -------------------------------------------------------------
blend_pub = r"D:\Studing\4k1s\Course_Project_CTCP\bunkai-explorer\client\public\models\karateka_lowpoly.blend"
blend_dist = r"D:\Studing\4k1s\Course_Project_CTCP\bunkai-explorer\client\dist\models\karateka_lowpoly.blend"

bpy.ops.wm.save_mainfile(filepath=blend_pub)
shutil.copyfile(blend_pub, blend_dist)
print(f"\n[6] Successfully saved repaired blend file to:")
print(f"  {blend_pub}")
print(f"  {blend_dist}")

print("="*60)
print("STEPS 2 & 3 COMPLETED SUCCESSFULLY!")
print("="*60)
