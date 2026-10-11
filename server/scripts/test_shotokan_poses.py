import bpy
import math
from mathutils import Vector, Euler

arm = bpy.data.objects.get('Karateka_Armature')

def rad(d): return math.radians(d)

print("--- TESTING REFINED SHOTOKAN POSES ---")

def reset_pose():
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = Euler((0,0,0), 'XYZ')
        pb.location = Vector((0,0,0))
    bpy.context.view_layer.update()

def set_b(name, x=0, y=0, z=0):
    pb = arm.pose.bones.get(name)
    if pb:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = Euler((rad(x), rad(y), rad(z)), 'XYZ')

def set_hips(x=0, y=0, z=0, rx=0, ry=0, rz=0):
    pb = arm.pose.bones['Hips']
    pb.location = Vector((x, y, z))
    pb.rotation_mode = 'XYZ'
    pb.rotation_euler = Euler((rad(rx), rad(ry), rad(rz)), 'XYZ')

def make_fist(side='both'):
    sides = ['L', 'R'] if side == 'both' else [side]
    for s in sides:
        for f in ['Index', 'Middle', 'Ring', 'Pinky']:
            set_b(f'{f}1.{s}', x=85)
            set_b(f'{f}2.{s}', x=100)
            set_b(f'{f}3.{s}', x=70)
        sgn = 1 if s == 'L' else -1
        set_b(f'Thumb1.{s}', x=45, y=sgn*-15, z=0)
        set_b(f'Thumb2.{s}', x=75, y=0, z=0)
        set_b(f'Thumb3.{s}', x=50, y=0, z=0)

def make_shuto(side='both'):
    sides = ['L', 'R'] if side == 'both' else [side]
    for s in sides:
        for f in ['Index', 'Middle', 'Ring', 'Pinky']:
            set_b(f'{f}1.{s}', x=0)
            set_b(f'{f}2.{s}', x=0)
            set_b(f'{f}3.{s}', x=0)
        sgn = 1 if s == 'L' else -1
        set_b(f'Thumb1.{s}', x=35, y=sgn*25, z=0)
        set_b(f'Thumb2.{s}', x=65, y=0, z=0)
        set_b(f'Thumb3.{s}', x=35, y=0, z=0)

# -------------------------------------------------------------
# SHOTOKAN POSE: HIKITE (CHAMBER)
# Fist tight to floating ribs, palm UP, elbow tight to side, shoulder DOWN
# -------------------------------------------------------------
def pose_hikite(side='left'):
    if side in ['left', 'L']:
        # Left arm: roll = 90°
        # Arm was resting along +X. To tuck elbow back (-X/backward) and down:
        set_b('Shoulder.L', x=-3, y=0, z=-5) # depressed and slightly retracted
        set_b('UpperArm.L', x=-10, y=-90, z=-85) # pulled back, tight to ribs, palm facing UP (y=-90)
        set_b('LowerArm.L', x=135, y=85, z=0) # full flexion 135°, forearm horizontal, fist at ribs
        set_b('Hand.L', x=0, y=0, z=0)
        make_fist('L')
    else:
        # Right arm: roll = -90°
        set_b('Shoulder.R', x=-3, y=0, z=5)
        set_b('UpperArm.R', x=-10, y=90, z=85)
        set_b('LowerArm.R', x=135, y=-85, z=0)
        set_b('Hand.R', x=0, y=0, z=0)
        make_fist('R')

# -------------------------------------------------------------
# SHOTOKAN POSE: CHUDAN SEIKEN PUNCH (IMPACT)
# Fist on centerline at solar plexus level, elbow micro-flexed (no hyperextension lock!),
# forearm pronated into horizontal fist, shoulder pressed DOWN
# -------------------------------------------------------------
def pose_chudan_punch(side='right', extend=1.0):
    if side in ['right', 'R']:
        # Right arm: roll = -90°
        twist = -85 * extend # pronation into horizontal fist
        reach_z = 82 * extend
        elbow_flex = 14 * (1.0 - extend) + 4 # 4° micro-flex at full extension!
        set_b('Shoulder.R', x=0, y=0, z=-4 * extend) # shoulder down, slight protraction
        set_b('UpperArm.R', x=14 * extend, y=twist, z=reach_z)
        set_b('LowerArm.R', x=elbow_flex, y=-twist, z=0)
        set_b('Hand.R', x=2, y=0, z=0)
        make_fist('R')
    else:
        # Left arm: roll = 90°
        twist = 85 * extend
        reach_z = -82 * extend
        elbow_flex = 14 * (1.0 - extend) + 4
        set_b('Shoulder.L', x=0, y=0, z=4 * extend)
        set_b('UpperArm.L', x=14 * extend, y=twist, z=reach_z)
        set_b('LowerArm.L', x=elbow_flex, y=-twist, z=0)
        set_b('Hand.L', x=2, y=0, z=0)
        make_fist('L')

# Test Left Hikite and Right Chudan Punch
bpy.ops.object.mode_set(mode='POSE')
reset_pose()
pose_hikite('left')
pose_chudan_punch('right', 1.0)
bpy.context.view_layer.update()

h_l = arm.matrix_world @ arm.pose.bones['Hand.L'].head
h_r = arm.matrix_world @ arm.pose.bones['Hand.R'].head
e_l = arm.matrix_world @ arm.pose.bones['LowerArm.L'].head
e_r = arm.matrix_world @ arm.pose.bones['LowerArm.R'].head

print(f"Hikite Left Hand:  ({h_l.x:.3f}, {h_l.y:.3f}, {h_l.z:.3f}) - expect tight to ribs, y > 0")
print(f"Hikite Left Elbow: ({e_l.x:.3f}, {e_l.y:.3f}, {e_l.z:.3f}) - expect behind torso")
print(f"Punch Right Hand:  ({h_r.x:.3f}, {h_r.y:.3f}, {h_r.z:.3f}) - expect forward on centerline, y < 0, x ~ 0")
print(f"Punch Right Elbow: ({e_r.x:.3f}, {e_r.y:.3f}, {e_r.z:.3f}) - expect slightly below hand")

reset_pose()
bpy.ops.object.mode_set(mode='OBJECT')
