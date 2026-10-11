import bpy
from mathutils import Vector

mesh = bpy.data.objects.get('Karateka_Mesh')
vg_names = {vg.index: vg.name for vg in mesh.vertex_groups}

for v_idx, side in [(1792, 'L'), (2224, 'R')]:
    v = mesh.data.vertices[v_idx]
    print(f"\nTarget Vertex {v_idx} pos={v.co}")
    # find 5 nearest vertices
    neighbors = sorted(
        [other for other in mesh.data.vertices if other.index != v_idx],
        key=lambda other: (other.co - v.co).length
    )[:5]
    for n in neighbors:
        d = (n.co - v.co).length
        grps = [(vg_names.get(g.group), round(g.weight, 4)) for g in n.groups]
        print(f"  neighbor {n.index} dist={d:.4f} pos={n.co} groups={grps}")
