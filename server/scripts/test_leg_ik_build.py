import bpy
import math
from mathutils import Vector, Euler

arm = bpy.data.objects.get('Karateka_Armature')

print("--- TESTING TEMPORARY IK RIG BUILD ---")

bpy.ops.object.mode_set(mode='EDIT')
# Add IK bones if not exist
for side, sgn in [('L', 1), ('R', -1)]:
    b_foot = arm.data.edit_bones[f'Foot.{side}']
    
    name_ik = f'CTRL_Foot_IK.{side}'
    if name_ik not in arm.data.edit_bones:
        eb_ik = arm.data.edit_bones.new(name_ik)
        eb_ik.head = b_foot.head.copy()
        eb_ik.tail = b_foot.tail.copy()
        eb_ik.roll = b_foot.roll
        eb_ik.parent = None
        eb_ik.use_deform = False
    
    name_pole = f'CTRL_Knee_Pole.{side}'
    if name_pole not in arm.data.edit_bones:
        eb_pole = arm.data.edit_bones.new(name_pole)
        eb_pole.head = Vector((sgn * 0.105, -0.80, 0.50))
        eb_pole.tail = Vector((sgn * 0.105, -0.80, 0.60))
        eb_pole.parent = None
        eb_pole.use_deform = False

bpy.ops.object.mode_set(mode='OBJECT')

# Add constraints in pose mode
bpy.ops.object.mode_set(mode='POSE')
for side in ['L', 'R']:
    pb_ll = arm.pose.bones[f'LowerLeg.{side}']
    pb_foot = arm.pose.bones[f'Foot.{side}']
    
    # Check if IK constraint already exists
    c_ik = pb_ll.constraints.get('IK_LEG')
    if not c_ik:
        c_ik = pb_ll.constraints.new('IK')
        c_ik.name = 'IK_LEG'
    c_ik.target = arm
    c_ik.subtarget = f'CTRL_Foot_IK.{side}'
    c_ik.pole_target = arm
    c_ik.pole_subtarget = f'CTRL_Knee_Pole.{side}'
    c_ik.chain_count = 2
    
    # Find best pole angle where rest leg rotation is (0,0,0)
    best_ang = 0
    min_diff = 999
    for test_deg in range(-180, 181, 15):
        c_ik.pole_angle = math.radians(test_deg)
        bpy.context.view_layer.update()
        pb_ul = arm.pose.bones[f'UpperLeg.{side}']
        # measure twist difference from rest
        mat = pb_ul.matrix
        # check how close to identity in rest
        diff = abs(pb_ul.rotation_euler.y) + abs(pb_ul.rotation_euler.z)
        # also check lower leg
        diff += abs(pb_ll.rotation_euler.y) + abs(pb_ll.rotation_euler.z)
        if diff < min_diff:
            min_diff = diff
            best_ang = test_deg
    
    # Try more fine grained
    for fine_deg in range(best_ang - 15, best_ang + 16):
        c_ik.pole_angle = math.radians(fine_deg)
        bpy.context.view_layer.update()
        pb_ul = arm.pose.bones[f'UpperLeg.{side}']
        pb_ll = arm.pose.bones[f'LowerLeg.{side}']
        diff = abs(pb_ul.rotation_euler.y) + abs(pb_ul.rotation_euler.z) + abs(pb_ll.rotation_euler.y) + abs(pb_ll.rotation_euler.z)
        if diff < min_diff:
            min_diff = diff
            best_ang = fine_deg

    c_ik.pole_angle = math.radians(best_ang)
    print(f"Side {side}: Best pole angle = {best_ang}° (diff={min_diff:.4f})")
    
    # Copy rotation constraint on foot
    c_rot = pb_foot.constraints.get('ROT_FOOT')
    if not c_rot:
        c_rot = pb_foot.constraints.new('COPY_ROTATION')
        c_rot.name = 'ROT_FOOT'
    c_rot.target = arm
    c_rot.subtarget = f'CTRL_Foot_IK.{side}'
    c_rot.owner_space = 'WORLD'
    c_rot.target_space = 'WORLD'

# Now test moving Hips down (squatting):
pb_hips = arm.pose.bones['Hips']
pb_hips.location = Vector((0, 0, -0.15))
bpy.context.view_layer.update()

for side in ['L', 'R']:
    f_pos = arm.matrix_world @ arm.pose.bones[f'Foot.{side}'].head
    print(f"After Hips lower -0.15m: Foot.{side} head = ({f_pos.x:.3f}, {f_pos.y:.3f}, {f_pos.z:.3f})")

# Reset
pb_hips.location = Vector((0,0,0))
bpy.context.view_layer.update()

# Remove test constraints and bones
for side in ['L', 'R']:
    pb_ll = arm.pose.bones[f'LowerLeg.{side}']
    c = pb_ll.constraints.get('IK_LEG')
    if c: pb_ll.constraints.remove(c)
    pb_f = arm.pose.bones[f'Foot.{side}']
    c2 = pb_f.constraints.get('ROT_FOOT')
    if c2: pb_f.constraints.remove(c2)

bpy.ops.object.mode_set(mode='EDIT')
for side in ['L', 'R']:
    for n in [f'CTRL_Foot_IK.{side}', f'CTRL_Knee_Pole.{side}']:
        if n in arm.data.edit_bones:
            arm.data.edit_bones.remove(arm.data.edit_bones[n])
bpy.ops.object.mode_set(mode='OBJECT')

print("IK Test cleanup complete.")
