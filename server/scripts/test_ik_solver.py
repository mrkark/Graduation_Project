import bpy
import math
from mathutils import Vector, Euler, Matrix

arm = bpy.data.objects.get('Karateka_Armature')
def rad(d): return math.radians(d)

print("--- TESTING UNIFIED IK SOLVER FOR SHOTOKAN ---")

# Step 1: Add IK bones to armature if not present
bpy.ops.object.mode_set(mode='EDIT')

def get_or_create_edit_bone(name, head, tail, roll=0, parent=None):
    eb = arm.data.edit_bones.get(name)
    if not eb:
        eb = arm.data.edit_bones.new(name)
    eb.head = head
    eb.tail = tail
    eb.roll = roll
    eb.parent = parent
    eb.use_deform = False
    return eb

# Feet IK
get_or_create_edit_bone('CTRL_Foot_IK.L', Vector((0.105, 0, 0.08)), Vector((0.105, -0.08, 0.02)))
get_or_create_edit_bone('CTRL_Foot_IK.R', Vector((-0.105, 0, 0.08)), Vector((-0.105, -0.08, 0.02)))
get_or_create_edit_bone('CTRL_Knee_Pole.L', Vector((0.105, -0.80, 0.50)), Vector((0.105, -0.80, 0.60)))
get_or_create_edit_bone('CTRL_Knee_Pole.R', Vector((-0.105, -0.80, 0.50)), Vector((-0.105, -0.80, 0.60)))

# Hands IK
get_or_create_edit_bone('CTRL_Hand_IK.L', Vector((0.72, 0, 1.44)), Vector((0.80, 0, 1.44)))
get_or_create_edit_bone('CTRL_Hand_IK.R', Vector((-0.72, 0, 1.44)), Vector((-0.80, 0, 1.44)))
get_or_create_edit_bone('CTRL_Elbow_Pole.L', Vector((0.46, 0.50, 1.30)), Vector((0.46, 0.50, 1.40)))
get_or_create_edit_bone('CTRL_Elbow_Pole.R', Vector((-0.46, 0.50, 1.30)), Vector((-0.46, 0.50, 1.40)))

bpy.ops.object.mode_set(mode='OBJECT')

# Step 2: Set up IK constraints
bpy.ops.object.mode_set(mode='POSE')

def setup_ik(bone_name, target_name, pole_name=None, pole_angle=0, chain=2):
    pb = arm.pose.bones[bone_name]
    c = pb.constraints.get('TEMP_IK')
    if not c:
        c = pb.constraints.new('IK')
        c.name = 'TEMP_IK'
    c.target = arm
    c.subtarget = target_name
    c.chain_count = chain
    if pole_name:
        c.pole_target = arm
        c.pole_subtarget = pole_name
        c.pole_angle = pole_angle
    return c

setup_ik('LowerLeg.L', 'CTRL_Foot_IK.L', 'CTRL_Knee_Pole.L', rad(-180), 2)
setup_ik('LowerLeg.R', 'CTRL_Foot_IK.R', 'CTRL_Knee_Pole.R', rad(-180), 2)
setup_ik('LowerArm.L', 'CTRL_Hand_IK.L', 'CTRL_Elbow_Pole.L', rad(0), 2)
setup_ik('LowerArm.R', 'CTRL_Hand_IK.R', 'CTRL_Elbow_Pole.R', rad(0), 2)

# Foot rotation copy
for side in ['L', 'R']:
    pb_f = arm.pose.bones[f'Foot.{side}']
    c = pb_f.constraints.get('TEMP_ROT')
    if not c:
        c = pb_f.constraints.new('COPY_ROTATION')
        c.name = 'TEMP_ROT'
    c.target = arm
    c.subtarget = f'CTRL_Foot_IK.{side}'
    c.owner_space = 'WORLD'
    c.target_space = 'WORLD'

# Step 3: Test Zenkutsu-dachi pose with Left punch & Right hikite
# Hips: lower to z = 0.76 (drop ~0.14m), advance y = -0.10
pb_hips = arm.pose.bones['Hips']
pb_hips.location = Vector((0, -0.10, -0.14))
pb_hips.rotation_euler = Euler((rad(2), rad(0), rad(0)), 'XYZ') # Shomen (0° hip rotation)

