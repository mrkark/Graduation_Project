"""
Главный запускаемый скрипт генерации анимаций каратэ Шотокан
на базе 3D-модели karateka-lowpoly
Запуск: & "D:\\program files (x86)\\steam\\steamapps\\common\\Blender\\blender.exe" -b "client\\public\\models\\karateka_lowpoly.blend" -P "server\\scripts\\generate_karateka_shotokan_anims.py"
"""

import bpy
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from shotokan_anims_core import init_clip_generator
from shotokan_stances_and_punches import register_stances_and_punches
from shotokan_strikes_and_blocks import register_strikes_and_blocks
from shotokan_kicks_and_combos import register_kicks_and_combos

PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
CLIENT_DIR = os.path.join(PROJECT_ROOT, 'client')
PUBLIC_ANIMS = os.path.join(CLIENT_DIR, 'public', 'anims')
DIST_ANIMS = os.path.join(CLIENT_DIR, 'dist', 'anims')
PUBLIC_MODELS = os.path.join(CLIENT_DIR, 'public', 'models')
DIST_MODELS = os.path.join(CLIENT_DIR, 'dist', 'models')

# Настройка арматуры
arm = bpy.data.objects.get('Karateka_Armature')
if not arm:
    raise RuntimeError("Karateka_Armature not found in blend file!")

arm.hide_viewport = False
arm.hide_render = False
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')

