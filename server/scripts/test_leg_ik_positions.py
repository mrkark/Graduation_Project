import bpy
import math
from mathutils import Vector, Euler

arm = bpy.data.objects.get('Karateka_Armature')

print("--- TESTING LEG IK SYSTEM ---")

# Let's inspect rest positions of Foot.L and Foot.R
foot_l = arm.pose.bones['Foot.L']
print(f"Foot.L head: {arm.matrix_world @ foot_l.head}, tail: {arm.matrix_world @ foot_l.tail}")

# Check pole angle for LowerLeg.L
# LowerLeg.L: head=(0.105, 0, 0.50), tail=(0.105, 0, 0.08)
# Knee bends forward towards -Y
# So Knee Pole should be placed at y = -1.0, z = 0.50
pole_pos = Vector((0.105, -0.8, 0.50))
foot_pos = arm.matrix_world @ foot_l.head

print(f"Pole pos: {pole_pos}, Foot pos: {foot_pos}")
