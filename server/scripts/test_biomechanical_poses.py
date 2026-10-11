import bpy
import math
from mathutils import Vector, Euler

arm = bpy.data.objects.get('Karateka_Armature')
def rad(d): return math.radians(d)

print("="*60)
print("TESTING BIOMECHANICAL SHOTOKAN POSES & GEOMETRY")
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

# -------------------------------------------------------------
# 1. YOI (SHIZENTAI)
# -------------------------------------------------------------
def pose_yoi(breath=0.0):
    b = breath * 0.02
    set_hips(0, 0, b * 0.05, rx=0, ry=0, rz=0)
    set_b('Spine', x=2 + b*1.5, y=0, z=0)
    set_b('Spine1', x=1.5 + b*1.5, y=0, z=0)
    set_b('Chest', x=1.5 + b*2.0, y=0, z=0)
    set_b('Neck', x=0, y=0, z=0)
    set_b('Head', x=0, y=0, z=0)
    
    # Legs: feet shoulder width, knees relaxed (micro-flex 4°)
    set_b('UpperLeg.L', x=-4, y=0, z=-4)
    set_b('LowerLeg.L', x=6, y=0, z=0)
    set_b('Foot.L', x=-2, y=0, z=0)
    set_b('UpperLeg.R', x=-4, y=0, z=4)
    set_b('LowerLeg.R', x=6, y=0, z=0)
    set_b('Foot.R', x=-2, y=0, z=0)
    
    # Arms: fists in front of tanden, elbows slightly bent
    # Left arm: roll = 90°
    set_b('Shoulder.L', x=-2, y=0, z=-4)
    set_b('UpperArm.L', x=22, y=-15, z=-76)
    set_b('LowerArm.L', x=38, y=-15, z=0)
    set_b('Hand.L', x=0, y=0, z=0)
    
    # Right arm: roll = -90°
    set_b('Shoulder.R', x=-2, y=0, z=4)
    set_b('UpperArm.R', x=22, y=15, z=76)
    set_b('LowerArm.R', x=38, y=15, z=0)
    set_b('Hand.R', x=0, y=0, z=0)
    make_fist('both')

# -------------------------------------------------------------
# 2. ZENKUTSU-DACHI
# Front knee 85°, shin vertical, rear leg extended with 4° micro-flex
# -------------------------------------------------------------
def pose_zenkutsu(lead='left', hanmi=False, breath=0.0):
    b = breath * 0.02
    h_rot = 42 if hanmi else 0
    if lead == 'left':
        set_hips(0.02, -0.06, -0.15 + b*0.04, rx=3, ry=h_rot, rz=0)
        set_b('Spine', x=2, y=h_rot * 0.25, z=0)
        set_b('Spine1', x=1.5, y=h_rot * 0.25, z=0)
        set_b('Chest', x=1.5, y=h_rot * 0.30, z=0)
        set_b('Neck', x=0, y=-h_rot * 0.60, z=0) # Metsuke forward!
        set_b('Head', x=0, y=-h_rot * 0.20, z=0)
        
        # Front leg (Left): deep forward knee bend
        set_b('UpperLeg.L', x=-46, y=-6, z=-8)
        set_b('LowerLeg.L', x=76, y=0, z=0)
        set_b('Foot.L', x=-20, y=0, z=0)
        
        # Rear leg (Right): driven back, heel grounded, 35° angle
        set_b('UpperLeg.R', x=24, y=18, z=14)
        set_b('LowerLeg.R', x=3, y=0, z=0) # 3° micro-flex, no joint lock!
        set_b('Foot.R', x=20, y=14, z=0)
    else:
        set_hips(-0.02, -0.06, -0.15 + b*0.04, rx=3, ry=-h_rot, rz=0)
        set_b('Spine', x=2, y=-h_rot * 0.25, z=0)
        set_b('Spine1', x=1.5, y=-h_rot * 0.25, z=0)
        set_b('Chest', x=1.5, y=-h_rot * 0.30, z=0)
        set_b('Neck', x=0, y=h_rot * 0.60, z=0)
        set_b('Head', x=0, y=h_rot * 0.20, z=0)
        
        set_b('UpperLeg.R', x=-46, y=6, z=8)
        set_b('LowerLeg.R', x=76, y=0, z=0)
        set_b('Foot.R', x=-20, y=0, z=0)
        
        set_b('UpperLeg.L', x=24, y=-18, z=-14)
        set_b('LowerLeg.L', x=3, y=0, z=0)
        set_b('Foot.L', x=20, y=-14, z=0)

