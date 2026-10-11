"""Skin-weight repair for karateka_lowpoly.glb (done on GLB data, since Blender is unavailable here)."""
from skel import *
from scipy.spatial import cKDTree

def prune4(Jm,Wm):
    """Jm,Wm: (n,k) arrays k>=4 -> top-4 by weight, renormalised."""
    o=np.argsort(-Wm,axis=1)[:,:4]
    J2=np.take_along_axis(Jm,o,1);W2=np.take_along_axis(Wm,o,1)
    W2=W2/np.maximum(W2.sum(1,keepdims=True),1e-9)
    return J2,W2
def to_dict(J,W):
    return [dict((int(j),float(w)) for j,w in zip(J[i],W[i]) if w>1e-6) for i in range(len(J))]
def from_dict(D):
    n=len(D);J=np.zeros((n,4),np.uint8);W=np.zeros((n,4),np.float32)
    for i,d in enumerate(D):
        it=sorted(d.items(),key=lambda kv:-kv[1])[:4];s=sum(w for _,w in it)
        for k,(j,w) in enumerate(it):J[i,k]=j;W[i,k]=w/s
    return J,W
def smooth(t):
    t=np.clip(t,0,1);return t*t*(3-2*t)

def fix_orphans(sk,mesh):
    nb=sk.idx['neutral_bone'];D=to_dict(mesh.J,mesh.W)
    bad=[i for i,d in enumerate(D) if nb in d]
    good=np.array([i for i,d in enumerate(D) if nb not in d])
    tree=cKDTree(mesh.P[good]);log=[]
    for i in bad:
        _,nn=tree.query(mesh.P[i],k=6);acc_={}
        for g in good[nn]:
            for j,w in D[g].items():acc_[j]=acc_.get(j,0)+w
        s=sum(acc_.values());D[i]={j:w/s for j,w in acc_.items()}
        log.append((i,{sk.names[j]:round(w,2) for j,w in D[i].items()}))
    return D,log

def add_spine1(sk,mesh,D):
    iS,iS1,iC=sk.idx['Spine'],sk.idx['Spine1'],sk.idx['Chest']
    y0,y1,y2=[sk.pos(sk.rest_world,n)[1] for n in('Spine','Spine1','Chest')]
    n=0
    for i,d in enumerate(D):
        M=d.get(iS,0)+d.get(iC,0)
        if M<1e-6:continue
        y=mesh.P[i,1]
        if y<=y0 or y>=y2:continue            # below Spine joint / above Chest joint: unchanged
        t=(y-y0)/(y2-y0)                      # 0..1 along Spine->Chest
        t=smooth(t)                           # smooth S-curve so the bend is distributed
        # hat functions over Spine(0) Spine1(.5) Chest(1)
        wS=max(0,1-2*t);wC=max(0,2*t-1);w1=1-wS-wC
        # keep the original Spine/Chest split where the old rig already put Chest (e.g. shoulders) : blend by old Chest share
        oldC=d.get(iC,0)/M
        wC2=max(wC,oldC if y>y1 else 0)
        wS2=wS if y<=y1 else 0
        w1_=1-wS2-wC2
        d.pop(iS,None);d.pop(iC,None)
        d[iS]=M*wS2;d[iS1]=M*w1_;d[iC]=M*wC2
        n+=1
    return n

