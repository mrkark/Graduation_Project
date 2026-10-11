import os, sys, json
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import heian, sample, tl

def export():
    print("Building updated Heian Shodan sequence...")
    seq, ev = heian.build_heian()
    r = tl.get_rig()
    sk = r.sk
    
    fps = 30
    print(f"Sampling animation at {fps} fps...")
    fr = sample.sample(seq.tl, fps)
    num_frames = len(fr)
    duration = round(seq.t, 3)
    print(f"Sampled {num_frames} frames, duration: {duration}s")
    
    times = [round(f['t'], 4) for f in fr]
    
    # Bone names to include (same as canonical 92-track setup)
    tracked_bones = [
        'Hips',
        'Neck', 'Head',
        'UpperArm.L', 'LowerArm.L', 'Hand.L',
        'Index1.L', 'Index2.L', 'Index3.L',
        'Middle1.L', 'Middle2.L', 'Middle3.L',
        'Pinky1.L', 'Pinky2.L', 'Pinky3.L',
        'Ring1.L', 'Ring2.L', 'Ring3.L',
        'Thumb1.L', 'Thumb2.L', 'Thumb3.L',
        'UpperArm.R', 'LowerArm.R', 'Hand.R',
        'Index1.R', 'Index2.R', 'Index3.R',
        'Middle1.R', 'Middle2.R', 'Middle3.R',
        'Pinky1.R', 'Pinky2.R', 'Pinky3.R',
        'Ring1.R', 'Ring2.R', 'Ring3.R',
        'Thumb1.R', 'Thumb2.R', 'Thumb3.R',
        'UpperLeg.L', 'LowerLeg.L', 'Foot.L',
        'UpperLeg.R', 'LowerLeg.R', 'Foot.R',
    ]
    
    tracks = []
    
    # 1. Hips position
    hips_idx = sk.idx['Hips']
    pos_values = []
    for f in fr:
        p = f['tr'][hips_idx]
        pos_values.extend([round(float(p[0]), 5), round(float(p[1]), 5), round(float(p[2]), 5)])
        
    tracks.append({
        'name': 'Hips.position',
        'times': times,
        'values': pos_values,
        'type': 'vector'
    })
    tracks.append({
        'name': 'mixamorigHips.position',
        'times': times,
        'values': pos_values,
        'type': 'vector'
    })
    
    # 2. Rotations for all tracked bones
    for bone_name in tracked_bones:
        if bone_name not in sk.idx:
            continue
        b_idx = sk.idx[bone_name]
        quat_values = []
        for f in fr:
            q = f['q'][b_idx]
            quat_values.extend([round(float(q[0]), 5), round(float(q[1]), 5), round(float(q[2]), 5), round(float(q[3]), 5)])
            
        tracks.append({
            'name': f"{bone_name}.quaternion",
            'times': times,
            'values': quat_values,
            'type': 'quaternion'
        })
        
        # Mixamo naming alias
        mixamo_name = bone_name.replace('.L', 'Left').replace('.R', 'Right')
        if not mixamo_name.startswith('mixamorig'):
            mixamo_name = f"mixamorig{mixamo_name}"
            
        tracks.append({
            'name': f"{mixamo_name}.quaternion",
            'times': times,
            'values': quat_values,
            'type': 'quaternion'
        })
        
    clip_data = {
        'name': 'heian_shodan',
        'duration': duration,
        'tracks': tracks
    }
    
    pub_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../client/public/anims'))
    dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../client/dist/anims'))
    os.makedirs(pub_dir, exist_ok=True)
    os.makedirs(dist_dir, exist_ok=True)
    
    pub_anim_path = os.path.join(pub_dir, 'heian_shodan.json')
    dist_anim_path = os.path.join(dist_dir, 'heian_shodan.json')
    
    with open(pub_anim_path, 'w', encoding='utf-8') as f:
        json.dump(clip_data, f)
    with open(dist_anim_path, 'w', encoding='utf-8') as f:
        json.dump(clip_data, f)
        
    print(f"✔ Exported updated {pub_anim_path} ({len(tracks)} tracks, duration: {duration}s)")
    
    # Also update kata_data/heian_shodan.json event timestamps to exact sync
    kata_data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../client/public/kata_data/heian_shodan.json'))
    kata_data_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../client/dist/kata_data/heian_shodan.json'))
    
    # ev contains: (n, name, t)
    # Build move events for 1..21
    events = []
    # Techniques for all 21 steps
    techniques = [
        ["L:gedan_barai"], ["R:oi_zuki"], ["R:gedan_barai"], ["R:tettsui"],
        ["L:oi_zuki"], ["L:gedan_barai"], ["R:age_uke"], ["L:age_uke"],
        ["R:age_uke"], ["L:gedan_barai"], ["R:oi_zuki"], ["R:gedan_barai"],
        ["L:oi_zuki"], ["L:gedan_barai"], ["R:oi_zuki"], ["L:oi_zuki"],
        ["R:oi_zuki"], ["L:shuto_uke"], ["R:shuto_uke"], ["R:shuto_uke"],
        ["L:shuto_uke"]
    ]
    forms = [
        "zenkutsu", "zenkutsu", "zenkutsu", "moto",
        "zenkutsu", "zenkutsu", "zenkutsu", "zenkutsu",
        "zenkutsu", "zenkutsu", "zenkutsu", "zenkutsu",
        "zenkutsu", "zenkutsu", "zenkutsu", "zenkutsu",
        "zenkutsu", "kokutsu", "kokutsu", "kokutsu",
        "kokutsu"
    ]
    
    # Compute start and end times for each move based on ev timestamps
    # ev[0] is move 1 finish, etc. Start of move 1 is 1.20s (after yoi)
    prev_t = 1.20
    for i in range(21):
        move_ev = ev[i]
        end_t = round(move_ev[2], 2)
        events.append({
            'moveNumber': i + 1,
            'technique': techniques[i],
            'form': forms[i],
            'startTime': round(prev_t, 2),
            'endTime': end_t,
            'kiai': (i + 1 == 9 or i + 1 == 17)
        })
        prev_t = end_t
        
    kata_json = {
        'kata': 'heian_shodan',
        'confidence': 'high',
        'duration': duration,
        'movesCount': 21,
        'events': events,
        'kiaiMoves': [9, 17]
    }
    
    with open(kata_data_path, 'w', encoding='utf-8') as f:
        json.dump(kata_json, f, ensure_ascii=False, indent=2)
    if os.path.exists(os.path.dirname(kata_data_dist)):
        with open(kata_data_dist, 'w', encoding='utf-8') as f:
            json.dump(kata_json, f, ensure_ascii=False, indent=2)
            
    print(f"✔ Exported updated {kata_data_path} with 21 synchronized move intervals!")

if __name__ == '__main__':
    export()
