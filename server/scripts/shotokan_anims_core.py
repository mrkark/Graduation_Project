import json
import math
import os
from mathutils import Euler, Quaternion, Vector

def init_clip_generator(bpy, arm, bone_aliases, public_anims, dist_anims):
    all_bones = list(bone_aliases.keys())

    def reset_pose():
        for pb in arm.pose.bones:
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = Euler((0, 0, 0), 'XYZ')
            pb.location = Vector((0, 0, 0))
        bpy.context.view_layer.update()

    def generate_clip(name, duration, keyframes):
        track_map = {}
        for bname in all_bones:
            track_map[bname] = {'times': [], 'values': []}
        hips_pos_track = {'times': [], 'values': []}

        for kf in keyframes:
            t = kf['t']
            reset_pose()
            kf['pose']()
            bpy.context.view_layer.update()

            for bname in all_bones:
                pb = arm.pose.bones.get(bname)
                if pb:
                    if pb.parent:
                        mat = pb.parent.matrix.inverted() @ pb.matrix
                    else:
                        mat = pb.matrix
                    loc, rot, sca = mat.decompose()
                    rot.normalize()
                    track_map[bname]['times'].append(t)
                    track_map[bname]['values'].extend([rot.x, rot.y, rot.z, rot.w])

            pb_hips = arm.pose.bones['Hips']
            if pb_hips.parent:
                mat_hips = pb_hips.parent.matrix.inverted() @ pb_hips.matrix
            else:
                mat_hips = pb_hips.matrix
            loc_hips, rot_hips, sca_hips = mat_hips.decompose()
            hips_pos_track['times'].append(t)
            hips_pos_track['values'].extend([
                loc_hips.x,
                loc_hips.y,
                loc_hips.z
            ])

        tracks = []
        # Добавляем треки позиции для таза
        for alias in bone_aliases['Hips']:
            tracks.append({
                'name': f'{alias}.position',
                'times': hips_pos_track['times'],
                'values': hips_pos_track['values'],
                'type': 'vector'
            })

        # Добавляем кватернионные треки для всех костей со всеми алиасами
        for bname in all_bones:
            t_data = track_map[bname]
            for alias in bone_aliases[bname]:
                tracks.append({
                    'name': f'{alias}.quaternion',
                    'times': t_data['times'],
                    'values': t_data['values'],
                    'type': 'quaternion'
                })

        clip_data = {
            'name': name,
            'duration': duration,
            'tracks': tracks
        }

        json_str = json.dumps(clip_data, indent=2)
        pub_path = os.path.join(public_anims, f'{name}.json')
        dist_path = os.path.join(dist_anims, f'{name}.json')
        with open(pub_path, 'w', encoding='utf-8') as f:
            f.write(json_str)
        with open(dist_path, 'w', encoding='utf-8') as f:
            f.write(json_str)

        print(f'✔ Успешно сгенерирован клип {name}.json ({len(tracks)} треков, {duration}s)')

    return generate_clip
