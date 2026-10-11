import numpy as np
from skel import *
DIRS=np.array([[0.9,0.12,0.4],[-0.35,0.1,0.93],[-0.7,-0.1,-0.7]]);DIRS/=np.linalg.norm(DIRS,axis=1,keepdims=True)
def ray_count(pts,V,F,d,chunk=400):
    a=V[F[:,0]];e1=V[F[:,1]]-a;e2=V[F[:,2]]-a
    h=np.cross(d,e2);det=(e1*h).sum(1);ok=np.abs(det)>1e-12;inv=np.where(ok,1/np.where(ok,det,1),0)
    out=np.zeros(len(pts),int)
    for s in range(0,len(pts),chunk):
        p=pts[s:s+chunk];sv=p[:,None,:]-a[None];u=(sv*h[None]).sum(2)*inv[None]
        q=np.cross(sv,e1[None]);v=(q*d).sum(2)*inv[None];t=(q*e2[None]).sum(2)*inv[None]
        hit=ok[None]&(u>=0)&(v>=0)&(u+v<=1)&(t>1e-5);out[s:s+chunk]=hit.sum(1)
    return out
class Clip3:
    """body vertex counted 'inside cloth' if >=2 of 3 rays cross the cloth an odd number of times"""
    def __init__(s,sk,region_exclude=('Head','Neck','Foot.L','Foot.R','Toe.L','Toe.R')):
        s.sk=sk;s.body=Mesh(sk,0);s.cl=[Mesh(sk,2),Mesh(sk,3)]
        names={v:k for k,v in sk.idx.items()};W0=sk.fk(sk.rest_q,sk.rest_t)[0]
        dom=s.body.J[np.arange(len(s.body.P)),s.body.W.argmax(1)];s.dom=np.array([names[j] for j in dom])
        pb=s.body.skin(W0);ins=s.inside(pb,W0)
        s.cov=ins&~np.isin(s.dom,region_exclude)
    def cloth_tris(s,Wm):
        Vs=[];Fs=[];off=0
        for m in s.cl:
            V=m.skin(Wm);Vs.append(V);Fs.append(m.F+off);off+=len(V)
        return np.vstack(Vs),np.vstack(Fs)
    def inside(s,pb,Wm,idx=None):
        V,F=s.cloth_tris(Wm);P=pb if idx is None else pb[idx]
        votes=np.zeros(len(P),int)
        for d in DIRS:votes+=(ray_count(P,V,F,d)%2==1)
        return votes>=2
    def check(s,q,t):
        Wm=s.sk.fk(q,t)[0];pb=s.body.skin(Wm);idx=np.where(s.cov)[0]
        ins=s.inside(pb,Wm,idx);exp=np.zeros(len(pb),bool);exp[idx[~ins]]=True;return exp

from scipy.spatial import cKDTree
def ray_count_fast(pts,V,F,d,R=0.14):
    d=d/np.linalg.norm(d);u1=np.cross(d,[0.3,0.9,0.1]);u1/=np.linalg.norm(u1);u2=np.cross(d,u1)
    P2=np.c_[pts@u1,pts@u2];cen=V[F].mean(1);C2=np.c_[cen@u1,cen@u2];T=cKDTree(C2)
    a=V[F[:,0]];e1=V[F[:,1]]-a;e2=V[F[:,2]]-a;h=np.cross(d,e2);det=(e1*h).sum(1);ok=np.abs(det)>1e-12;inv=np.where(ok,1/np.where(ok,det,1),0)
    out=np.zeros(len(pts),int);lists=T.query_ball_point(P2,R)
    for i,l in enumerate(lists):
        if not l:continue
        l=np.asarray(l);sv=pts[i]-a[l];u=(sv*h[l]).sum(1)*inv[l];q=np.cross(sv,e1[l]);v=(q@d)*inv[l];t=(q*e2[l]).sum(1)*inv[l]
        out[i]=(ok[l]&(u>=0)&(v>=0)&(u+v<=1)&(t>1e-5)).sum()
    return out
def _inside_fast(s,pb,Wm,idx=None):
    V,F=s.cloth_tris(Wm);P=pb if idx is None else pb[idx];votes=np.zeros(len(P),int)
    for d in DIRS:votes+=(ray_count_fast(P,V,F,d)%2==1)
    return votes>=2
Clip3.inside=_inside_fast

def boundary_verts(F,n):
    import collections
    cnt=collections.Counter()
    for a,b,c in F:
        for u,v in ((a,b),(b,c),(c,a)):cnt[(min(u,v),max(u,v))]+=1
    bv=set()
    for (u,v),k in cnt.items():
        if k==1:bv.add(u);bv.add(v)
    return np.array(sorted(bv))
class Clip4(Clip3):
    """Clip3 but ignores body vertices within `margin` of any open cloth boundary (cuffs, hems, collar)"""
    def __init__(s,sk,margin=0.045):
        super().__init__(sk)
        W0=sk.fk(sk.rest_q,sk.rest_t)[0];bpts=[]
        for m in s.cl:
            bv=boundary_verts(m.F,len(m.P));bpts.append(m.skin(W0)[bv])
        T=cKDTree(np.vstack(bpts));pb=s.body.skin(W0);d,_=T.query(pb);s.near_edge=d<margin
        s.cov=s.cov&~s.near_edge

from clip import closest_pt_tri
def _dist_to_cloth(s,pts,Wm,K=8):
    V,F=s.cloth_tris(Wm);Tc=cKDTree(V[F].mean(1));_,ti=Tc.query(pts,k=K)
    a=V[F[ti,0]];b=V[F[ti,1]];c=V[F[ti,2]];p=np.repeat(pts[:,None,:],K,1);sh=a.shape
    qq=closest_pt_tri(p.reshape(-1,3),a.reshape(-1,3),b.reshape(-1,3),c.reshape(-1,3)).reshape(sh)
    return np.linalg.norm(p-qq,axis=2).min(1)
def check_sev(s,q,t,tol=0.006):
    """returns (mask of body verts clearly outside cloth by > tol, distance array for them)"""
    Wm=s.sk.fk(q,t)[0];pb=s.body.skin(Wm);idx=np.where(s.cov)[0];ins=s.inside(pb,Wm,idx);ex=idx[~ins]
    out=np.zeros(len(pb),bool);dist=np.zeros(len(pb))
    if len(ex):
        d=_dist_to_cloth(s,pb[ex],Wm);dist[ex]=d;out[ex[d>tol]]=True
    return out,dist
Clip3.check_sev=check_sev;Clip3._dist=_dist_to_cloth
