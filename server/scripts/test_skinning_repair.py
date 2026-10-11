import bpy
from mathutils import Vector
import math

mesh = bpy.data.objects.get('Karateka_Mesh')
jacket = bpy.data.objects.get('Karateka_Gi_Jacket')
arm = bpy.data.objects.get('Karateka_Armature')

print("--- TESTING SKINNING REPAIR ---")

# 1. Defect vertices 1792 and 2224
v1792 = mesh.data.vertices[1792]
v2224 = mesh.data.vertices[2224]

vg_hips = mesh.vertex_groups.get('Hips')
vg_ul_l = mesh.vertex_groups.get('UpperLeg.L')
vg_ul_r = mesh.vertex_groups.get('UpperLeg.R')

vg_hips.add([1792], 0.5, 'REPLACE')
vg_ul_l.add([1792], 0.5, 'REPLACE')

vg_hips.add([2224], 0.5, 'REPLACE')
vg_ul_r.add([2224], 0.5, 'REPLACE')

print(f"Vertex 1792 groups after fix: {[(mesh.vertex_groups[g.group].name, g.weight) for g in v1792.groups]}")
print(f"Vertex 2224 groups after fix: {[(mesh.vertex_groups[g.group].name, g.weight) for g in v2224.groups]}")

# Check any remaining unweighted vertices in Karateka_Mesh
unweighted = [v.index for v in mesh.data.vertices if len(v.groups) == 0 or max([g.weight for g in v.groups], default=0) < 0.001]
print(f"Total unweighted vertices in Karateka_Mesh now: {len(unweighted)}")

# 2. Spine1 smoothing
for target_obj in [mesh, jacket]:
    vg_s1 = target_obj.vertex_groups.get('Spine1')
    if not vg_s1:
        vg_s1 = target_obj.vertex_groups.new(name='Spine1')
    vg_s = target_obj.vertex_groups.get('Spine')
    vg_c = target_obj.vertex_groups.get('Chest')

    # For vertices in torso region
    count_s1 = 0
    for v in target_obj.data.vertices:
        z = v.co.z
        if 1.15 <= z <= 1.35 and abs(v.co.x) < 0.35 and abs(v.co.y) < 0.25:
            # Check if this vertex has spine or chest influence
            w_s = 0.0
            w_c = 0.0
            for g in v.groups:
                if vg_s and g.group == vg_s.index: w_s = g.weight
                if vg_c and g.group == vg_c.index: w_c = g.weight
            
            total_sc = w_s + w_c
            if total_sc > 0.05:
                # Bell curve weight for Spine1 centered at z=1.25
                t = (z - 1.15) / (1.35 - 1.15) # 0 to 1
                # spine1 weight peaks at t=0.5
                w_s1_factor = math.sin(t * math.pi) * 0.55 # up to 0.55 of total torso weight
                rem = 1.0 - w_s1_factor
                
                # new spine weight vs chest weight
                # at t=0, spine is 1.0; at t=1, chest is 1.0
                new_w_s = total_sc * (rem * (1.0 - t))
                new_w_c = total_sc * (rem * t)
                new_w_s1 = total_sc * w_s1_factor
                
                vg_s.add([v.index], new_w_s, 'REPLACE')
                vg_c.add([v.index], new_w_c, 'REPLACE')
                vg_s1.add([v.index], new_w_s1, 'REPLACE')
                count_s1 += 1
    print(f"Object {target_obj.name}: vertices assigned to Spine1 = {count_s1}")
