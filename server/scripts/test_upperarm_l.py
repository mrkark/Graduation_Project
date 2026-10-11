import bpy
import math
from mathutils import Euler, Vector

arm = bpy.data.objects.get('Karateka_Armature')
def rad(d): return math.radians(d)

print("--- TESTING UPPERARM.L ROTATIONS WITH ROLL 90° ---")

bpy.ops.object.mode_set(mode='POSE')
pb = arm.pose.bones['UpperArm.L']
pb.rotation_mode = 'XYZ'

for axis in ['X', 'Y', 'Z']:
    for deg in [30, 60, 90]:
        pb.rotation_euler = Euler((
            rad(deg if axis=='X' else 0),
            rad(deg if axis=='Y' else 0),
            rad(deg if axis=='Z' else 0)
        ), 'XYZ')
        bpy.context.view_layer.update()
        t = arm.matrix_world @ pb.tail
        print(f"UpperArm.L {axis}={deg:2d}° -> tail = ({t.x:.3f}, {t.y:.3f}, {t.z:.3f})")

pb.rotation_euler = Euler((0,0,0), 'XYZ')
bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')