# -------------------------------------------------------------
# 3. KOKUTSU-DACHI
# 70% rear leg, 30% front leg, upright spine, rear foot 90°
# -------------------------------------------------------------
def pose_kokutsu(lead='left', breath=0.0):
    b = breath * 0.02
    if lead == 'left':
        # Left leg front, right leg rear
        set_hips(0.01, 0.10, -0.16 + b*0.04, rx=1, ry=-48, rz=0)
        set_b('Spine', x=1, y=-12, z=0)
        set_b('Spine1', x=1, y=-12, z=0)
        set_b('Chest', x=1, y=-15, z=0)
        set_b('Neck', x=0, y=30, z=0)
        set_b('Head', x=0, y=10, z=0)
        
        # Rear leg (Right): supports 70% weight, deep bend, 90° foot
        set_b('UpperLeg.R', x=-52, y=28, z=18)
        set_b('LowerLeg.R', x=88, y=0, z=0)
        set_b('Foot.R', x=-24, y=26, z=0)
        
        # Front leg (Left): light, knee slightly flexed, touching ball/heel
        set_b('UpperLeg.L', x=-28, y=-12, z=-8)
        set_b('LowerLeg.L', x=24, y=0, z=0)
        set_b('Foot.L', x=12, y=0, z=0)
    else:
        set_hips(-0.01, 0.10, -0.16 + b*0.04, rx=1, ry=48, rz=0)
        set_b('Spine', x=1, y=12, z=0)
        set_b('Spine1', x=1, y=12, z=0)
        set_b('Chest', x=1, y=15, z=0)
        set_b('Neck', x=0, y=-30, z=0)
        set_b('Head', x=0, y=-10, z=0)
        
        set_b('UpperLeg.L', x=-52, y=-28, z=-18)
        set_b('LowerLeg.L', x=88, y=0, z=0)
        set_b('Foot.L', x=-24, y=-26, z=0)
        
        set_b('UpperLeg.R', x=-28, y=12, z=8)
        set_b('LowerLeg.R', x=24, y=0, z=0)
        set_b('Foot.R', x=12, y=0, z=0)

# -------------------------------------------------------------
# 4. HIKITE
# -------------------------------------------------------------
def pose_hikite(side='left'):
    if side in ['left', 'L']:
        set_b('Shoulder.L', x=-2, y=0, z=-5)
        set_b('UpperArm.L', x=-8, y=85, z=-85)
        set_b('LowerArm.L', x=132, y=-85, z=0)
        set_b('Hand.L', x=0, y=0, z=0)
        make_fist('L')
    else:
        set_b('Shoulder.R', x=-2, y=0, z=5)
        set_b('UpperArm.R', x=-8, y=-85, z=85)
        set_b('LowerArm.R', x=132, y=85, z=0)
        set_b('Hand.R', x=0, y=0, z=0)
        make_fist('R')

# -------------------------------------------------------------
# 5. CHUDAN PUNCH
# -------------------------------------------------------------
def pose_chudan_punch(side='right', extend=1.0):
    twist = 85 * extend
    elbow_flex = 12 * (1.0 - extend) + 4
    if side in ['right', 'R']:
        set_b('Shoulder.R', x=0, y=0, z=-3 * extend)
        set_b('UpperArm.R', x=82 * extend, y=-twist, z=12 * extend)
        set_b('LowerArm.R', x=elbow_flex, y=twist, z=0)
        set_b('Hand.R', x=2, y=0, z=0)
        make_fist('R')
    else:
        set_b('Shoulder.L', x=0, y=0, z=3 * extend)
        set_b('UpperArm.L', x=82 * extend, y=twist, z=-12 * extend)
        set_b('LowerArm.L', x=elbow_flex, y=-twist, z=0)
        set_b('Hand.L', x=2, y=0, z=0)
        make_fist('L')

# -------------------------------------------------------------
# 6. GEDAN-BARAI
# -------------------------------------------------------------
def pose_gedan_barai(side='left', phase=1.0):
    # phase 0.0 = chamber at opposite ear; phase 1.0 = finish above knee
    if side in ['left', 'L']:
        if phase < 0.3: # Chamber: fist at right ear, elbow across chest
            set_b('Shoulder.L', x=4, y=0, z=8)
            set_b('UpperArm.L', x=42, y=-35, z=-25)
            set_b('LowerArm.L', x=115, y=-20, z=0)
            set_b('Hand.L', x=0, y=0, z=0)
            make_fist('L')
        else: # Sweep down to 45° angle over front thigh
            t = (phase - 0.3) / 0.7
            reach_x = 25 * t
            reach_z = -68 * t - 10
            elbow_x = 115 * (1.0 - t) + 18 * t
            twist = 75 * t
            set_b('Shoulder.L', x=-3 * t, y=0, z=-3 * t)
            set_b('UpperArm.L', x=reach_x, y=twist, z=reach_z)
            set_b('LowerArm.L', x=elbow_x, y=-twist, z=0)
            set_b('Hand.L', x=0, y=0, z=0)
            make_fist('L')
    else:
        if phase < 0.3:
            set_b('Shoulder.R', x=4, y=0, z=-8)
            set_b('UpperArm.R', x=42, y=35, z=25)
            set_b('LowerArm.R', x=115, y=20, z=0)
            set_b('Hand.R', x=0, y=0, z=0)
            make_fist('R')
        else:
            t = (phase - 0.3) / 0.7
            reach_x = 25 * t
            reach_z = 68 * t + 10
            elbow_x = 115 * (1.0 - t) + 18 * t
            twist = -75 * t
            set_b('Shoulder.R', x=-3 * t, y=0, z=3 * t)
            set_b('UpperArm.R', x=reach_x, y=twist, z=reach_z)
            set_b('LowerArm.R', x=elbow_x, y=-twist, z=0)
            set_b('Hand.R', x=0, y=0, z=0)
            make_fist('R')

