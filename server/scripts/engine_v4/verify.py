import numpy as np,json,glb
from skel import *
P='karateka_shotokan_v2.glb'
js,bn=glb.load(P);sk=Skel(P)
print('skin joints',sk.nj,'anims',len(js['animations']))
M=Mesh(sk,0)
W=M.W.sum(1);print('weights sum min/max',W.min(),W.max())
def slerp(a,b,u):
    d=(a*b).sum(-1,keepdims=True);b=np.where(d<0,-b,b);d=np.abs(d).clip(0,1)
    th=np.arccos(d);s=np.sin(th);s=np.where(s<1e-6,1,s)
    r=(np.sin((1-u)*th)*a+np.sin(u*th)*b)/s
    nl=(1-u)*a+u*b
    return np.where(th<1e-4,nl,r)
def tracks(an):
    ch={}
    for c in an['channels']:
        s=an['samplers'][c['sampler']];t=acc(js,bn,s['input']).ravel();v=acc(js,bn,s['output'])
        ch[(c['target']['node'],c['target']['path'])]=(t,v)
    return ch
from glb import acc
nodeof={j:n for j,n in enumerate(sk.J)}
footmask={}
for sdn in 'LR':
    vm=np.zeros(len(M.P),bool)
    for n_ in ['Foot.','Toe.','Toe1.','Toe2.','Toe3.','Toe4.','Toe5.']:
        if n_+sdn in sk.idx:vm|=((M.W*(M.J==sk.idx[n_+sdn])).sum(1)>0.5)
    footmask[sdn]=vm
rep={}
for an in js['animations']:
    ch=tracks(an);T=max(v[0][-1] for v in ch.values());RATE=120;n=int(T*RATE)+1
    q=np.tile(sk.rest_q[None],(n,1,1));tr=np.tile(sk.rest_t[None],(n,1,1))
    ts=np.arange(n)/RATE
    for (node,path),(t,v) in ch.items():
        j=sk.J.index(node);
        i=np.clip(np.searchsorted(t,ts,side='right')-1,0,len(t)-2);u=((ts-t[i])/(t[i+1]-t[i])).clip(0,1)[:,None]
        if path=='rotation':q[:,j]=slerp(v[i],v[i+1],u)
        else:tr[:,j]=v[i]*(1-u)+v[i+1]*u
    lows=[];sl={'L':0,'R':0};rootmax=0;prev=None
    for k in range(n):
        Wm=sk.fk(q[k],tr[k])[0] if isinstance(sk.fk(q[k],tr[k]),tuple) else sk.fk(q[k],tr[k])
        X=M.skin(Wm);lows.append(X[:,1].min())
        cur=X.copy()
        if prev is not None:
            for sdn,vm in footmask.items():
                lowk=vm&(cur[:,1]<0.004)&(prev[:,1]<0.004)
                if lowk.sum()>=3:
                    d=np.linalg.norm((cur[lowk]-prev[lowk])[:,[0,2]],axis=1).min()*RATE
                    sl[sdn]=max(sl[sdn],d)
        prev=cur
    rt=np.abs(tr[:,sk.idx['Root']]-sk.rest_t[sk.idx['Root']]).max()
    rep[an['name']]=(round(min(lows),4),round(max(sl.values()),3),round(float(rt),5))
bad={k:v for k,v in rep.items() if v[0]<-0.012 or v[1]>0.05 or v[2]>1e-4}
print('clips',len(rep),'flagged',len(bad));[print(k,v) for k,v in bad.items()]
print('min lowest vertex',min(v[0] for v in rep.values()),'max slide',max(v[1] for v in rep.values()))
json.dump(rep,open('verify.json','w'))