# Маппинг алиасов костей
BONE_ALIASES = {
    'Hips': ['Hips', 'mixamorigHips'],
    'Spine': ['Spine', 'mixamorigSpine'],
    'Spine1': ['Spine1', 'mixamorigSpine1'],
    'Chest': ['Chest', 'mixamorigSpine2'],
    'Neck': ['Neck', 'mixamorigNeck'],
    'Head': ['Head', 'mixamorigHead'],
    'Shoulder.L': ['Shoulder.L', 'ShoulderL', 'mixamorigLeftShoulder'],
    'UpperArm.L': ['UpperArm.L', 'UpperArmL', 'mixamorigLeftArm'],
    'LowerArm.L': ['LowerArm.L', 'LowerArmL', 'mixamorigLeftForeArm'],
    'Hand.L': ['Hand.L', 'HandL', 'mixamorigLeftHand'],
    'Thumb1.L': ['Thumb1.L', 'Thumb1L', 'mixamorigLeftHandThumb1'],
    'Thumb2.L': ['Thumb2.L', 'Thumb2L', 'mixamorigLeftHandThumb2'],
    'Thumb3.L': ['Thumb3.L', 'Thumb3L', 'mixamorigLeftHandThumb3'],
    'Index1.L': ['Index1.L', 'Index1L', 'mixamorigLeftHandIndex1'],
    'Index2.L': ['Index2.L', 'Index2L', 'mixamorigLeftHandIndex2'],
    'Index3.L': ['Index3.L', 'Index3L', 'mixamorigLeftHandIndex3'],
    'Middle1.L': ['Middle1.L', 'Middle1L', 'mixamorigLeftHandMiddle1'],
    'Middle2.L': ['Middle2.L', 'Middle2L', 'mixamorigLeftHandMiddle2'],
    'Middle3.L': ['Middle3.L', 'Middle3L', 'mixamorigLeftHandMiddle3'],
    'Ring1.L': ['Ring1.L', 'Ring1L', 'mixamorigLeftHandRing1'],
    'Ring2.L': ['Ring2.L', 'Ring2L', 'mixamorigLeftHandRing2'],
    'Ring3.L': ['Ring3.L', 'Ring3L', 'mixamorigLeftHandRing3'],
    'Pinky1.L': ['Pinky1.L', 'Pinky1L', 'mixamorigLeftHandPinky1'],
    'Pinky2.L': ['Pinky2.L', 'Pinky2L', 'mixamorigLeftHandPinky2'],
    'Pinky3.L': ['Pinky3.L', 'Pinky3L', 'mixamorigLeftHandPinky3'],
    'Shoulder.R': ['Shoulder.R', 'ShoulderR', 'mixamorigRightShoulder'],
    'UpperArm.R': ['UpperArm.R', 'UpperArmR', 'mixamorigRightArm'],
    'LowerArm.R': ['LowerArm.R', 'LowerArmR', 'mixamorigRightForeArm'],
    'Hand.R': ['Hand.R', 'HandR', 'mixamorigRightHand'],
    'Thumb1.R': ['Thumb1.R', 'Thumb1R', 'mixamorigRightHandThumb1'],
    'Thumb2.R': ['Thumb2.R', 'Thumb2R', 'mixamorigRightHandThumb2'],
    'Thumb3.R': ['Thumb3.R', 'Thumb3R', 'mixamorigRightHandThumb3'],
    'Index1.R': ['Index1.R', 'Index1R', 'mixamorigRightHandIndex1'],
    'Index2.R': ['Index2.R', 'Index2R', 'mixamorigRightHandIndex2'],
    'Index3.R': ['Index3.R', 'Index3R', 'mixamorigRightHandIndex3'],
    'Middle1.R': ['Middle1.R', 'Middle1R', 'mixamorigRightHandMiddle1'],
    'Middle2.R': ['Middle2.R', 'Middle2R', 'mixamorigRightHandMiddle2'],
    'Middle3.R': ['Middle3.R', 'Middle3R', 'mixamorigRightHandMiddle3'],
    'Ring1.R': ['Ring1.R', 'Ring1R', 'mixamorigRightHandRing1'],
    'Ring2.R': ['Ring2.R', 'Ring2R', 'mixamorigRightHandRing2'],
    'Ring3.R': ['Ring3.R', 'Ring3R', 'mixamorigRightHandRing3'],
    'Pinky1.R': ['Pinky1.R', 'Pinky1R', 'mixamorigRightHandPinky1'],
    'Pinky2.R': ['Pinky2.R', 'Pinky2R', 'mixamorigRightHandPinky2'],
    'Pinky3.R': ['Pinky3.R', 'Pinky3R', 'mixamorigRightHandPinky3'],
    'UpperLeg.L': ['UpperLeg.L', 'UpperLegL', 'mixamorigLeftUpLeg'],
    'LowerLeg.L': ['LowerLeg.L', 'LowerLegL', 'mixamorigLeftLeg'],
    'Foot.L': ['Foot.L', 'FootL', 'mixamorigLeftFoot'],
    'Toe.L': ['Toe.L', 'ToeL', 'mixamorigLeftToeBase'],
    'UpperLeg.R': ['UpperLeg.R', 'UpperLegR', 'mixamorigRightUpLeg'],
    'LowerLeg.R': ['LowerLeg.R', 'LowerLegR', 'mixamorigRightLeg'],
    'Foot.R': ['Foot.R', 'FootR', 'mixamorigRightFoot'],
    'Toe.R': ['Toe.R', 'ToeR', 'mixamorigRightToeBase'],
}

from mathutils import Euler, Vector
import math

def rad(d): return math.radians(d)

def set_bone(bname, x_deg=0, y_deg=0, z_deg=0):
    pb = arm.pose.bones.get(bname)
    if pb:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = Euler((rad(x_deg), rad(y_deg), rad(z_deg)), 'XYZ')

def set_hips(x_m=0, y_m=0, z_m=0, rx_deg=0, ry_deg=0, rz_deg=0, **kwargs):
    pb = arm.pose.bones['Hips']
    pb.location = Vector((x_m, y_m, z_m))
    pb.rotation_mode = 'XYZ'
    rx = kwargs.get('x_deg', rx_deg)
    ry = kwargs.get('y_deg', ry_deg)
    rz = kwargs.get('z_deg', rz_deg)
    pb.rotation_euler = Euler((rad(rx), rad(ry), rad(rz)), 'XYZ')

