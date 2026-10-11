import bpy
import math
from mathutils import Euler, Vector

arm = bpy.data.objects.get('Karateka_Armature')
jacket = bpy.data.objects.get('Karateka_Gi_Jacket')
mesh = bpy.data.objects.get('Karateka_Mesh')

print("--- TESTING ARM ROLL FIX AND MESH DEFORMATION ---")

# Record vertex positions at rest
bpy.context.view_layer.update()
v_rest_mesh = [v.co.copy() for v in mesh.data.vertices[:10]]
v_rest_jacket = [v.co.copy() for v in jacket.data.vertices[:10]]

# Apply roll fix:
# Left arm: Shoulder.L, UpperArm.L, LowerArm.L, Hand.L -> roll = 90°
# Right arm: Shoulder.R, UpperArm.R, LowerArm.R, Hand.R -> roll = -90°
bpy.ops.object.mode_set(mode='EDIT')
arm.data.edit_bones['UpperArm.L'].roll = math.radians(90)
arm.data.edit_bones['LowerArm.L'].roll = math.radians(90)
arm.data.edit_bones['Hand.L'].roll = math.radians(90)

arm.data.edit_bones['UpperArm.R'].roll = math.radians(-90)
arm.data.edit_bones['LowerArm.R'].roll = math.radians(-90)
arm.data.edit_bones['Hand.R'].roll = math.radians(-90)
bpy.ops.object.mode_set(mode='OBJECT')

bpy.context.view_layer.update()
# Check if rest vertices moved
diff_mesh = max((v.co - orig).length for v, orig in zip(mesh.data.vertices[:10], v_rest_mesh))
diff_jacket = max((v.co - orig).length for v, orig in zip(jacket.data.vertices[:10], v_rest_jacket))
print(f"Rest vertex shift after roll change: mesh={diff_mesh:.6f}, jacket={diff_jacket:.6f}")

# Now test bending LowerArm.L by +90° around X
bpy.ops.object.mode_set(mode='POSE')
pb_la_l = arm.pose.bones['LowerArm.L']
pb_la_l.rotation_mode = 'XYZ'
pb_la_l.rotation_euler = Euler((math.radians(90), 0, 0), 'XYZ')

pb_la_r = arm.pose.bones['LowerArm.R']
pb_la_r.rotation_mode = 'XYZ'
pb_la_r.rotation_euler = Euler((math.radians(90), 0, 0), 'XYZ')

bpy.context.view_layer.update()

t_l = arm.matrix_world @ pb_la_l.tail
t_r = arm.matrix_world @ pb_la_r.tail
print(f"Bent LowerArm.L (+90° X) tail: ({t_l.x:.3f}, {t_l.y:.3f}, {t_l.z:.3f}) - expect forward (y < 0)!")
print(f"Bent LowerArm.R (+90° X) tail: ({t_r.x:.3f}, {t_r.y:.3f}, {t_r.z:.3f}) - expect forward (y < 0)!")

# Reset pose
pb_la_l.rotation_euler = Euler((0,0,0), 'XYZ')
pb_la_r.rotation_euler = Euler((0,0,0), 'XYZ')
bpy.ops.object.mode_set(mode='OBJECT')
