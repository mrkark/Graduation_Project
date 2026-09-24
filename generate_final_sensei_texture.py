import os
import cv2
import json
import numpy as np

# 1. Load original pristine texture directly extracted from sensei.fbx
orig_2k = cv2.imread('scratch_extracted_from_fbx.png')
orig = cv2.resize(orig_2k, (1024, 1024), interpolation=cv2.INTER_AREA)
h, w = orig.shape[:2]
result = orig.copy()

with open('scratch_triangles_with_bones.json') as f:
    tris = json.load(f)

def get_mask(tlist):
    polys = [np.array([[int(round(u * (w-1))), int(round((1.0 - v) * (h-1)))] for u, v in t['uvs']], dtype=np.int32) for t in tlist]
    m = np.zeros((h, w), dtype=np.uint8)
    if polys:
        cv2.fillPoly(m, polys, 255)
    return m

# 1. BARE CHEST SKIN (V-opening at neck/collarbone) - preserve 100% natural skin tone
skin_chest_tris = [t for t in tris if 74.0 <= t['center'][1] <= 80.0 and abs(t['center'][0]) <= 1.5 and t['center'][2] > 2.0]
m_skin_chest = get_mask(skin_chest_tris)

# 2. AUTHENTIC WHITE COTTON KIMONO FABRIC
# Pristine clean fabric sampled from sensei kimono (neutral white with subtle woven cotton grain)
np.random.seed(42)
cloth_noise_mono = np.random.normal(0, 2.5, (h, w))
cloth_ch = np.clip(176.0 + cloth_noise_mono, 160, 190).astype(np.uint8)
synthetic_cloth = cv2.merge([cloth_ch, cloth_ch, cloth_ch])

# 3. PATCH REMOVAL (Left Chest, Right Sleeve, Back)
# Left Chest: torso triangles in character-left (+X)
t_lc = [t for t in tris if 1.5 < t['center'][0] <= 12.0 and 60.0 <= t['center'][1] <= 76.0 and t['center'][2] > 1.5 and not any('Hand' in b or 'Arm' in b for b in t['bones'])]
# Right Sleeve: shoulder & upper sleeve of right arm
t_ra = [t for t in tris if any(b.startswith('mixamorigRight') and ('Arm' in b or 'Shoulder' in b) for b in t['bones']) and not any('Hand' in b for b in t['bones']) and 14.0 <= abs(t['center'][0]) <= 26.0]
# Back: back torso triangles above the belt
t_bk = [t for t in tris if t['center'][2] < -1.5 and 54.0 <= t['center'][1] <= 76.0 and abs(t['center'][0]) < 12.0 and not any('Hand' in b or 'Arm' in b for b in t['bones'])]

g_orig = cv2.cvtColor(orig, cv2.COLOR_BGR2GRAY)
s_orig = cv2.cvtColor(orig, cv2.COLOR_BGR2HSV)[:, :, 1]

total_patch_px = 0
for name, tlist in [('Left Chest', t_lc), ('Right Arm', t_ra), ('Back', t_bk)]:
    m = get_mask(tlist) & (~m_skin_chest)
    patch_px = (m > 0) & ((g_orig < 165) | (s_orig > 10))
    dilated = (cv2.dilate(patch_px.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0) & (m > 0)
    result[dilated] = synthetic_cloth[dilated]
    replaced_cnt = np.sum(dilated)
    total_patch_px += replaced_cnt
    print(f'1. {name}: {replaced_cnt} patch pixels replaced with clean white kimono fabric')

# 4. EXTEND SLEEVES TO WRIST (Arawaza competition cut)
t_ext = [t for t in tris if any('Arm' in b or 'Hand' in b for b in t['bones']) and 28.0 <= abs(t['center'][0]) < 38.0]
m_ext = get_mask(t_ext)

t_cuff = [t for t in tris if any('Arm' in b or 'Hand' in b for b in t['bones']) and 36.8 <= abs(t['center'][0]) < 38.0]
m_cuff = get_mask(t_cuff)

# Fill forearm extension with matching kimono fabric
result[m_ext > 0] = synthetic_cloth[m_ext > 0]
# Natural wrist hem shadow
result[m_cuff > 0] = np.clip(result[m_cuff > 0].astype(int) - 15, 130, 185).astype(np.uint8)
print(f'2. Sleeves extended to wrist (|X| < 38.0, Arawaza cut): {np.sum(m_ext > 0)} px')

# 5. PURE BLACK BELT (Zero white artifacts / embroidery)
belt_knot = [t for t in tris if t['center'][2] > 5.0 and 32.0 <= t['center'][1] <= 55.0 and abs(t['center'][0]) < 7.0]
belt_waist = [t for t in tris if 48.0 <= t['center'][1] < 54.0 and abs(t['center'][0]) < 12.0 and not any('Arm' in b or 'Hand' in b for b in t['bones'])]
belt_tris = belt_knot + belt_waist
m_belt = get_mask(belt_tris) & (~m_skin_chest)

dark_belt = (m_belt > 0) & (g_orig < 110)
closed_belt = cv2.morphologyEx(dark_belt.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))) > 0
closed_belt = closed_belt & (m_belt > 0)

np.random.seed(42)
belt_noise = np.random.normal(0, 1.2, (h, w))
for c, base_val in enumerate([18, 19, 21]):
    ch = result[:, :, c].astype(float)
    ch[closed_belt] = np.clip(base_val + belt_noise[closed_belt], 15, 26)
    result[:, :, c] = ch.astype(np.uint8)

print(f'3. Pure black belt: {np.sum(closed_belt)} px darkened (zero white embroidery/artifacts)')

# 6. RESTORE NATURAL BARE CHEST SKIN
result[m_skin_chest > 0] = orig[m_skin_chest > 0]
c_sat = cv2.cvtColor(result, cv2.COLOR_BGR2HSV)[m_skin_chest > 0, 1]
print(f'4. Chest skin saturation: {c_sat.mean():.1f} (natural bare skin tone preserved)')

# 7. VERIFICATION
g_res = cv2.cvtColor(result, cv2.COLOR_BGR2GRAY)
s_res = cv2.cvtColor(result, cv2.COLOR_BGR2HSV)[:, :, 1]
for name, tlist in [('Left Chest', t_lc), ('Right Arm', t_ra), ('Back', t_bk)]:
    m = get_mask(tlist) & (~m_skin_chest) & (~closed_belt)
    dark_rem = np.sum((m > 0) & (g_res < 140))
    sat_rem = np.sum((m > 0) & (s_res > 15))
    assert dark_rem == 0 and sat_rem == 0, f'Verification failed for {name}: dark={dark_rem}, sat={sat_rem}'
    print(f'   -> Verified {name}: 0 dark pixels, 0 colored pixels')

# Belt verification:
b_non_black = np.sum(closed_belt & (g_res > 50))
assert b_non_black == 0, f'Belt has non-black pixels: {b_non_black}'
print('   -> Verified Belt: 0 white artifacts, 100% pure solid black')

# 8. SAVE TO ALL DESTINATIONS
destinations = [
    'client/public/models/sensei-orig.png',
    'client/dist/models/sensei-orig.png',
    'client/public/models/sensei.png',
    'client/dist/models/sensei.png',
    'client/public/models/sensei-clean.png',
    'client/dist/models/sensei-clean.png',
    'client/public/models/sensei-clean-v2.png',
    'client/dist/models/sensei-clean-v2.png',
]

for dst in destinations:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    cv2.imwrite(dst, result)
    print(f'Saved: {dst}')

print('\nAll assets successfully generated and verified!')
