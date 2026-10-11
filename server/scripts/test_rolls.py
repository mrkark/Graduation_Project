import bpy
import math
from mathutils import Euler, Vector

arm = bpy.data.objects.get('Karateka_Armature')

print("--- TESTING EDIT BONE ROLLS FOR ARMS ---")

# Let's inspect current vs test rolls
bpy.ops.object.mode_set(mode='EDIT')
eb_la_l = arm.data.edit_bones['LowerArm.L']
orig_roll_l = eb_la_l.roll

for test_roll in [-90, 0, 90]:
    eb_la_l.roll = math.radians(test_roll)
    print(f"Roll {test_roll:3d}° -> x_axis={eb_la_l.x_axis}, z_axis={eb_la_l.z_axis}")

# Reset
eb_la_l.roll = orig_roll_l
bpy.ops.object.mode_set(mode='OBJECT')