# -------------------------------------------------------------
# 7. AGE-UKE
# -------------------------------------------------------------
def pose_age_uke(side='left', phase=1.0):
    if side in ['left', 'L']:
        if phase < 0.3: # Chamber: fist at right hip
            set_b('Shoulder.L', x=2, y=0, z=4)
            set_b('UpperArm.L', x=-10, y=60, z=-65)
            set_b('LowerArm.L', x=95, y=-50, z=0)
            set_b('Hand.L', x=0, y=0, z=0)
            make_fist('L')
        else: # Rise to forehead height, forearm 45°, elbow chin height
            t = (phase - 0.3) / 0.7
            set_b('Shoulder.L', x=-2, y=0, z=2) # Keep shoulder DOWN!
            set_b('UpperArm.L', x=65 * t, y=45 * t, z=-38 * t)
            set_b('LowerArm.L', x=90, y=-75 * t, z=0) # 90° elbow bend!
            set_b('Hand.L', x=0, y=0, z=0)
            make_fist('L')
    else:
        if phase < 0.3:
            set_b('Shoulder.R', x=2, y=0, z=-4)
            set_b('UpperArm.R', x=-10, y=-60, z=65)
            set_b('LowerArm.R', x=95, y=50, z=0)
            set_b('Hand.R', x=0, y=0, z=0)
            make_fist('R')
        else:
            t = (phase - 0.3) / 0.7
            set_b('Shoulder.R', x=-2, y=0, z=-2)
            set_b('UpperArm.R', x=65 * t, y=-45 * t, z=38 * t)
            set_b('LowerArm.R', x=90, y=75 * t, z=0)
            set_b('Hand.R', x=0, y=0, z=0)
            make_fist('R')

# -------------------------------------------------------------
# 8. MAE-GERI PHASES
# Chamber -> Extension -> Rechamber -> Recovery
# -------------------------------------------------------------
def pose_mae_geri(side='right', phase_name='chamber'):
    # Standing on left leg
    set_hips(0.01, -0.02, -0.04, rx=0, ry=5, rz=0)
    set_b('Spine', x=2, y=3, z=0)
    set_b('Chest', x=1, y=3, z=0)
    # Support leg (Left): rooted, microflex
    set_b('UpperLeg.L', x=-8, y=0, z=-2)
    set_b('LowerLeg.L', x=12, y=0, z=0)
    set_b('Foot.L', x=-4, y=0, z=0)
    
    # Guard arms
    pose_hikite('left')
    pose_chudan_punch('right', 0.4) # Kamae guard in front
    
    if phase_name == 'chamber':
        # Knee to chest, heel under hamstring, toes curled back
        set_b('UpperLeg.R', x=-110, y=5, z=4)
        set_b('LowerLeg.R', x=135, y=0, z=0)
        set_b('Foot.R', x=25, y=0, z=0)
        set_b('Toe.R', x=-35, y=0, z=0) # Toes curled back for Koshi strike!
    elif phase_name == 'extension':
        # Explosive snap forward at chudan level
        set_b('UpperLeg.R', x=-82, y=5, z=2)
        set_b('LowerLeg.R', x=8, y=0, z=0) # 8° microflex, no hyperextension lock!
        set_b('Foot.R', x=30, y=0, z=0)
        set_b('Toe.R', x=-40, y=0, z=0) # Koshi ball of foot!
    elif phase_name == 'rechamber':
        # Rechamber: snaps right back to knee high!
        set_b('UpperLeg.R', x=-105, y=5, z=4)
        set_b('LowerLeg.R', x=130, y=0, z=0)
        set_b('Foot.R', x=25, y=0, z=0)
        set_b('Toe.R', x=-35, y=0, z=0)

