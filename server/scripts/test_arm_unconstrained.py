import bpy
from mathutils import Euler, Vector
import math

arm = bpy.data.objects.get('Karateka_Armature')
pb_la = arm.pose.bones['LowerArm.L']

# Mute constraints for test
for c in pb_la.constraints:
    c.mute = True

print("\n--- UNCONSTRAINED ROTATION TEST ON LowerArm.L ---")
for axis in ['X', 'Y', 'Z']:
    for deg in [30, 60, 90]:
        pb_la.rotation_euler = Euler((
            math.radians(deg if axis=='X' else 0),
            math.radians(deg if axis=='Y' else 0),
            math.radians(deg if axis=='Z' else 0)
        ), 'XYZ')
        bpy.context.view_layer.update()
        t = arm.matrix_world @ pb_la.tail
        print(f"Axis {axis}={deg:2d}° -> tail = ({t.x:.3f}, {t.y:.3f}, {t.z:.3f})")

pb_la.rotation_euler = Euler((0,0,0), 'XYZ')
for c in pb_la.constraints:
    c.mute = False
bpy.context.view_layer.update()