def make_fist(side='both'):
    sides = ['L', 'R'] if side == 'both' else [('L' if side in ['left', 'L'] else 'R')]
    for s in sides:
        for f in ['Index', 'Middle', 'Ring', 'Pinky']:
            set_bone(f'{f}1.{s}', x_deg=85, y_deg=0, z_deg=0)
            set_bone(f'{f}2.{s}', x_deg=100, y_deg=0, z_deg=0)
            set_bone(f'{f}3.{s}', x_deg=70, y_deg=0, z_deg=0)
        sgn = 1 if s == 'L' else -1
        set_bone(f'Thumb1.{s}', x_deg=50, y_deg=sgn * -10, z_deg=0)
        set_bone(f'Thumb2.{s}', x_deg=80, y_deg=0, z_deg=0)
        set_bone(f'Thumb3.{s}', x_deg=50, y_deg=0, z_deg=0)

def make_shuto(side='both'):
    sides = ['L', 'R'] if side == 'both' else [('L' if side in ['left', 'L'] else 'R')]
    for s in sides:
        for f in ['Index', 'Middle', 'Ring', 'Pinky']:
            set_bone(f'{f}1.{s}', x_deg=0, y_deg=0, z_deg=0)
            set_bone(f'{f}2.{s}', x_deg=0, y_deg=0, z_deg=0)
            set_bone(f'{f}3.{s}', x_deg=0, y_deg=0, z_deg=0)
        sgn = 1 if s == 'L' else -1
        set_bone(f'Thumb1.{s}', x_deg=40, y_deg=sgn * 20, z_deg=0)
        set_bone(f'Thumb2.{s}', x_deg=60, y_deg=0, z_deg=0)
        set_bone(f'Thumb3.{s}', x_deg=30, y_deg=0, z_deg=0)

def pose_hikite(side='left'):
    if side in ['left', 'L']:
        set_bone('Shoulder.L', x_deg=10, y_deg=0, z_deg=15)
        set_bone('UpperArm.L', x_deg=-18, y_deg=-75, z_deg=75)
        set_bone('LowerArm.L', x_deg=115, y_deg=-80, z_deg=0)
        set_bone('Hand.L', x_deg=-10, y_deg=0, z_deg=0)
        make_fist('L')
    else:
        set_bone('Shoulder.R', x_deg=10, y_deg=0, z_deg=-15)
        set_bone('UpperArm.R', x_deg=-18, y_deg=75, z_deg=-75)
        set_bone('LowerArm.R', x_deg=115, y_deg=80, z_deg=0)
        set_bone('Hand.R', x_deg=-10, y_deg=0, z_deg=0)
        make_fist('R')

def pose_chudan_punch(side='right', extend=1.0):
    if side in ['right', 'R']:
        twist = 80 * extend
        reach_z = 82 * extend
        elbow_bend = 5 * (1.0 - extend)
        set_bone('Shoulder.R', x_deg=-10 * extend, y_deg=0, z_deg=-5 * extend)
        set_bone('UpperArm.R', x_deg=-12 * extend, y_deg=twist, z_deg=reach_z)
        set_bone('LowerArm.R', x_deg=elbow_bend, y_deg=twist, z_deg=0)
        set_bone('Hand.R', x_deg=0, y_deg=0, z_deg=0)
        make_fist('R')
    else:
        twist = -80 * extend
        reach_z = -82 * extend
        elbow_bend = 5 * (1.0 - extend)
        set_bone('Shoulder.L', x_deg=-10 * extend, y_deg=0, z_deg=5 * extend)
        set_bone('UpperArm.L', x_deg=-12 * extend, y_deg=twist, z_deg=reach_z)
        set_bone('LowerArm.L', x_deg=elbow_bend, y_deg=twist, z_deg=0)
        set_bone('Hand.L', x_deg=0, y_deg=0, z_deg=0)
        make_fist('L')