FING=['Index','Middle','Ring','Pinky']
def add_fingers(sk,mesh,D,side):
    """re-skin hand vertices: palm stays on Hand, fingers/thumb get their own bones."""
    sgn=1 if side=='L' else -1
    hand=sk.idx['Hand.'+side]
    rw=sk.rest_world
    # finger geometry in rest world (x along arm, z lateral)
    chains={}
    for f in FING:
        ps=[sk.pos(rw,f'{f}{k}.{side}') for k in (1,2,3)]
        chains[f]=dict(z=ps[0][2],xj=[abs(p[0]) for p in ps],ids=[sk.idx[f'{f}{k}.{side}'] for k in (1,2,3)])
    th=[sk.pos(rw,f'Thumb{k}.{side}') for k in (1,2,3)]
    tip_t=th[2]+(th[2]-th[1])*0.8
    th_ids=[sk.idx[f'Thumb{k}.{side}'] for k in (1,2,3)]
    wrist=abs(sk.pos(rw,'Hand.'+side)[0])
    cnt=0
    for i,d in enumerate(D):
        wh=d.get(hand,0)
        if wh<1e-4:continue
        p=mesh.P[i]
        if p[0]*sgn<wrist-0.01:continue
        x=abs(p[0]);z=p[2]
        out={}
        # --- thumb : distance to thumb polyline
        poly=[th[0],th[1],th[2],tip_t]
        best=(9,0,0)
        for k in range(3):
            a=poly[k];b=poly[k+1];ab=b-a;tt=np.clip(np.dot(p-a,ab)/np.dot(ab,ab),0,1);dd=np.linalg.norm(p-(a+tt*ab))
            if dd<best[0]:best=(dd,k,tt)
        dth=best[0]
        # --- fingers
        lat={f:np.exp(-((z-c['z'])/0.0075)**2) for f,c in chains.items()}
        sl=sum(lat.values())
        # thumb influence: vertices closer to thumb than to any finger row and displaced forward (z > Index row +0.014)
        thumb_share=smooth((z-(chains['Index']['z']+0.012))/0.012)*smooth((0.03-dth)/0.015+0.5) if z>chains['Index']['z']+0.01 else 0.0
        thumb_share=float(np.clip(thumb_share,0,1))
        fing_share=1-thumb_share
        # thumb weights
        if thumb_share>0:
            k,tt=best[1],best[2]
            # joint blending along chain: parent Hand -> T1 -> T2 -> T3
            s=k+tt   # 0..3
            wts={hand:max(0,1-s/0.5) if s<0.5 else 0}
            def hat(c,s):return max(0,1-abs(s-c)/1.0)
            wts[th_ids[0]]=hat(0.9,s)*(s>=0.0);wts[th_ids[1]]=hat(1.9,s);wts[th_ids[2]]=hat(2.8,s) if s<2.8 else 1.0
            wts[hand]=wts.get(hand,0)+max(0,1-s/0.9)*0.5
            tot=sum(wts.values())
            for j,w in wts.items():out[j]=out.get(j,0)+thumb_share*w/tot
        # finger weights
        for f,c in chains.items():
            if sl<1e-6:break
            share=fing_share*lat[f]/sl
            dl=0.006
            a1=smooth((x-(c['xj'][0]-dl))/(2*dl));a2=smooth((x-(c['xj'][1]-dl))/(2*dl));a3=smooth((x-(c['xj'][2]-dl))/(2*dl))
            wH=1-a1;w1=a1*(1-a2);w2=a2*(1-a3);w3=a3
            for j,w in ((hand,wH),(c['ids'][0],w1),(c['ids'][1],w2),(c['ids'][2],w3)):
                out[j]=out.get(j,0)+share*w
        if sl<1e-6:out={hand:1.0}
        rest={j:w for j,w in d.items() if j!=hand}
        for j,w in out.items():rest[j]=rest.get(j,0)+wh*w
        D[i]=rest;cnt+=1
    return cnt

def run(sk=None,verbose=True):
    sk=sk or Skel();res={};rep={}
    for mi in (0,1,2,3):
        m=Mesh(sk,mi);D,log=fix_orphans(sk,m);r={'orphans':log}
        if mi in(0,2):r['spine1']=add_spine1(sk,m,D)
        if mi==0:r['fingers']=add_fingers(sk,m,D,'L')+add_fingers(sk,m,D,'R')
        res[mi]=from_dict(D);rep[mi]=r
    return res,rep
if __name__=='__main__':
    res,rep=run();print(rep)
    np.savez('fixed_weights.npz',**{f'J{k}':v[0] for k,v in res.items()},**{f'W{k}':v[1] for k,v in res.items()})
