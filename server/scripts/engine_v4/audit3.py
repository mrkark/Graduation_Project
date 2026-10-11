from glb import *
js,bn=load('../showcase/karateka_lowpoly.glb')
nodes=js['nodes'];J=js['skins'][0]['joints'];names=[nodes[j]['name'] for j in J]
for mi,m in enumerate(js['meshes']):
    p=m['primitives'][0];at=p['attributes']
    P=acc(js,bn,at['POSITION']);JJ=acc(js,bn,at['JOINTS_0']).astype(int);WW=acc(js,bn,at['WEIGHTS_0'])
    print('\nMESH',mi,m['name'],'verts',len(P),'bbox',P.min(0).round(3),P.max(0).round(3))
    tot=WW.sum(1);print(' weight sum min/max',tot.min(),tot.max(),'zero-weight verts',(tot<1e-6).sum(),np.where(tot<1e-6)[0][:20])
    use=np.zeros(len(J));
    for k in range(4): np.add.at(use,JJ[:,k],WW[:,k])
    cnt=np.zeros(len(J),int)
    for k in range(4):
        sel=WW[:,k]>1e-4; np.add.at(cnt,JJ[sel,k],1)
    print(' unused bones:',[names[i] for i in range(len(J)) if cnt[i]==0])
    print(' top:',[(names[i],int(cnt[i]),round(float(use[i]),1)) for i in np.argsort(-use)[:14]])