def pose_stance_yoi(breath=0.0):
    b = breath * 0.04
    set_hips(0, 0, b * 0.1, rx_deg=0, ry_deg=0, rz_deg=0)
    set_bone('Spine', x_deg=2 + b * 2, y_deg=0, z_deg=0)
    set_bone('Spine1', x_deg=2 + b * 2, y_deg=0, z_deg=0)
    set_bone('Chest', x_deg=1 + b * 3, y_deg=0, z_deg=0)
    set_bone('UpperLeg.L', x_deg=-4, y_deg=0, z_deg=-3)
    set_bone('LowerLeg.L', x_deg=6, y_deg=0, z_deg=0)
    set_bone('Foot.L', x_deg=-2, y_deg=0, z_deg=0)
    set_bone('UpperLeg.R', x_deg=-4, y_deg=0, z_deg=3)
    set_bone('LowerLeg.R', x_deg=6, y_deg=0, z_deg=0)
    set_bone('Foot.R', x_deg=-2, y_deg=0, z_deg=0)
    set_bone('Shoulder.L', x_deg=4, y_deg=0, z_deg=5)
    set_bone('UpperArm.L', x_deg=-75, y_deg=-20, z_deg=-15)
    set_bone('LowerArm.L', x_deg=35, y_deg=-20, z_deg=0)
    set_bone('Shoulder.R', x_deg=4, y_deg=0, z_deg=-5)
    set_bone('UpperArm.R', x_deg=-75, y_deg=20, z_deg=15)
    set_bone('LowerArm.R', x_deg=35, y_deg=20, z_deg=0)
    make_fist('both')

def pose_stance_zenkutsu(side='left', hanmi=False, breath=0.0):
    b = breath * 0.02
    h_rot = 35 if hanmi else 0
    set_hips(0, -0.08, -0.14 + b * 0.05, rx_deg=3, ry_deg=h_rot, rz_deg=0)
    set_bone('Spine', x_deg=3, y_deg=h_rot * 0.2, z_deg=0)
    set_bone('Spine1', x_deg=2, y_deg=h_rot * 0.2, z_deg=0)
    set_bone('Chest', x_deg=2, y_deg=h_rot * 0.3, z_deg=0)
    if side == 'left':
        set_bone('UpperLeg.L', x_deg=-48, y_deg=-8, z_deg=-6)
        set_bone('LowerLeg.L', x_deg=78, y_deg=0, z_deg=0)
        set_bone('Foot.L', x_deg=-18, y_deg=0, z_deg=0)
        set_bone('UpperLeg.R', x_deg=22, y_deg=15, z_deg=12)
        set_bone('LowerLeg.R', x_deg=2, y_deg=0, z_deg=0)
        set_bone('Foot.R', x_deg=18, y_deg=12, z_deg=0)
    else:
        set_bone('UpperLeg.R', x_deg=-48, y_deg=8, z_deg=6)
        set_bone('LowerLeg.R', x_deg=78, y_deg=0, z_deg=0)
        set_bone('Foot.R', x_deg=-18, y_deg=0, z_deg=0)
        set_bone('UpperLeg.L', x_deg=22, y_deg=-15, z_deg=-12)
        set_bone('LowerLeg.L', x_deg=2, y_deg=0, z_deg=0)
        set_bone('Foot.L', x_deg=18, y_deg=-12, z_deg=0)

def pose_stance_kokutsu(side='left', breath=0.0):
    b = breath * 0.02
    set_hips(0, 0.12, -0.16 + b * 0.05, rx_deg=2, ry_deg=-45, rz_deg=0)
    set_bone('Spine', x_deg=2, y_deg=-15, z_deg=0)
    set_bone('Chest', x_deg=2, y_deg=-15, z_deg=0)
    set_bone('UpperLeg.R', x_deg=-55, y_deg=25, z_deg=15)
    set_bone('LowerLeg.R', x_deg=90, y_deg=0, z_deg=0)
    set_bone('Foot.R', x_deg=-20, y_deg=25, z_deg=0)
    set_bone('UpperLeg.L', x_deg=-25, y_deg=-10, z_deg=-5)
    set_bone('LowerLeg.L', x_deg=20, y_deg=0, z_deg=0)
    set_bone('Foot.L', x_deg=10, y_deg=0, z_deg=0)