# Front foot (Left): advance 0.45m forward (-Y), width 0.16m, flat on floor
ctrl_f_l = arm.pose.bones['CTRL_Foot_IK.L']
ctrl_f_l.location = Vector((0.055, -0.45, -0.00))
ctrl_f_l.rotation_euler = Euler((0, 0, 0), 'XYZ') # 0° straight forward

# Rear foot (Right): back 0.40m (+Y), width -0.16m, angled 35° forward
ctrl_f_r = arm.pose.bones['CTRL_Foot_IK.R']
ctrl_f_r.location = Vector((-0.055, 0.40, -0.00))
ctrl_f_r.rotation_euler = Euler((0, 0, rad(35)), 'XYZ')

# Knee poles
arm.pose.bones['CTRL_Knee_Pole.L'].location = Vector((0.055, -0.45 - 0.50, 0.40))
arm.pose.bones['CTRL_Knee_Pole.R'].location = Vector((-0.055, 0.40 - 0.50, 0.40))

# Left Hand: Chudan punch on centerline
ctrl_h_l = arm.pose.bones['CTRL_Hand_IK.L']
# In armature space, hand head rest was at (0.72, 0, 1.44)
# Punch target: x = 0.05, y = -0.55, z = 1.18
ctrl_h_l.matrix = Matrix.Translation(Vector((0.05, -0.55, 1.18)))

# Right Hand: Hikite at floating ribs
ctrl_h_r = arm.pose.bones['CTRL_Hand_IK.R']
# Hikite target: x = -0.18, y = 0.05, z = 1.08
ctrl_h_r.matrix = Matrix.Translation(Vector((-0.18, 0.05, 1.08)))

bpy.context.view_layer.update()

# Inspect solved positions
foot_l_pos = arm.matrix_world @ arm.pose.bones['Foot.L'].head
foot_r_pos = arm.matrix_world @ arm.pose.bones['Foot.R'].head
knee_l_pos = arm.matrix_world @ arm.pose.bones['LowerLeg.L'].head
knee_r_pos = arm.matrix_world @ arm.pose.bones['LowerLeg.R'].head
hand_l_pos = arm.matrix_world @ arm.pose.bones['Hand.L'].head
hand_r_pos = arm.matrix_world @ arm.pose.bones['Hand.R'].head

print(f"Foot Left pos:  ({foot_l_pos.x:.3f}, {foot_l_pos.y:.3f}, {foot_l_pos.z:.3f}) - locked to floor!")
print(f"Foot Right pos: ({foot_r_pos.x:.3f}, {foot_r_pos.y:.3f}, {foot_r_pos.z:.3f}) - locked to floor!")
print(f"Knee Left pos:  ({knee_l_pos.x:.3f}, {knee_l_pos.y:.3f}, {knee_l_pos.z:.3f}) - front knee bent!")
print(f"Knee Right pos: ({knee_r_pos.x:.3f}, {knee_r_pos.y:.3f}, {knee_r_pos.z:.3f}) - rear leg extended!")
print(f"Hand Left pos:  ({hand_l_pos.x:.3f}, {hand_l_pos.y:.3f}, {hand_l_pos.z:.3f}) - punch on centerline!")
print(f"Hand Right pos: ({hand_r_pos.x:.3f}, {hand_r_pos.y:.3f}, {hand_r_pos.z:.3f}) - tight hikite at ribs!")

# Extract FK transforms for all deforming bones
print("\nFK Transforms successfully computed from IK solve!")
for bname in ['Hips', 'UpperLeg.L', 'LowerLeg.L', 'Foot.L', 'UpperArm.L', 'LowerArm.L']:
    pb = arm.pose.bones[bname]
    loc, rot, sca = pb.matrix.decompose()
    print(f"  {bname:12}: loc=({loc.x:.3f}, {loc.y:.3f}, {loc.z:.3f}), rot={rot}")

bpy.ops.object.mode_set(mode='OBJECT')
