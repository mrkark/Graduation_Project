import numpy as np
from cmeas import *
from cloth import *
tp=np.load('train_poses.npz')
def run(C,iters=10,margin=0.004,cap=0.03):
    Wd=[]
    qs=[];ts=[]
    import opt_cloth
    # rebuild q,t training poses from saved M? simpler: re-sample poses
    qs,ts=opt_cloth.training_poses(110)
    P0=[m.P.copy() for m in C.cl];vn0=[C.vnormals(p,m.F)[0] for p,m in zip(P0,C.cl)]
    off=[np.zeros(len(p)) for p in P0];adj=[adjacency(m.F,len(p)) for p,m in zip(P0,C.cl)]
    for it in range(iters):
        need=[np.zeros(len(p)) for p in P0]
        for m,p in zip(C.cl,P0):pass
        for k,m in enumerate(C.cl):m.P=P0[k]+vn0[k]*off[k][:,None]
        tot=0
        for q,t in zip(qs,ts):
            e,d=C.check(q,t);ex=np.where(C.cov&(d>-margin))[0]
            tot+=len(ex)
            for i in ex:
                mi=C.m[i];tri=C.cl[mi].F[C.t[i]];amt=d[i]+margin
                for vtx,b in zip(tri,C.bary[i]):
                    if b>0.15:need[mi][vtx]=max(need[mi][vtx],amt)
        print('iter',it,'exposed(sum over train poses)',tot,'max off',[round(float(o.max()),3) for o in off],flush=True)
        for k in range(len(off)):
            off[k]=np.minimum(cap,off[k]+np.minimum(need[k]*0.8,0.008))
            Dn=sp.diags(1/np.maximum(np.asarray(adj[k].sum(1)).ravel(),1))@adj[k]
            for _ in range(3):off[k]=0.5*off[k]+0.5*(Dn@off[k])
    for k,m in enumerate(C.cl):m.P=P0[k]+vn0[k]*off[k][:,None]
    return off,P0,vn0
if __name__=='__main__':
    C=Clip2(sk);z=np.load('cloth_weights.npz')
    C.cl[0].J,C.cl[0].W=smooth_weights(z['J2'],z['W2'],C.cl[0].F,iters=3);C.cl[1].J,C.cl[1].W=smooth_weights(z['J3'],z['W3'],C.cl[1].F,iters=3)
    off,P0,vn0=run(C)
    np.savez('cloth_final.npz',J2=C.cl[0].J,W2=C.cl[0].W,J3=C.cl[1].J,W3=C.cl[1].W,P2=C.cl[0].P,P3=C.cl[1].P,off2=off[0],off3=off[1])
    for thr in (0.0,0.003,0.01):
        cnt=[]
        for n in CLIPS:
            tl=ALL[n];w=0
            for kk in range(0,int(tl.T*10)+1,3):
                qq,tt,_=r.solve(tl.P(min(kk/10,tl.T)));e,d=C.check(qq,tt);e=C.cov&(d>thr)&~np.isin(C.dom,['Toe.L','Toe.R','Foot.L','Foot.R']);w=max(w,e.sum())
            cnt.append(int(w))
        print('final thr',thr,cnt,sum(cnt))
