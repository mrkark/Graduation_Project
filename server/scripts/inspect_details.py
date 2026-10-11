import bpy
import math

arm = bpy.data.objects.get('Karateka_Armature')

print("="*60)
print("INSPECTING BONE CONSTRAINTS")
print("="*60)

for pb in arm.pose.bones:
    if pb.constraints:
        print(f"\nBone: {pb.name}")
        for c in pb.constraints:
            print(f"  Constraint: {c.name} ({c.type})")
            print(f"    mute={c.mute}, influence={c.influence}")
            if c.type == 'LIMIT_ROTATION':
                print(f"    space={c.owner_space}")
                if c.use_limit_x: print(f"    X: [{math.degrees(c.min_x):.1f}°, {math.degrees(c.max_x):.1f}°]")
                if c.use_limit_y: print(f"    Y: [{math.degrees(c.min_y):.1f}°, {math.degrees(c.max_y):.1f}°]")
                if c.use_limit_z: print(f"    Z: [{math.degrees(c.min_z):.1f}°, {math.degrees(c.max_z):.1f}°]")
            elif c.type == 'IK':
                print(f"    target={c.target}, subtarget={c.subtarget}, chain_count={c.chain_count}")
                print(f"    pole_target={c.pole_target}, pole_subtarget={c.pole_subtarget}, pole_angle={math.degrees(c.pole_angle):.1f}°")

print("\n" + "="*60)
print("INSPECTING KARATEKA_MESH HAND & FINGER GEOMETRY")
print("="*60)
km = bpy.data.objects.get('Karateka_Mesh')
if km:
    hand_verts_L = [v for v in km.data.vertices if v.co.x > 0.70]
    print(f"Left hand vertices (x > 0.70): count = {len(hand_verts_L)}")
    vg_hand_L = km.vertex_groups.get('Hand.L')
    if vg_hand_L:
        weighted = [v for v in km.data.vertices for g in v.groups if g.group == vg_hand_L.index and g.weight > 0.01]
        print(f"Vertices in Hand.L vertex group: count = {len(weighted)}")
    
    # Are there other vertex groups on km that match fingers?
    all_km_vgs = [vg.name for vg in km.vertex_groups]
    print(f"All vertex groups on Karateka_Mesh ({len(all_km_vgs)}): {all_km_vgs}")

print("\n" + "="*60)
print("SPINE BONE POSITIONS")
print("="*60)
bpy.ops.object.mode_set(mode='EDIT')
for bname in ['Hips', 'Spine', 'Spine1', 'Chest', 'Neck', 'Head']:
    eb = arm.data.edit_bones.get(bname)
    if eb:
        print(f"{bname:10}: head=({eb.head.x:.3f}, {eb.head.y:.3f}, {eb.head.z:.3f}), tail=({eb.tail.x:.3f}, {eb.tail.y:.3f}, {eb.tail.z:.3f}), roll={math.degrees(eb.roll):.1f}°")
bpy.ops.object.mode_set(mode='OBJECT')
