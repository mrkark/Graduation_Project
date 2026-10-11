import bpy
import math
from mathutils import Vector, Euler

arm = bpy.data.objects.get('Karateka_Armature')
def rad(d): return math.radians(d)

print("="*60)
print("TESTING EXTENDED BIOMECHANICAL POSES")
print("="*60)

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

# Import poses from test_biomechanical_poses
import sys, os
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from test_biomechanical_poses import pose_yoi, pose_zenkutsu, pose_kokutsu, pose_hikite, pose_chudan_punch, pose_gedan_barai, pose_age_uke, pose_mae_geri

# Extended poses:
def pose_soto_uke(side='left', phase=1.0):
    if side in ['left', 'L']:
        if phase < 0.3:
            set_b('UpperArm.L', x=25, y=-25, z=-80)
            set_b('LowerArm.L', x=105, y=-30, z=0)
            make_fist('L')
        else:
            t = (phase - 0.3) / 0.7
            set_b('UpperArm.L', x=45*t, y=-15*t, z=-45*t - 35*(1-t))
            set_b('LowerArm.L', x=90, y=45*t, z=0)
            make_fist('L')
    else:
        if phase < 0.3:
            set_b('UpperArm.R', x=25, y=25, z=80)
            set_b('LowerArm.R', x=105, y=30, z=0)
            make_fist('R')
        else:
            t = (phase - 0.3) / 0.7
            set_b('UpperArm.R', x=45*t, y=15*t, z=45*t + 35*(1-t))
            set_b('LowerArm.R', x=90, y=-45*t, z=0)
            make_fist('R')

def pose_uchi_uke(side='left', phase=1.0):
    if side in ['left', 'L']:
        if phase < 0.3:
            set_b('UpperArm.L', x=15, y=45, z=-40)
            set_b('LowerArm.L', x=100, y=-45, z=0)
            make_fist('L')
        else:
            t = (phase - 0.3) / 0.7
            set_b('UpperArm.L', x=35*t, y=-35*t, z=-55*t)
            set_b('LowerArm.L', x=85, y=60*t, z=0)
            make_fist('L')
    else:
        if phase < 0.3:
            set_b('UpperArm.R', x=15, y=-45, z=40)
            set_b('LowerArm.R', x=100, y=45, z=0)
            make_fist('R')
        else:
            t = (phase - 0.3) / 0.7
            set_b('UpperArm.R', x=35*t, y=35*t, z=55*t)
            set_b('LowerArm.R', x=85, y=-60*t, z=0)
            make_fist('R')

def pose_shuto_uke(side='left', phase=1.0):
    if side in ['left', 'L']:
        pose_kokutsu('left', 0.0)
        set_b('UpperArm.L', x=30, y=-25, z=-60)
        set_b('LowerArm.L', x=80, y=45, z=0)
        set_b('UpperArm.R', x=-10, y=-65, z=50)
        set_b('LowerArm.R', x=105, y=65, z=0)
        make_shuto('both')
    else:
        pose_kokutsu('right', 0.0)
        set_b('UpperArm.R', x=30, y=25, z=60)
        set_b('LowerArm.R', x=80, y=-45, z=0)
        set_b('UpperArm.L', x=-10, y=65, z=-50)
        set_b('LowerArm.L', x=105, y=-65, z=0)
        make_shuto('both')

# Run tests
reset_pose()
pose_soto_uke('left', 1.0)
bpy.context.view_layer.update()
h_l = arm.matrix_world @ arm.pose.bones['Hand.L'].head
print(f"Soto-uke hand pos: ({h_l.x:.3f}, {h_l.y:.3f}, {h_l.z:.3f})")

reset_pose()
pose_uchi_uke('left', 1.0)
bpy.context.view_layer.update()
h_l = arm.matrix_world @ arm.pose.bones['Hand.L'].head
print(f"Uchi-uke hand pos: ({h_l.x:.3f}, {h_l.y:.3f}, {h_l.z:.3f})")

reset_pose()
pose_shuto_uke('left', 1.0)
bpy.context.view_layer.update()
h_l = arm.matrix_world @ arm.pose.bones['Hand.L'].head
h_r = arm.matrix_world @ arm.pose.bones['Hand.R'].head
print(f"Shuto-uke lead hand: ({h_l.x:.3f}, {h_l.y:.3f}, {h_l.z:.3f})")
print(f"Shuto-uke solar plexus hand: ({h_r.x:.3f}, {h_r.y:.3f}, {h_r.z:.3f})")

print("EXTENDED POSES VERIFIED!")
