import bpy
import math
import os

print("="*60)
print("AUDITING KARATEKA RIG AND BLEND FILE")
print("="*60)

arm = bpy.data.objects.get('Karateka_Armature')
if not arm:
    print("ERROR: Karateka_Armature not found!")
    exit(1)

bpy.ops.object.mode_set(mode='EDIT')
bone_rolls = {eb.name: eb.roll for eb in arm.data.edit_bones}
bone_heads = {eb.name: eb.head.copy() for eb in arm.data.edit_bones}
bone_tails = {eb.name: eb.tail.copy() for eb in arm.data.edit_bones}
bpy.ops.object.mode_set(mode='OBJECT')

print(f"\n--- ARMATURE: {arm.name} (Total bones: {len(arm.data.bones)}) ---")
print(f"Location: {arm.location}, Rotation: {arm.rotation_euler}, Scale: {arm.scale}")

print("\n--- BONES CONSTRAINTS & LIMITS ---")
for b in arm.data.bones:
    pb = arm.pose.bones.get(b.name)
    parent_name = b.parent.name if b.parent else "None"
    roll_deg = math.degrees(bone_rolls.get(b.name, 0.0))
    if pb and pb.constraints:
        c_desc = []
        for c in pb.constraints:
            if c.type == 'LIMIT_ROTATION':
                limits = []
                if c.use_limit_x: limits.append(f"X:[{math.degrees(c.min_x):.1f}°, {math.degrees(c.max_x):.1f}°]")
                if c.use_limit_y: limits.append(f"Y:[{math.degrees(c.min_y):.1f}°, {math.degrees(c.max_y):.1f}°]")
                if c.use_limit_z: limits.append(f"Z:[{math.degrees(c.min_z):.1f}°, {math.degrees(c.max_z):.1f}°]")
                space = c.owner_space
                c_desc.append(f"LIMIT_ROT({', '.join(limits)}, space={space})")
            elif c.type == 'IK':
                c_desc.append(f"IK(target={c.target.name if c.target else 'None'}, subtarget={c.subtarget}, chain_count={c.chain_count})")
            else:
                c_desc.append(f"{c.type}({c.name})")
        print(f"Bone: {b.name:15} Parent: {parent_name:12} Roll: {roll_deg:6.1f}° Constraints: {', '.join(c_desc)}")
    else:
        print(f"Bone: {b.name:15} Parent: {parent_name:12} Roll: {roll_deg:6.1f}° (No constraints)")

print("\n--- ARM & LEG ORIENTATIONS & AXES ---")
for side in ['L', 'R']:
    for bname in [f'UpperArm.{side}', f'LowerArm.{side}', f'Hand.{side}', f'UpperLeg.{side}', f'LowerLeg.{side}', f'Foot.{side}']:
        b = arm.data.bones.get(bname)
        pb = arm.pose.bones.get(bname)
        if b:
            h = bone_heads[bname]
            t = bone_tails[bname]
            vec = t - h
            roll = math.degrees(bone_rolls[bname])
            print(f"{bname:12}: head=({h.x:.3f}, {h.y:.3f}, {h.z:.3f}), tail=({t.x:.3f}, {t.y:.3f}, {t.z:.3f}), length={vec.length:.3f}, roll={roll:.1f}°")
            # print local axes in armature space
            mat = b.matrix_local
            print(f"   X-axis: ({mat[0][0]:.3f}, {mat[1][0]:.3f}, {mat[2][0]:.3f})")
            print(f"   Y-axis: ({mat[0][1]:.3f}, {mat[1][1]:.3f}, {mat[2][1]:.3f})")
            print(f"   Z-axis: ({mat[0][2]:.3f}, {mat[1][2]:.3f}, {mat[2][2]:.3f})")

print("\n--- MESHES & VERTEX WEIGHTS ---")
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        print(f"\nMesh: {obj.name}, Vertices: {len(obj.data.vertices)}")
        vg_dict = {vg.index: vg.name for vg in obj.vertex_groups}
        print(f"  Total vertex groups: {len(vg_dict)}")
        
        # Check specific vertices mentioned in prompt: 1792, 2224
        for v_idx in [1792, 2224]:
            if v_idx < len(obj.data.vertices):
                v = obj.data.vertices[v_idx]
                groups = [(vg_dict[g.group], round(g.weight, 4)) for g in v.groups if g.group in vg_dict]
                print(f"  Target Vertex {v_idx} pos=({v.co.x:.4f}, {v.co.y:.4f}, {v.co.z:.4f}) groups={groups}")
        
        # Check zero-weight vertices
        zero_weighted = [v.index for v in obj.data.vertices if len(v.groups) == 0 or max([g.weight for g in v.groups], default=0) < 0.0001]
        print(f"  Unweighted vertices: {len(zero_weighted)} (sample: {zero_weighted[:10]})")
        
        # Check Spine, Spine1, Chest
        for spine_name in ['Hips', 'Spine', 'Spine1', 'Chest', 'Neck', 'Head']:
            vg = obj.vertex_groups.get(spine_name)
            if vg:
                v_count = sum(1 for v in obj.data.vertices for g in v.groups if g.group == vg.index and g.weight > 0.01)
                print(f"  Bone '{spine_name}': {v_count} vertices weighted")
            else:
                print(f"  Bone '{spine_name}': GROUP MISSING in mesh {obj.name}")

        # Check Hand & Finger vertex groups
        hand_groups = [name for name in vg_dict.values() if 'Hand' in name or any(f in name for f in ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'])]
        print(f"  Hand/Finger vertex groups ({len(hand_groups)}): {hand_groups[:10]}...")

print("\n--- ACTIONS IN BLEND FILE ---")
for act in bpy.data.actions:
    print(f"Action: '{act.name}', range={act.frame_range}, curves={len(act.fcurves)}")

print("="*60)
