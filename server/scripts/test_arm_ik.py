import bpy
import math
from mathutils import Vector

arm = bpy.data.objects.get('Karateka_Armature')

print("--- TESTING IK ON ARM ---")

# Apply roll fix: L = 90°, R = -90°
bpy.ops.object.mode_set(mode='EDIT')
for side, r in [('L', 90), ('R', -90)]:
    arm.data.edit_bones[f'UpperArm.{side}'].roll = math.radians(r)
    arm.data.edit_bones[f'LowerArm.{side}'].roll = math.radians(r)
    arm.data.edit_bones[f'Hand.{side}'].roll = math.radians(r)
bpy.ops.object.mode_set(mode='OBJECT')

# Set pose mode
bpy.ops.object.mode_set(mode='POSE')
pb_la = arm.pose.bones['LowerArm.L']

# Add temporary IK constraint
ik = pb_la.constraints.new('IK')
ik.name = "TEMP_IK_TEST"
ik.chain_count = 2

# Create target empty
empty = bpy.data.objects.new("IK_Target_Test", None)
bpy.context.scene.collection.objects.link(empty)
# Place target in front of chest (punch position): x=0.2, y=-0.5, z=1.25
empty.location = Vector((0.20, -0.45, 1.25))

ik.target = empty
bpy.context.view_layer.update()

elbow_pos = arm.matrix_world @ pb_la.head
hand_pos = arm.matrix_world @ pb_la.tail
print(f"Target pos: {empty.location}")
print(f"Elbow pos:  ({elbow_pos.x:.3f}, {elbow_pos.y:.3f}, {elbow_pos.z:.3f})")
print(f"Hand pos:   ({hand_pos.x:.3f}, {hand_pos.y:.3f}, {hand_pos.z:.3f})")

# Clean up test
pb_la.constraints.remove(ik)
bpy.data.objects.remove(empty)
bpy.ops.object.mode_set(mode='OBJECT')
