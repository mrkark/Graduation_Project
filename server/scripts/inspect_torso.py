import bpy
import math

arm = bpy.data.objects.get('Karateka_Armature')

print("="*60)
print("INSPECTING TORSO & LEFT ARM CONSTRAINTS")
print("="*60)

for bname in ['Hips', 'Spine', 'Spine1', 'Chest', 'Neck', 'Head', 'Shoulder.L', 'UpperArm.L', 'LowerArm.L', 'Hand.L']:
    pb = arm.pose.bones.get(bname)
    if pb:
        print(f"\nBone: {pb.name}")
        if not pb.constraints:
            print("  NO CONSTRAINTS")
        for c in pb.constraints:
            print(f"  Constraint: {c.name} ({c.type}), owner_space={c.owner_space}")
            if c.type == 'LIMIT_ROTATION':
                if c.use_limit_x: print(f"    X: [{math.degrees(c.min_x):.1f}°, {math.degrees(c.max_x):.1f}°]")
                if c.use_limit_y: print(f"    Y: [{math.degrees(c.min_y):.1f}°, {math.degrees(c.max_y):.1f}°]")
                if c.use_limit_z: print(f"    Z: [{math.degrees(c.min_z):.1f}°, {math.degrees(c.max_z):.1f}°]")
