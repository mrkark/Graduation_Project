import bpy
import math
from mathutils import Euler, Vector

arm = bpy.data.objects.get('Karateka_Armature')
def rad(d): return math.radians(d)

print("--- TESTING PERFECT HIKITE AND PUNCH ---")

bpy.ops.object.mode_set(mode='POSE')

# Reset
for pb in arm.pose.bones:
    pb.rotation_euler = Euler((0,0,0), 'XYZ')
    pb.location = Vector((0,0,0))

# 1. Left Hikite:
# UpperArm.L: down and slightly back
arm.pose.bones['Shoulder.L'].rotation_euler = Euler((rad(2), 0, rad(-6)), 'XYZ')
arm.pose.bones['UpperArm.L'].rotation_euler = Euler((rad(-12), rad(85), rad(-85)), 'XYZ')
arm.pose.bones['LowerArm.L'].rotation_euler = Euler((rad(125), rad(-85), 0), 'XYZ')
arm.pose.bones['Hand.L'].rotation_euler = Euler((0, 0, 0), 'XYZ')

# 2. Right Punch:
# UpperArm.R: forward along centerline
# To punch forward at chest level (Z ~ 1.25):
arm.pose.bones['Shoulder.R'].rotation_euler = Euler((rad(-2), 0, rad(4)), 'XYZ')
arm.pose.bones['UpperArm.R'].rotation_euler = Euler((rad(82), rad(-85), rad(12)), 'XYZ')
arm.pose.bones['LowerArm.R'].rotation_euler = Euler((rad(6), rad(85), 0), 'XYZ')
arm.pose.bones['Hand.R'].rotation_euler = Euler((rad(2), 0, 0), 'XYZ')

bpy.context.view_layer.update()

hl = arm.matrix_world @ arm.pose.bones['Hand.L'].head
el = arm.matrix_world @ arm.pose.bones['LowerArm.L'].head

hr = arm.matrix_world @ arm.pose.bones['Hand.R'].head
er = arm.matrix_world @ arm.pose.bones['LowerArm.R'].head

print(f"Hikite Left Hand:  ({hl.x:.3f}, {hl.y:.3f}, {hl.z:.3f})")
print(f"Hikite Left Elbow: ({el.x:.3f}, {el.y:.3f}, {el.z:.3f})")
print(f"Punch Right Hand:  ({hr.x:.3f}, {hr.y:.3f}, {hr.z:.3f})")
print(f"Punch Right Elbow: ({er.x:.3f}, {er.y:.3f}, {er.z:.3f})")

bpy.ops.object.mode_set(mode='OBJECT')