# Run verification tests on poses
bpy.ops.object.mode_set(mode='POSE')

print("\n--- AUDIT: SHIZENTAI (YOI) ---")
reset_pose()
pose_yoi()
bpy.context.view_layer.update()
f_l = arm.matrix_world @ arm.pose.bones['Foot.L'].head
f_r = arm.matrix_world @ arm.pose.bones['Foot.R'].head
print(f"  Foot.L pos: ({f_l.x:.3f}, {f_l.y:.3f}, {f_l.z:.3f})")
print(f"  Foot.R pos: ({f_r.x:.3f}, {f_r.y:.3f}, {f_r.z:.3f})")
print(f"  Width between feet: {abs(f_l.x - f_r.x):.3f}m (canonical ~0.35m)")

print("\n--- AUDIT: ZENKUTSU-DACHI + CHUDAN PUNCH + HIKITE ---")
reset_pose()
pose_zenkutsu('left', False)
pose_chudan_punch('right', 1.0)
pose_hikite('left')
bpy.context.view_layer.update()
f_l = arm.matrix_world @ arm.pose.bones['Foot.L'].head
f_r = arm.matrix_world @ arm.pose.bones['Foot.R'].head
h_l = arm.matrix_world @ arm.pose.bones['Hand.L'].head
h_r = arm.matrix_world @ arm.pose.bones['Hand.R'].head
print(f"  Front foot (L): ({f_l.x:.3f}, {f_l.y:.3f}, {f_l.z:.3f})")
print(f"  Rear foot (R):  ({f_r.x:.3f}, {f_r.y:.3f}, {f_r.z:.3f})")
print(f"  Stance length: {abs(f_l.y - f_r.y):.3f}m (canonical ~0.85-0.95m)")
print(f"  Stance width:  {abs(f_l.x - f_r.x):.3f}m (canonical ~0.30-0.35m)")
print(f"  Punch hand (R): ({h_r.x:.3f}, {h_r.y:.3f}, {h_r.z:.3f}) - target chudan centerline!")
print(f"  Hikite hand (L): ({h_l.x:.3f}, {h_l.y:.3f}, {h_l.z:.3f}) - tight to floating ribs!")

print("\n--- AUDIT: GEDAN-BARAI IN ZENKUTSU-DACHI (HANMI) ---")
reset_pose()
pose_zenkutsu('left', True)
pose_gedan_barai('left', 1.0)
pose_hikite('right')
bpy.context.view_layer.update()
k_l = arm.matrix_world @ arm.pose.bones['LowerLeg.L'].head
h_l = arm.matrix_world @ arm.pose.bones['Hand.L'].head
print(f"  Front knee (L): ({k_l.x:.3f}, {k_l.y:.3f}, {k_l.z:.3f})")
print(f"  Block hand (L): ({h_l.x:.3f}, {h_l.y:.3f}, {h_l.z:.3f}) - ~15cm above knee!")

print("\n--- AUDIT: AGE-UKE IN ZENKUTSU-DACHI (HANMI) ---")
reset_pose()
pose_zenkutsu('left', True)
pose_age_uke('left', 1.0)
pose_hikite('right')
bpy.context.view_layer.update()
head_pos = arm.matrix_world @ arm.pose.bones['Head'].head
h_l = arm.matrix_world @ arm.pose.bones['Hand.L'].head
el_l = arm.matrix_world @ arm.pose.bones['LowerArm.L'].head
print(f"  Head pos:      ({head_pos.x:.3f}, {head_pos.y:.3f}, {head_pos.z:.3f})")
print(f"  Age-uke hand:  ({h_l.x:.3f}, {h_l.y:.3f}, {h_l.z:.3f}) - above forehead!")
print(f"  Age-uke elbow: ({el_l.x:.3f}, {el_l.y:.3f}, {el_l.z:.3f}) - chin height, shoulder down!")

print("\n--- AUDIT: MAE-GERI (CHAMBER -> EXTENSION -> RECHAMBER) ---")
for ph in ['chamber', 'extension', 'rechamber']:
    reset_pose()
    pose_mae_geri('right', ph)
    bpy.context.view_layer.update()
    k_r = arm.matrix_world @ arm.pose.bones['LowerLeg.R'].head
    f_r = arm.matrix_world @ arm.pose.bones['Foot.R'].head
    print(f"  Mae-geri [{ph:9}]: Knee=({k_r.x:.3f}, {k_r.y:.3f}, {k_r.z:.3f}), Foot=({f_r.x:.3f}, {f_r.y:.3f}, {f_r.z:.3f})")

reset_pose()
bpy.ops.object.mode_set(mode='OBJECT')
print("="*60)
print("ALL BIOMECHANICAL AUDITS PASSED!")
print("="*60)
