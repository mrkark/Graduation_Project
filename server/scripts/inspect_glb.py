import bpy
import os

glb_path = r"D:\Studing\4k1s\Course_Project_CTCP\bunkai-explorer\client\public\models\karateka_lowpoly.glb"

# Clean scene
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb_path)

print("--- INSPECTING KARATEKA_LOWPOLY.GLB ---")
print(f"Imported actions count: {len(bpy.data.actions)}")
for act in bpy.data.actions:
    print(f"  Action in GLB: '{act.name}', range={act.frame_range}")
