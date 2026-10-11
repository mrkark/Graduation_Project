from glb import *
js,bn=load('../showcase/karateka_lowpoly.glb')
nodes=js['nodes'];J=js['skins'][0]['joints'];names=[nodes[j]['name'] for j in J]
nb=names.index('neutral_bone');print('neutral idx',nb)
for mi,m in enumerate(js['meshes']):
    at=m['primitives'][0]['attributes']
    P=acc(js,bn,at['POSITION']);JJ=acc(js,bn,at['JOINTS_0']).astype(int);WW=acc(js,bn,at['WEIGHTS_0'])
    sel=np.where(((JJ==nb)&(WW>0)).any(1))[0];print(mi,'neutral verts',len(sel),sel[:10],P[sel[:5]].round(3))
    if mi==0:
        # influences histogram
        print(' influences per vertex',np.bincount((WW>1e-4).sum(1)))
        # torso profile
        ids={n:names.index(n) for n in ['Hips','Spine','Chest','Neck','Spine1']}
        def w(n): return (WW*(JJ==ids[n])).sum(1)
        for y0 in np.arange(0.8,1.6,0.05):
            s=(np.abs(P[:,0])<0.15)&(P[:,1]>=y0)&(P[:,1]<y0+0.05)
            if s.sum(): print(f' y{y0:.2f} n{s.sum():4d} H{w("Hips")[s].mean():.2f} S{w("Spine")[s].mean():.2f} C{w("Chest")[s].mean():.2f} N{w("Neck")[s].mean():.2f}')
# knee/hip region profile of legs? hand verts
P=acc(js,bn,js['meshes'][0]['primitives'][0]['attributes']['POSITION']);JJ=acc(js,bn,js['meshes'][0]['primitives'][0]['attributes']['JOINTS_0']).astype(int);WW=acc(js,bn,js['meshes'][0]['primitives'][0]['attributes']['WEIGHTS_0'])
h=names.index('Hand.L');sel=((JJ==h)&(WW>0.5)).any(1)
print('Hand.L verts',sel.sum(),P[sel].min(0).round(3),P[sel].max(0).round(3))
