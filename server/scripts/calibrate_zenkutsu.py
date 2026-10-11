import bpy
import math
from mathutils import Vector, Euler

arm = bpy.data.objects.get('Karateka_Armature')
def rad(d): return math.radians(d)

print("--- CALIBRATING ZENKUTSU-DACHI STANCE GEOMETRY ---")

bpy.ops.object.mode_set(mode='POSE')

# Reset
for pb in arm.pose.bones:
    pb.rotation_euler = Euler((0,0,0), 'XYZ')
    pb.location = Vector((0,0,0))

# Zenkutsu calibration:
# Hip drop: z = -0.16m, advanced slightly y = -0.06m
arm.pose.bones['Hips'].location = Vector((0.02, -0.06, -0.16))
arm.pose.bones['Hips'].rotation_euler = Euler((rad(2), 0, 0), 'XYZ')

# Front leg (Left):
arm.pose.bones['UpperLeg.L'].rotation_euler = Euler((rad(-60), rad(-6), rad(-8)), 'XYZ')
arm.pose.bones['LowerLeg.L'].rotation_euler = Euler((rad(92), 0, 0), 'XYZ') # 92° flexion -> shin vertical!
arm.pose.bones['Foot.L'].rotation_euler = Euler((rad(-32), 0, 0), 'XYZ') # flat on floor!

# Rear leg (Right):
arm.pose.bones['UpperLeg.R'].rotation_euler = Euler((rad(32), rad(22), rad(16)), 'XYZ')
arm.pose.bones['LowerLeg.R'].rotation_euler = Euler((rad(4), 0, 0), 'XYZ') # 4° micro-flex
arm.pose.bones['Foot.R'].rotation_euler = Euler((rad(28), rad(18), 0), 'XYZ') # flat on floor, 35° angle

bpy.context.view_layer.update()

fl = arm.matrix_world @ arm.pose.bones['Foot.L'].head
fr = arm.matrix_world @ arm.pose.bones['Foot.R'].head
kl = arm.matrix_world @ arm.pose.bones['LowerLeg.L'].head

print(f"Front Foot (L): ({fl.x:.3f}, {fl.y:.3f}, {fl.z:.3f})")
print(f"Rear Foot (R):  ({fr.x:.3f}, {fr.y:.3f}, {fr.z:.3f})")
print(f"Front Knee (L): ({kl.x:.3f}, {kl.y:.3f}, {kl.z:.3f})")
print(f"Shin verticality: delta_y(knee, foot) = {abs(kl.y - fl.y):.3f}m (ideal <= 0.05m)")
print(f"Stance length:   {abs(fl.y - fr.y):.3f}m (canonical: 0.85-0.95m)")
print(f"Stance width:    {abs(fl.x - fr.x):.3f}m (canonical: 0.30-0.35m)")

bpy.ops.object.mode_set(mode='OBJECT')
