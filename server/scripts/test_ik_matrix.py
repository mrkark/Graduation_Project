import bpy
import math
from mathutils import Vector, Matrix, Euler

arm = bpy.data.objects.get('Karateka_Armature')
def rad(d): return math.radians(d)

print("--- TESTING MATRIX TRANSLATION FOR IK FEET ---")

bpy.ops.object.mode_set(mode='POSE')
ctrl_f_l = arm.pose.bones['CTRL_Foot_IK.L']
ctrl_f_r = arm.pose.bones['CTRL_Foot_IK.R']

# Place front foot (Left) at x=0.16, y=-0.45 (forward!), z=0.08 (floor)
ctrl_f_l.matrix = Matrix.Translation(Vector((0.16, -0.45, 0.08)))

# Place rear foot (Right) at x=-0.16, y=0.45 (back!), z=0.08 (floor)
# with 35° outward rotation around Z
rot_mat_r = Matrix.Rotation(rad(35), 4, 'Z')
ctrl_f_r.matrix = Matrix.Translation(Vector((-0.16, 0.45, 0.08))) @ rot_mat_r

# Drop hips
arm.pose.bones['Hips'].location = Vector((0, -0.05, -0.16))

bpy.context.view_layer.update()

fl = arm.matrix_world @ arm.pose.bones['Foot.L'].head
fr = arm.matrix_world @ arm.pose.bones['Foot.R'].head
kl = arm.matrix_world @ arm.pose.bones['LowerLeg.L'].head
kr = arm.matrix_world @ arm.pose.bones['LowerLeg.R'].head

print(f"Front Foot (L) pos: ({fl.x:.3f}, {fl.y:.3f}, {fl.z:.3f})")
print(f"Rear Foot (R) pos:  ({fr.x:.3f}, {fr.y:.3f}, {fr.z:.3f})")
print(f"Front Knee (L) pos: ({kl.x:.3f}, {kl.y:.3f}, {kl.z:.3f})")
print(f"Rear Knee (R) pos:  ({kr.x:.3f}, {kr.y:.3f}, {kr.z:.3f})")
print(f"Stance length: {abs(fl.y - fr.y):.3f}m")
print(f"Stance width:  {abs(fl.x - fr.x):.3f}m")

bpy.ops.object.mode_set(mode='OBJECT')
