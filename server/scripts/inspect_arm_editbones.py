import bpy
import math
from mathutils import Matrix, Vector, Euler

arm = bpy.data.objects.get('Karateka_Armature')
bpy.ops.object.mode_set(mode='EDIT')

for side in ['L', 'R']:
    for name in [f'Shoulder.{side}', f'UpperArm.{side}', f'LowerArm.{side}', f'Hand.{side}']:
        eb = arm.data.edit_bones[name]
        print(f"EditBone {name:15}: roll={math.degrees(eb.roll):.1f}°, x_axis={eb.x_axis}, y_axis={eb.y_axis}, z_axis={eb.z_axis}")

bpy.ops.object.mode_set(mode='OBJECT')
