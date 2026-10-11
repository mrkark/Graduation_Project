import bpy
import math
from mathutils import Euler, Vector

arm = bpy.data.objects.get('Karateka_Armature')

print("--- TESTING EDIT BONE ROLLS FOR RIGHT ARM ---")

bpy.ops.object.mode_set(mode='EDIT')
eb_la_r = arm.data.edit_bones['LowerArm.R']
orig_roll_r = eb_la_r.roll

for test_roll in [-90, 0, 90]:
    eb_la_r.roll = math.radians(test_roll)
    print(f"Right LowerArm Roll {test_roll:3d}° -> x_axis={eb_la_r.x_axis}, z_axis={eb_la_r.z_axis}")

# Reset
eb_la_r.roll = orig_roll_r
bpy.ops.object.mode_set(mode='OBJECT')
