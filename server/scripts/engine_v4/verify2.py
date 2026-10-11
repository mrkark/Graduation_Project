import numpy as np,json
exec(open('verify.py').read().split("footmask={}")[0])
from build_all import ALL,names
from tl import get_rig
r=get_rig();ski=r.sk
out={};legs={}
for an in js['animations']:
    n=an['name'];tl=ALL[n];ch=tracks(an);T=tl.T;RATE=120;N=int(T*RATE)+1;ts=np.arange(N)/RATE
    q=np.tile(sk.rest_q[None],(N,1,1));tr=np.tile(sk.rest_t[None],(N,1,1))
    for (node,path),(t,v) in ch.items():
        j=sk.J.index(node);i=np.clip(np.searchsorted(t,ts,side='right')-1,0,len(t)-2);u=((ts-t[i])/(t[i+1]-t[i])).clip(0,1)[:,None]
        if path=='rotation':q[:,j]=slerp(v[i],v[i+1],u)
        else:tr[:,j]=v[i]*(1-u)+v[i+1]*u
    dev=0;pdev=0
    for k in range(1,N,2):
        t_=min(ts[k],T);qs,trs,_=r.solve(tl.P(t_))
        A=np.array(ski.fk(qs,trs)[0])[:,:3,3];B=np.array(sk.fk(q[k],tr[k])[0])[:,:3,3]
        dev=max(dev,np.abs(A-B).max());lg=[sk.idx[x] for x in ('Foot.L','Foot.R','Toe.L','Toe.R','LowerLeg.L','LowerLeg.R')];pdev=max(pdev,np.abs(A[lg]-B[lg]).max())
    out[n]=dev;legs[n]=pdev
v=sorted(out.items(),key=lambda kv:-kv[1]);print('max joint deviation exported-vs-solver (m):',v[:6]);print('all-joint max dev (m):',max(out.values()))

print('legs/feet max dev (mm):',round(max(legs.values())*1000,2),sorted(legs.items(),key=lambda kv:-kv[1])[:3])
