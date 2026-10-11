import bpy
import math
from mathutils import Vector, Euler

arm = bpy.data.objects.get('Karateka_Armature')
def rad(d): return math.radians(d)

print("--- SOLVING EXACT STANCE ANGLES WITH IK ---")

bpy.ops.object.mode_set(mode='EDIT')
# Ensure IK bones
for side, sgn in [('L', 1), ('R', -1)]:
    b_foot = arm.data.edit_bones[f'Foot.{side}']
    eb_ik = arm.data.edit_bones.get(f'CTRL_Foot_IK.{side}')
    if not eb_ik:
        eb_ik = arm.data.edit_bones.new(f'CTRL_Foot_IK.{side}')
        eb_ik.head = b_foot.head.copy()
        eb_ik.tail = b_foot.tail.copy()
        eb_ik.parent = None
        eb_ik.use_deform = False
    
    eb_pole = arm.data.edit_bones.get(f'CTRL_Knee_Pole.{side}')
    if not eb_pole:
        eb_pole = arm.data.edit_bones.new(f'CTRL_Knee_Pole.{side}')
        eb_pole.head = Vector((sgn * 0.16, -0.80, 0.50))
        eb_pole.tail = Vector((sgn * 0.16, -0.80, 0.60))
        eb_pole.parent = None
        eb_pole.use_deform = False

bpy.ops.object.mode_set(mode='OBJECT')

bpy.ops.object.mode_set(mode='POSE')
for side in ['L', 'R']:
    pb_ll = arm.pose.bones[f'LowerLeg.{side}']
    c_ik = pb_ll.constraints.get('TEMP_IK')
    if not c_ik:
        c_ik = pb_ll.constraints.new('IK')
        c_ik.name = 'TEMP_IK'
    c_ik.target = arm
    c_ik.subtarget = f'CTRL_Foot_IK.{side}'
    c_ik.pole_target = arm
    c_ik.pole_subtarget = f'CTRL_Knee_Pole.{side}'
    c_ik.pole_angle = rad(-180)
    c_ik.chain_count = 2

    pb_f = arm.pose.bones[f'Foot.{side}']
    c_r = pb_f.constraints.get('TEMP_ROT')
    if not c_r:
        c_r = pb_f.constraints.new('COPY_ROTATION')
        c_r.name = 'TEMP_ROT'
    c_r.target = arm
    c_r.subtarget = f'CTRL_Foot_IK.{side}'

# Target: Zenkutsu Left
# Front foot (L): x = 0.16, y = -0.38, z = 0.08 (flat on floor, forward 0°)
# Rear foot (R):  x = -0.16, y = 0.48, z = 0.08 (flat on floor, angled 35°)
# Hips: drop z to -0.16, advance y to -0.05
arm.pose.bones['Hips'].location = Vector((0.02, -0.05, -0.16))
arm.pose.bones['Hips'].rotation_euler = Euler((rad(2), 0, 0), 'XYZ')

arm.pose.bones['CTRL_Foot_IK.L'].location = Vector((0.16 - 0.105, -0.38, 0.08 - 0.08))
arm.pose.bones['CTRL_Foot_IK.L'].rotation_euler = Euler((0, 0, 0), 'XYZ')

arm.pose.bones['CTRL_Foot_IK.R'].location = Vector((-0.16 - (-0.105), 0.48, 0.08 - 0.08))
arm.pose.bones['CTRL_Foot_IK.R'].rotation_euler = Euler((0, 0, rad(35)), 'XYZ')

arm.pose.bones['CTRL_Knee_Pole.L'].location = Vector((0, -0.38 - 0.50, 0.40 - 0.50))
arm.pose.bones['CTRL_Knee_Pole.R'].location = Vector((0, 0.48 - 0.50, 0.40 - 0.50))

bpy.context.view_layer.update()

fl = arm.matrix_world @ arm.pose.bones['Foot.L'].head
fr = arm.matrix_world @ arm.pose.bones['Foot.R'].head
kl = arm.matrix_world @ arm.pose.bones['LowerLeg.L'].head
kr = arm.matrix_world @ arm.pose.bones['LowerLeg.R'].head

print("\n--- IK SOLVED ZENKUTSU-DACHI ---")
print(f"Front Foot (L): ({fl.x:.3f}, {fl.y:.3f}, {fl.z:.3f})")
print(f"Rear Foot (R):  ({fr.x:.3f}, {fr.y:.3f}, {fr.z:.3f})")
print(f"Front Knee (L): ({kl.x:.3f}, {kl.y:.3f}, {kl.z:.3f})")
print(f"Rear Knee (R):  ({kr.x:.3f}, {kr.y:.3f}, {kr.z:.3f})")
print(f"Stance length: {abs(fl.y - fr.y):.3f}m")
print(f"Stance width:  {abs(fl.x - fr.x):.3f}m")

# Print the resulting local rotations
print("\nBONE MATRICES / EULERS FROM IK:")
for bname in ['UpperLeg.L', 'LowerLeg.L', 'Foot.L', 'UpperLeg.R', 'LowerLeg.R', 'Foot.R']:
    pb = arm.pose.bones[bname]
    mat = pb.parent.matrix.inverted() @ pb.matrix
    loc, rot, sca = mat.decompose()
    eul = rot.to_euler('XYZ')
    print(f"  {bname:12}: Euler deg = ({math.degrees(eul.x):.1f}°, {math.degrees(eul.y):.1f}°, {math.degrees(eul.z):.1f}°)")

bpy.ops.object.mode_set(mode='OBJECT')
