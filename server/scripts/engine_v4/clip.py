import numpy as np
from scipy.spatial import cKDTree
from skel import *
def closest_pt_tri(p,a,b,c):
    ab=b-a;ac=c-a;ap=p-a
    d1=(ab*ap).sum(-1);d2=(ac*ap).sum(-1);bp=p-b;d3=(ab*bp).sum(-1);d4=(ac*bp).sum(-1);cp=p-c;d5=(ab*cp).sum(-1);d6=(ac*cp).sum(-1)
    vc=d1*d4-d3*d2;vb=d5*d2-d1*d6;va=d3*d6-d5*d4
    den=va+vb+vc;den=np.where(np.abs(den)<1e-20,1e-20,den)
    v=vb/den;w=vc/den
    q=a+ab*v[...,None]+ac*w[...,None]
    # clamp barycentrics (approximate edge handling via projection onto clamped barycentrics)
    u=1-v-w;neg=(u<0)|(v<0)|(w<0)
    if neg.any():
        for idx in np.where(neg)[0]:
            best=None
            for (x,y) in ((a[idx],b[idx]),(b[idx],c[idx]),(a[idx],c[idx])):
                e=y-x;t=np.clip(np.dot(p[idx]-x,e)/max(np.dot(e,e),1e-20),0,1);pt=x+e*t
                dd=np.linalg.norm(p[idx]-pt)
                if best is None or dd<best[0]:best=(dd,pt)
            q[idx]=best[1]
    return q
class Clip:
    def __init__(s,sk):
        s.sk=sk;s.body=Mesh(sk,0);s.cl=[Mesh(sk,2),Mesh(sk,3)]
        W0=sk.fk(sk.rest_q,sk.rest_t)[0];pb=s.body.skin(W0)
        s.rest_sd=s.sdist(pb,W0)
        s.cov=s.rest_sd<-0.004
        names={v:k for k,v in sk.idx.items()}
        dom=s.body.J[np.arange(len(pb)),s.body.W.argmax(1)];s.dom=np.array([names[j] for j in dom])
    @staticmethod
    def vnormals(P,F):
        n=np.zeros_like(P);t=np.cross(P[F[:,1]]-P[F[:,0]],P[F[:,2]]-P[F[:,0]])
        for k in range(3):np.add.at(n,F[:,k],t)
        return n/np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-12),t/np.maximum(np.linalg.norm(t,axis=1,keepdims=True),1e-12)
    def sd_one(s,pts,m,Wm,K=10):
        Pc=m.skin(Wm);F=m.F;vn,fn=s.vnormals(Pc,F);cen=Pc[F].mean(1);T=cKDTree(cen);_,ti=T.query(pts,k=K)
        a=Pc[F[ti,0]];b=Pc[F[ti,1]];c=Pc[F[ti,2]];p=np.repeat(pts[:,None,:],K,1)
        sh=a.shape;q=closest_pt_tri(p.reshape(-1,3),a.reshape(-1,3),b.reshape(-1,3),c.reshape(-1,3)).reshape(sh)
        d=np.linalg.norm(p-q,axis=2);j=d.argmin(1);r=np.arange(len(pts))
        qq=q[r,j];tt=ti[r,j];dd=d[r,j]
        # sign from interpolated vertex normal at closest point (barycentric via nearest vertex weights)
        A=Pc[F[tt,0]];B=Pc[F[tt,1]];Cc=Pc[F[tt,2]]
        wa=1/(np.linalg.norm(qq-A,axis=1)+1e-6);wb=1/(np.linalg.norm(qq-B,axis=1)+1e-6);wc=1/(np.linalg.norm(qq-Cc,axis=1)+1e-6)
        nn=(vn[F[tt,0]]*wa[:,None]+vn[F[tt,1]]*wb[:,None]+vn[F[tt,2]]*wc[:,None]);nn/=np.maximum(np.linalg.norm(nn,axis=1,keepdims=True),1e-12)
        sg=np.sign(np.einsum('ij,ij->i',pts-qq,nn));sg[sg==0]=1
        return sg*dd
    def sdist(s,pts,Wm):
        out=np.full(len(pts),9.0)
        for m in s.cl:
            sd=s.sd_one(pts,m,Wm);near=np.abs(sd)<np.abs(out);out=np.where(near,sd,out)
        return out
    def check(s,q,t):
        Wm=s.sk.fk(q,t)[0];pb=s.body.skin(Wm);sd=s.sdist(pb,Wm)
        return s.cov&(sd>0.002),sd

