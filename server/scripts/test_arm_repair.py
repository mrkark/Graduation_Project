import bpy
import math
from mathutils import Euler, Vector

arm = bpy.data.objects.get('Karateka_Armature')

def rad(d): return math.radians(d)

print("--- TESTING ARM RIG REPAIR ---")

# Step 1: Set Edit Bone rolls
bpy.ops.object.mode_set(mode='EDIT')
for side, roll_deg in [('L', 90), ('R', -90)]:
    arm.data.edit_bones[f'Shoulder.{side}'].roll = rad(roll_deg)
    arm.data.edit_bones[f'UpperArm.{side}'].roll = rad(roll_deg)
    arm.data.edit_bones[f'LowerArm.{side}'].roll = rad(roll_deg)
    arm.data.edit_bones[f'Hand.{side}'].roll = rad(roll_deg)
bpy.ops.object.mode_set(mode='OBJECT')

# Step 2: Update constraints on LowerArm
for side in ['L', 'R']:
    pb_la = arm.pose.bones[f'LowerArm.{side}']
    for c in pb_la.constraints:
        if c.type == 'LIMIT_ROTATION':
            c.use_limit_x = True
            c.min_x = rad(0)
            c.max_x = rad(145)
            c.use_limit_y = True
            c.min_y = rad(-90)
            c.max_y = rad(90)
            c.use_limit_z = True
            c.min_z = rad(-8)
            c.max_z = rad(8)

# Step 3: Test a punch pose with Left Arm (straight punch forward)
# In rest pose, arm points out to left (+X).
# To punch forward (-Y), shoulder/upperarm swings forward and down.
bpy.ops.object.mode_set(mode='POSE')
pb_ua = arm.pose.bones['UpperArm.L']
pb_la = arm.pose.bones['LowerArm.L']
pb_h  = arm.pose.bones['Hand.L']

# Let's test rotating UpperArm to aim forward (-Y) at chest level (Z ~ 1.25):
# With roll=90:
# local x_axis = (0, 0, -1) (down)
# local y_axis = (1, 0, 0)  (out)
# local z_axis = (0, -1, 0) (forward)
print("UpperArm.L bone matrix local:")
print(arm.data.bones['UpperArm.L'].matrix_local)

# Let's test swinging arm forward:
# If arm rests along +X, to point along -Y:
# rotating 90° around Z_world brings +X to -Y!
# Let's check rotation modes:
pb_ua.rotation_mode = 'XYZ'
pb_la.rotation_mode = 'XYZ'
pb_h.rotation_mode = 'XYZ'

# Let's see how UpperArm behaves:
pb_ua.rotation_euler = Euler((rad(15), rad(-80), rad(-75)), 'XYZ')
pb_la.rotation_euler = Euler((rad(5), rad(-85), 0), 'XYZ')
bpy.context.view_layer.update()

hand_pos = arm.matrix_world @ pb_h.head
print(f"Punch Hand pos: ({hand_pos.x:.3f}, {hand_pos.y:.3f}, {hand_pos.z:.3f})")

# Reset
pb_ua.rotation_euler = Euler((0,0,0), 'XYZ')
pb_la.rotation_euler = Euler((0,0,0), 'XYZ')
bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')
