import bpy
import math

arm = bpy.data.objects.get('Karateka_Armature')
bpy.ops.object.mode_set(mode='EDIT')

print("--- FINGER BONES ROLL AND AXES ---")
for side in ['L', 'R']:
    print(f"\nFINGERS SIDE: {side}")
    for f in ['Thumb1', 'Thumb2', 'Thumb3', 'Index1', 'Index2', 'Index3', 'Middle1', 'Middle2', 'Middle3', 'Ring1', 'Ring2', 'Ring3', 'Pinky1', 'Pinky2', 'Pinky3']:
        bname = f"{f}.{side}"
        eb = arm.data.edit_bones.get(bname)
        if eb:
            print(f"  {bname:12}: roll={math.degrees(eb.roll):.1f}°, x_axis=({eb.x_axis.x:.2f}, {eb.x_axis.y:.2f}, {eb.x_axis.z:.2f}), y_axis=({eb.y_axis.x:.2f}, {eb.y_axis.y:.2f}, {eb.y_axis.z:.2f})")

bpy.ops.object.mode_set(mode='OBJECT')
