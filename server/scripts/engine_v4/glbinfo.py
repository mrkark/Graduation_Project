import json,struct,sys
p='../showcase/karateka_lowpoly.glb'
d=open(p,'rb').read()
_,_,L=struct.unpack('<III',d[:12])
off=12
js=None;bin_=None
while off<L:
    cl,ct=struct.unpack('<II',d[off:off+8]);chunk=d[off+8:off+8+cl];off+=8+cl
    if ct==0x4E4F534A: js=json.loads(chunk)
    elif ct==0x004E4942: bin_=chunk
print({k:(len(v) if isinstance(v,list) else v) for k,v in js.items() if k!='asset'})
nodes=js['nodes']
print('skins',[(len(s['joints']),s.get('skeleton')) for s in js.get('skins',[])])
print('meshes',[(m.get('name'),[ (list(p['attributes'].keys())) for p in m['primitives']]) for m in js['meshes']])
print('anims',len(js['animations']))
names=[a['name'] for a in js['animations']]
print(names)
