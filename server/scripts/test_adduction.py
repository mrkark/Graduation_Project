import bpy
import math
from mathutils import Euler, Vector

arm = bpy.data.objects.get('Karateka_Armature')
def rad(d): return math.radians(d)

bpy.ops.object.mode_set(mode='POSE')
pb_l = arm.pose.bones['UpperArm.L']
pb_r = arm.pose.bones['UpperArm.R']

pb_l.rotation_euler = Euler((0, 0, rad(-90)), 'XYZ')
pb_r.rotation_euler = Euler((0, 0, rad(90)), 'XYZ')
bpy.context.view_layer.update()

tl = arm.matrix_world @ pb_l.tail
tr = arm.matrix_world @ pb_r.tail
print(f"UpperArm.L Z=-90° -> tail = ({tl.x:.3f}, {tl.y:.3f}, {tl.z:.3f})")
print(f"UpperArm.R Z=+90° -> tail = ({tr.x:.3f}, {tr.y:.3f}, {tr.z:.3f})")

pb_l.rotation_euler = Euler((0,0,0), 'XYZ')
pb_r.rotation_euler = Euler((0,0,0), 'XYZ')
bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')
