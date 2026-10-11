import bpy
from mathutils import Vector, Euler
import math

mesh = bpy.data.objects.get('Karateka_Mesh')
arm = bpy.data.objects.get('Karateka_Armature')

print("--- TESTING FINGER SKINNING & FIST DEFORMATION ---")

# Let's collect finger bones for Left hand
finger_bone_names = []
for side in ['L', 'R']:
    for f in ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']:
        for seg in [1, 2, 3]:
            finger_bone_names.append(f"{f}{seg}.{side}")

# Helper: distance from point P to segment [A, B]
def dist_to_segment(p, a, b):
    ab = b - a
    ab_len_sq = ab.length_squared
    if ab_len_sq < 1e-8:
        return (p - a).length, 0.0
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab_len_sq))
    proj = a + t * ab
    return (p - proj).length, t

# Get bone heads and tails in rest/armature space
bpy.ops.object.mode_set(mode='EDIT')
bone_segs = {}
for bname in finger_bone_names + ['Hand.L', 'Hand.R']:
    eb = arm.data.edit_bones[bname]
    bone_segs[bname] = (eb.head.copy(), eb.tail.copy())
bpy.ops.object.mode_set(mode='OBJECT')

# Skinning Left and Right hand fingers on Karateka_Mesh
for side, sgn in [('L', 1), ('R', -1)]:
    vg_hand = mesh.vertex_groups.get(f'Hand.{side}')
    # get all vertices currently in Hand group
    hand_vert_indices = [v.index for v in mesh.data.vertices for g in v.groups if g.group == vg_hand.index and g.weight > 0.1]
    print(f"Side {side}: hand vertices count = {len(hand_vert_indices)}")
    
    # Ensure vertex groups exist
    side_finger_groups = {}
    for f in ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']:
        for seg in [1, 2, 3]:
            bname = f"{f}{seg}.{side}"
            vg = mesh.vertex_groups.get(bname)
            if not vg:
                vg = mesh.vertex_groups.new(name=bname)
            side_finger_groups[bname] = vg

    # Hand palm segment
    hand_head, hand_tail = bone_segs[f'Hand.{side}']
    
    reweighted_to_fingers = 0
    for v_idx in hand_vert_indices:
        v = mesh.data.vertices[v_idx]
        pos = v.co
        
        # Calculate distance to all finger bones of this side
        best_dists = []
        for bname in side_finger_groups:
            head, tail = bone_segs[bname]
            d, t = dist_to_segment(pos, head, tail)
            best_dists.append((bname, d, t))
        
        # Also distance to hand palm center
        d_palm, _ = dist_to_segment(pos, hand_head, hand_tail)
        
        best_dists.sort(key=lambda x: x[1])
        min_f_dist = best_dists[0][1]
        
        # If vertex is closer to a finger than palm and within finger radius (~0.022 m)
        if min_f_dist < 0.022 and min_f_dist < d_palm * 0.95:
            reweighted_to_fingers += 1
            # Blend between top 2 closest finger segments if close
            top_bones = [b for b in best_dists[:3] if b[1] < min_f_dist * 2.2]
            inv_weights = [1.0 / (b[1] + 0.003)**2 for b in top_bones]
            sum_w = sum(inv_weights)
            
            # Remove from hand group or leave small blend if near base of finger
            base_t = top_bones[0][2]
            is_base = '1' in top_bones[0][0] and base_t < 0.2
            palm_w = 0.25 if is_base else 0.0
            finger_w_total = 1.0 - palm_w
            
            vg_hand.add([v_idx], palm_w, 'REPLACE')
            for b_info, iw in zip(top_bones, inv_weights):
                w = (iw / sum_w) * finger_w_total
                side_finger_groups[b_info[0]].add([v_idx], w, 'REPLACE')
        else:
            # Stays in palm / Hand
            vg_hand.add([v_idx], 1.0, 'REPLACE')

    print(f"Side {side}: vertices weighted to fingers = {reweighted_to_fingers}, remaining in palm = {len(hand_vert_indices) - reweighted_to_fingers}")

# Test curling left hand fingers into fist
bpy.ops.object.mode_set(mode='POSE')
for f in ['Index', 'Middle', 'Ring', 'Pinky']:
    for seg, deg in [(1, 80), (2, 95), (3, 70)]:
        pb = arm.pose.bones[f'{f}{seg}.L']
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = Euler((math.radians(deg), 0, 0), 'XYZ')

# Thumb
for seg, deg in [(1, 45), (2, 70), (3, 50)]:
    pb = arm.pose.bones[f'Thumb{seg}.L']
    pb.rotation_mode = 'XYZ'
    pb.rotation_euler = Euler((math.radians(deg), math.radians(-15), 0), 'XYZ')

bpy.context.view_layer.update()

# Check fingertips displacement
tip_idx = arm.pose.bones['Index3.L'].tail
tip_pos = arm.matrix_world @ tip_idx
print(f"Index fingertip in fist: ({tip_pos.x:.3f}, {tip_pos.y:.3f}, {tip_pos.z:.3f})")

# Reset fingers
for bname in finger_bone_names:
    pb = arm.pose.bones[bname]
    pb.rotation_euler = Euler((0,0,0), 'XYZ')
bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')
