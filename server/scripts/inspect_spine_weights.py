import bpy

mesh = bpy.data.objects.get('Karateka_Mesh')
jacket = bpy.data.objects.get('Karateka_Gi_Jacket')

print("--- EXAMINING SPINE VERTICES ---")
for obj in [mesh, jacket]:
    print(f"\nObject: {obj.name}")
    v_spine_range = [v for v in obj.data.vertices if 1.10 <= v.co.z <= 1.40]
    print(f"  Vertices with Z in [1.10, 1.40]: count = {len(v_spine_range)}")
    
    vg_spine = obj.vertex_groups.get('Spine')
    vg_chest = obj.vertex_groups.get('Chest')
    
    spine_only = 0
    chest_only = 0
    both = 0
    for v in v_spine_range:
        w_s = 0.0
        w_c = 0.0
        for g in v.groups:
            if vg_spine and g.group == vg_spine.index: w_s = g.weight
            if vg_chest and g.group == vg_chest.index: w_c = g.weight
        if w_s > 0.01 and w_c > 0.01:
            both += 1
        elif w_s > 0.01:
            spine_only += 1
        elif w_c > 0.01:
            chest_only += 1
    print(f"  In range [1.10, 1.40]: spine_only={spine_only}, chest_only={chest_only}, both={both}")
