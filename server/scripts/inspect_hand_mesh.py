import bpy
from mathutils import Vector

mesh = bpy.data.objects.get('Karateka_Mesh')
arm = bpy.data.objects.get('Karateka_Armature')

print("--- EXAMINING HAND MESH GEOMETRY ---")

# Let's inspect vertices where x > 0.70 (left hand area)
hand_verts = [v for v in mesh.data.vertices if v.co.x > 0.70]
print(f"Number of vertices in left hand area: {len(hand_verts)}")

# Min, max bounds of hand vertices
min_co = Vector((min(v.co.x for v in hand_verts), min(v.co.y for v in hand_verts), min(v.co.z for v in hand_verts)))
max_co = Vector((max(v.co.x for v in hand_verts), max(v.co.y for v in hand_verts), max(v.co.z for v in hand_verts)))
print(f"Hand bounds: min={min_co}, max={max_co}")

# Finger bone positions
bpy.ops.object.mode_set(mode='EDIT')
finger_bones = [b for b in arm.data.edit_bones if b.name.startswith(('Thumb', 'Index', 'Middle', 'Ring', 'Pinky')) and b.name.endswith('.L')]
print("\nLeft hand finger bones:")
for b in finger_bones:
    print(f"  {b.name:12}: head=({b.head.x:.3f}, {b.head.y:.3f}, {b.head.z:.3f}), tail=({b.tail.x:.3f}, {b.tail.y:.3f}, {b.tail.z:.3f})")
bpy.ops.object.mode_set(mode='OBJECT')

# Check how close vertices are to each finger bone
print("\nVertex-to-bone proximity check:")
vg_hand_L = mesh.vertex_groups.get('Hand.L')
print(f"Hand.L group index: {vg_hand_L.index if vg_hand_L else None}")

# Check other meshes (Gi_Jacket, Gi_Pants, Obi)
for o in [bpy.data.objects.get('Karateka_Gi_Jacket'), bpy.data.objects.get('Karateka_Gi_Pants'), bpy.data.objects.get('Karateka_Belt_Obi')]:
    if o:
        v_in_fingers = 0
        for vg in o.vertex_groups:
            if any(f in vg.name for f in ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']):
                v_in_fingers += sum(1 for v in o.data.vertices for g in v.groups if g.group == vg.index and g.weight > 0.01)
        print(f"Mesh {o.name}: vertices in finger vertex groups = {v_in_fingers}")