def pose_stance_kiba(breath=0.0):
    b = breath * 0.02
    set_hips(0, 0, -0.18 + b * 0.05, rx_deg=0, ry_deg=0, rz_deg=0)
    set_bone('Spine', x_deg=1, y_deg=0, z_deg=0)
    set_bone('Chest', x_deg=1, y_deg=0, z_deg=0)
    set_bone('UpperLeg.L', x_deg=-42, y_deg=0, z_deg=-32)
    set_bone('LowerLeg.L', x_deg=75, y_deg=0, z_deg=0)
    set_bone('Foot.L', x_deg=-22, y_deg=0, z_deg=0)
    set_bone('UpperLeg.R', x_deg=-42, y_deg=0, z_deg=32)
    set_bone('LowerLeg.R', x_deg=75, y_deg=0, z_deg=0)
    set_bone('Foot.R', x_deg=-22, y_deg=0, z_deg=0)

def pose_stance_fudo(breath=0.0):
    b = breath * 0.02
    set_hips(0, -0.04, -0.16 + b * 0.05, rx_deg=2, ry_deg=20, z_deg=0)
    set_bone('UpperLeg.L', x_deg=-46, y_deg=-10, z_deg=-16)
    set_bone('LowerLeg.L', x_deg=72, y_deg=0, z_deg=0)
    set_bone('Foot.L', x_deg=-16, y_deg=0, z_deg=0)
    set_bone('UpperLeg.R', x_deg=-32, y_deg=15, z_deg=18)
    set_bone('LowerLeg.R', x_deg=55, y_deg=0, z_deg=0)
    set_bone('Foot.R', x_deg=-10, y_deg=15, z_deg=0)

def pose_stance_gankaku(breath=0.0):
    b = breath * 0.02
    set_hips(0, 0, -0.06 + b * 0.04, rx_deg=2, ry_deg=-10, z_deg=0)
    set_bone('UpperLeg.L', x_deg=-12, y_deg=0, z_deg=-2)
    set_bone('LowerLeg.L', x_deg=20, y_deg=0, z_deg=0)
    set_bone('Foot.L', x_deg=-6, y_deg=0, z_deg=0)
    set_bone('UpperLeg.R', x_deg=-95, y_deg=30, z_deg=22)
    set_bone('LowerLeg.R', x_deg=135, y_deg=0, z_deg=0)
    set_bone('Foot.R', x_deg=35, y_deg=0, z_deg=0)

poses = {
    'yoi': pose_stance_yoi,
    'zenkutsu': pose_stance_zenkutsu,
    'kokutsu': pose_stance_kokutsu,
    'kiba': pose_stance_kiba,
    'fudo': pose_stance_fudo,
    'gankaku': pose_stance_gankaku,
    'hikite': pose_hikite,
    'chudan_punch': pose_chudan_punch,
    'fist': make_fist,
    'shuto': make_shuto,
    'set_bone': set_bone,
    'set_hips': set_hips
}

# Инициализируем генератор клипов
gen_clip = init_clip_generator(bpy, arm, BONE_ALIASES, PUBLIC_ANIMS, DIST_ANIMS)

print("Генерация всех 34 канонических техник Шотокан на модели karateka-lowpoly...")
register_stances_and_punches(gen_clip, poses)
register_strikes_and_blocks(gen_clip, poses)
register_kicks_and_combos(gen_clip, poses)

# Экспортируем обновленный karateka_lowpoly.glb
glb_pub = os.path.join(PUBLIC_MODELS, 'karateka_lowpoly.glb')
glb_dist = os.path.join(DIST_MODELS, 'karateka_lowpoly.glb')
bpy.ops.export_scene.gltf(filepath=glb_pub, export_format='GLB')
if os.path.exists(glb_pub):
    import shutil
    shutil.copyfile(glb_pub, glb_dist)
    print(f"✔ Экспортирована модель GLB: {glb_pub} и {glb_dist}")

print("=== ГЕНЕРАЦИЯ АНИМАЦИЙ ШОТОКАН ЗАВЕРШЕНА УСПЕШНО ===")
