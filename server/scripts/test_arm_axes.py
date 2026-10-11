import bpy
from mathutils import Euler, Vector
import math

arm = bpy.data.objects.get('Karateka_Armature')

print("--- ARMS DETAILED AXIS AUDIT ---")
for side in ['L', 'R']:
    print(f"\nSIDE: {side}")
    for bname in [f'UpperArm.{side}', f'LowerArm.{side}', f'Hand.{side}']:
        pb = arm.pose.bones.get(bname)
        b = arm.data.bones.get(bname)
        print(f"Bone: {bname}")
        print(f"  matrix_local:\n{b.matrix_local}")
        for c in pb.constraints:
            print(f"  Constraint: {c.type} {c.name}")
            if c.type == 'LIMIT_ROTATION':
                print(f"    limits: X=[{math.degrees(c.min_x):.1f}, {math.degrees(c.max_x):.1f}], Y=[{math.degrees(c.min_y):.1f}, {math.degrees(c.max_y):.1f}], Z=[{math.degrees(c.min_z):.1f}, {math.degrees(c.max_z):.1f}]")

# Let's test what happens when we bend LowerArm.L around X, Y, and Z
pb_la = arm.pose.bones['LowerArm.L']
print("\nTESTING ROTATIONS ON LowerArm.L (rest tail = (0.72, 0, 1.44)):")
pb_la.rotation_mode = 'XYZ'

for axis, angle in [('X', 45), ('Y', 45), ('Z', 45), ('Z', -45), ('X', -45)]:
    pb_la.rotation_euler = Euler((math.radians(angle if axis=='X' else 0),
                                  math.radians(angle if axis=='Y' else 0),
                                  math.radians(angle if axis=='Z' else 0)), 'XYZ')
    bpy.context.view_layer.update()
    tail_world = arm.matrix_world @ pb_la.tail
    print(f"  Rot {axis}={angle:3d}° -> LowerArm.L tail = ({tail_world.x:.3f}, {tail_world.y:.3f}, {tail_world.z:.3f})")

pb_la.rotation_euler = Euler((0,0,0), 'XYZ')
bpy.context.view_layer.update()
