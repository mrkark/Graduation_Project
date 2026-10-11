import numpy as np,time,sys
from scipy.spatial import cKDTree
from clip import *
from cloth import *
from build_all import ALL
from tl import get_rig
r=get_rig();sk=r.sk
rng=np.random.default_rng(1)
def training_poses(n=120):
    qs=[];ts=[]
    names=list(ALL)
    # take every keyframe time + mid times of every clip, then subsample
    cand=[]
    for nme in names:
        tl=ALL[nme]
        for kk in tl.keys:cand.append((nme,kk['t']))
        for f in (0.25,0.5,0.75):cand.append((nme,f*tl.T))
    idx=rng.permutation(len(cand))[:n]
    for i in idx:
        nme,t=cand[i];q,tr,_=r.solve(ALL[nme].P(min(t,ALL[nme].T)));qs.append(q);ts.append(tr)
    return qs,ts
def prep(qs,ts):
    Ms=[];Pb=[];body=Mesh(sk,0);z=np.load('fixed_weights.npz');body.J=z['J0'].astype(int);body.W=z['W0']
    for q,t in zip(qs,ts):
        Wm=sk.fk(q,t)[0];Ms.append(np.array(Wm)@sk.ibm);Pb.append(body.skin(Wm))
    return np.array(Ms,np.float32),np.array(Pb,np.float32),body
def dense(J,W,n,nj=64):
    D=np.zeros((n,nj),np.float32)
    for k in range(4):np.add.at(D,(np.arange(n),J[:,k].astype(int)),W[:,k])
    return D
def topk(D,k=4):
    top=np.argsort(-D,1)[:,:k];J=top.astype(np.uint16);W=np.take_along_axis(D,top,1).astype(np.float32);W/=W.sum(1,keepdims=True);return J,W
def cost_for(Dc,Pm,Nm,tied,tied_d0,M,Pb,lam_d):
    """Dc:(n,C,nj) candidate dense weights ; returns (n,C) cost. tied:(n,T) body vertex ids (-1 pad)"""
    n,Cn,nj=Dc.shape;P=M.shape[0]
    A=np.einsum('ncj,pjab->ncpab',Dc,M,optimize=True)           # (n,C,P,4,4)
    cp=np.einsum('ncpab,nb->ncpa',A[...,:3,:3],Pm)+A[...,:3,3]   # (n,C,P,3)
    nn=np.einsum('ncpab,nb->ncpa',A[...,:3,:3],Nm)
    nn/=np.maximum(np.linalg.norm(nn,axis=-1,keepdims=True),1e-6)
    valid=tied>=0;tid=np.where(valid,tied,0)
    pb=Pb[:,tid]                                                 # (P,n,T,3)
    pb=np.transpose(pb,(1,0,2,3))                                # (n,P,T,3)
    d=np.einsum('npta,ncpa->ncpt',pb-0,nn)-np.einsum('ncpa,ncpa->ncp',cp,nn)[...,None]*1.0   # (n,C,P,T) = (pb-cp).nn
    d0=tied_d0[:,None,None,:]
    viol=np.maximum(0,d+0.004)                                   # body must stay >=4mm inside
    over=np.maximum(0,(d0*1.9)-d)                                # cloth must not drift far from body (d more negative than 1.9*d0)
    c=(viol**2*valid[:,None,None,:]).sum((2,3))*400+(over**2*valid[:,None,None,:]).sum((2,3))*40
    return c
def optimize(mi,mesh,J0,W0,body,cov,M,Pb,rounds=3,chunk=120,T=8):
    n=len(mesh.P);Pm=mesh.P.astype(np.float32);vn,_=Clip.vnormals(mesh.P,mesh.F);vn=vn.astype(np.float32)
    # tie body vertices to nearest cloth vertex
    tree=cKDTree(mesh.P);ids=np.where(cov)[0];d,near=tree.query(body.P[ids])
    tied=-np.ones((n,T),int);cnt=np.zeros(n,int)
    # pick the closest T per cloth vertex
    order=np.argsort(d)
    for o in order:
        c=near[o]
        if cnt[c]<T and d[o]<0.09:tied[c,cnt[c]]=ids[o];cnt[c]+=1
    # rest offset along rest normal
    rel=np.zeros((n,T),np.float32)
    for c in range(n):
        for t in range(T):
            if tied[c,t]>=0:rel[c,t]=np.dot(body.P[tied[c,t]]-mesh.P[c],vn[c])
    D=dense(J0,W0,n);Dbase=D.copy()
    # neighbour joint pool : joints of tied body vertices + cloth neighbours
    A=adjacency(mesh.F,n);Db=dense(body.J,body.W,len(body.P))
    pool=np.zeros((n,64),bool)
    for c in range(n):
        if cnt[c]:
            pool[c]|=Db[tied[c,:cnt[c]]].max(0)>0.05
        nb=A[c].indices;pool[c]|=(D[nb]>0.1).any(0)
    base_cost=None
    for rd in range(rounds):
        t0=time.time();new=D.copy();gain=0
        for s in range(0,n,chunk):
            e=min(n,s+chunk);m=e-s
            cands=[D[s:e]]
            for a in (0.15,0.3,0.5):
                for jj in range(6):
                    Dc=(1-a)*D[s:e].copy()
                    # choose jj-th pool joint (by body-weight mass) per vertex
                    sel=np.argsort(-(pool[s:e]*1.0*(Db[tied[s:e].clip(0)].max(1) if True else 0)+pool[s:e]*0.01),1)[:,jj]
                    Dc[np.arange(m),sel]+=a;cands.append(Dc)
            Dc=np.stack(cands,1)                                  # (m,C,nj)
            cst=cost_for(Dc,Pm[s:e],vn[s:e],tied[s:e],rel[s:e],M,Pb,0)
            # regularisation toward transfer weights
            reg=((Dc-Dbase[s:e,None,:])**2).sum(2)*0.05
            tot=cst+reg;b=tot.argmin(1);gain+=(tot[:,0]-tot[np.arange(m),b]).sum()
            new[s:e]=Dc[np.arange(m),b]
        D=new;print(f'mesh {mi} round {rd} gain {gain:.3f} {time.time()-t0:.0f}s',flush=True)
    return topk(D)
if __name__=='__main__':
    qs,ts=training_poses(100);M,Pb,body=prep(qs,ts);np.savez('train_poses.npz',M=M,Pb=Pb)
    C=Clip2(sk);cov=C.cov
    z=np.load('cloth_weights.npz');out={}
    for mi,cm in ((2,C.cl[0]),(3,C.cl[1])):
        J0,W0=smooth_weights(z[f'J{mi}'],z[f'W{mi}'],cm.F,iters=2)
        out[mi]=optimize(mi,cm,J0,W0,body,cov,M,Pb)
    np.savez('cloth_opt.npz',**{f'J{k}':v[0] for k,v in out.items()},**{f'W{k}':v[1] for k,v in out.items()})
