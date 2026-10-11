import bpy

print("Actions in current blend file:")
for a in bpy.data.actions:
    print(f"  {a.name}, users={a.users}")

arm = bpy.data.objects.get('Karateka_Armature')
if arm and arm.animation_data:
    print(f"Active action: {arm.animation_data.action}")
    if arm.animation_data.nla_tracks:
        print(f"NLA tracks: {len(arm.animation_data.nla_tracks)}")
        for t in arm.animation_data.nla_tracks:
            print(f"  Track {t.name}: strips={[s.name for s in t.strips]}")