class Clip2(Clip):
    """fixed-correspondence clipping: each covered body vertex is tied to a cloth triangle + barycentric at rest;
    exposure = signed offset along the posed triangle normal becomes >= -margin."""
    def __init__(s,sk,maxd=0.09):
        s.sk=sk;s.body=Mesh(sk,0);s.cl=[Mesh(sk,2),Mesh(sk,3)]
        W0=sk.fk(sk.rest_q,sk.rest_t)[0];pb=s.body.skin(W0)
        names={v:k for k,v in sk.idx.items()}
        dom=s.body.J[np.arange(len(pb)),s.body.W.argmax(1)];s.dom=np.array([names[j] for j in dom])
        best=np.full(len(pb),9.0);bm=np.zeros(len(pb),int);bt=np.zeros(len(pb),int);bb=np.zeros((len(pb),3));bd0=np.zeros(len(pb))
        for mi,m in enumerate(s.cl):
            Pc=m.skin(W0);F=m.F;vn,fn=s.vnormals(Pc,F);cen=Pc[F].mean(1);T=cKDTree(cen);K=10;_,ti=T.query(pb,k=K)
            a=Pc[F[ti,0]];b=Pc[F[ti,1]];c=Pc[F[ti,2]];p=np.repeat(pb[:,None,:],K,1);sh=a.shape
            q=closest_pt_tri(p.reshape(-1,3),a.reshape(-1,3),b.reshape(-1,3),c.reshape(-1,3)).reshape(sh)
            d=np.linalg.norm(p-q,axis=2);j=d.argmin(1);r=np.arange(len(pb));qq=q[r,j];tt=ti[r,j];dd=d[r,j]
            A=Pc[F[tt,0]];B=Pc[F[tt,1]];Cc=Pc[F[tt,2]]
            # barycentric of qq
            v0=B-A;v1=Cc-A;v2=qq-A;d00=(v0*v0).sum(1);d01=(v0*v1).sum(1);d11=(v1*v1).sum(1);d20=(v2*v0).sum(1);d21=(v2*v1).sum(1)
            den=d00*d11-d01*d01+1e-20;v=(d11*d20-d01*d21)/den;w=(d00*d21-d01*d20)/den;u=1-v-w
            sd0=np.einsum('ij,ij->i',pb-qq,fn[tt])
            ok=dd<best
            best=np.where(ok,dd,best);bm=np.where(ok,mi,bm);bt=np.where(ok,tt,bt);bb=np.where(ok[:,None],np.stack([u,v,w],1),bb);bd0=np.where(ok,sd0,bd0)
        s.m,s.t,s.bary,s.d0=bm,bt,bb,bd0
        s.cov=(bd0<-0.004)&(best<maxd)&(~np.isin(s.dom,['Head','Neck']))
        s.rest_sd=bd0
    def check(s,q,t):
        Wm=s.sk.fk(q,t)[0];pb=s.body.skin(Wm);d=np.full(len(pb),-9.0)
        for mi,m in enumerate(s.cl):
            sel=np.where(s.cov&(s.m==mi))[0]
            if not len(sel):continue
            Pc=m.skin(Wm);F=m.F;_,fn=s.vnormals(Pc,F);tr=F[s.t[sel]]
            qq=(Pc[tr[:,0]]*s.bary[sel,0:1]+Pc[tr[:,1]]*s.bary[sel,1:2]+Pc[tr[:,2]]*s.bary[sel,2:3])
            d[sel]=np.einsum('ij,ij->i',pb[sel]-qq,fn[s.t[sel]])
        return s.cov&(d>-0.002),d
