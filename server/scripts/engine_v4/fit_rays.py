import numpy as np,time,sys
from cmeas import *
from clip3 import *
from clip import Clip,closest_pt_tri
from cloth import *
import opt_cloth
z=np.load('cloth_weights.npz')
C=Clip3(sk)
C.cl[0].J,C.cl[0].W=smooth_weights(z['J2'],z['W2'],C.cl[0].F,iters=2);C.cl[1].J,C.cl[1].W=smooth_weights(z['J3'],z['W3'],C.cl[1].F,iters=2)
N=int(sys.argv[1]) if len(sys.argv)>1 else 60;ITERS=int(sys.argv[2]) if len(sys.argv)>2 else 6
qs,ts=opt_cloth.training_poses(N)
P0=[m.P.copy() for m in C.cl];vn0=[Clip.vnormals(p,m.F)[0] for p,m in zip(P0,C.cl)]
# orient normals outward from the body
Tb=cKDTree(C.body.P)
for k in range(2):
    _,i=Tb.query(P0[k]);s=np.sign(((P0[k]-C.body.P[i])*vn0[k]).sum(1));s[s==0]=1;vn0[k]=vn0[k]*s[:,None]
off=[np.zeros(len(p)) for p in P0];adj=[adjacency(m.F,len(p)) for p,m in zip(P0,C.cl)]
Dn=[sp.diags(1/np.maximum(np.asarray(a.sum(1)).ravel(),1))@a for a in adj]
V_off=np.cumsum([0,len(P0[0])])
for it in range(ITERS):
    for k,m in enumerate(C.cl):m.P=P0[k]+vn0[k]*off[k][:,None]
    need=[np.zeros(len(p)) for p in P0];tot=0;t0=time.time()
    for q,t in zip(qs,ts):
        Wm=sk.fk(q,t)[0];pb=C.body.skin(Wm);idx=np.where(C.cov)[0];ins=C.inside(pb,Wm,idx);ex=idx[~ins];tot+=len(ex)
        if not len(ex):continue
        V,F=C.cloth_tris(Wm);Tc=cKDTree(V[F].mean(1));K=8;_,ti=Tc.query(pb[ex],k=K)
        a=V[F[ti,0]];b=V[F[ti,1]];c=V[F[ti,2]];p=np.repeat(pb[ex][:,None,:],K,1);sh=a.shape
        qq=closest_pt_tri(p.reshape(-1,3),a.reshape(-1,3),b.reshape(-1,3),c.reshape(-1,3)).reshape(sh)
        d=np.linalg.norm(p-qq,axis=2);j=d.argmin(1);rr=np.arange(len(ex));tt=ti[rr,j];dd=d[rr,j];qb=qq[rr,j]
        A=V[F[tt,0]];B=V[F[tt,1]];Cc=V[F[tt,2]];v0=B-A;v1=Cc-A;v2=qb-A
        d00=(v0*v0).sum(1);d01=(v0*v1).sum(1);d11=(v1*v1).sum(1);d20=(v2*v0).sum(1);d21=(v2*v1).sum(1);den=d00*d11-d01**2+1e-20
        bv=(d11*d20-d01*d21)/den;bw=(d00*d21-d01*d20)/den;bu=1-bv-bw
        for n_,(tv,bb) in enumerate(zip(F[tt],np.stack([bu,bv,bw],1))):
            amt=dd[n_]+0.004
            for vtx,wb in zip(tv,bb):
                if wb>0.15:
                    mi=0 if vtx<len(P0[0]) else 1;lv=vtx if mi==0 else vtx-len(P0[0])
                    need[mi][lv]=max(need[mi][lv],amt)
    print(f'iter {it}: exposed sum {tot} ({tot/len(qs):.1f}/pose) max off {[round(float(o.max()),3) for o in off]} {time.time()-t0:.0f}s',flush=True)
    for k in range(2):
        off[k]=np.minimum(0.04,off[k]+0.8*need[k])
        for _ in range(2):off[k]=np.maximum(off[k],0.75*(Dn[k]@off[k]))
    np.savez('cloth_rays.npz',off2=off[0],off3=off[1],vn2=vn0[0],vn3=vn0[1],J2=C.cl[0].J,W2=C.cl[0].W,J3=C.cl[1].J,W3=C.cl[1].W)
print('done')
