import numpy as np,collections,time
from build_all import ALL,names
from clip5 import *
from skel import Skel
from tl import get_rig
r=get_rig();sk2=Skel('karateka_shotokan_v2.glb')
C=Clip5(sk2);print('tracked',C.cov.sum(),flush=True)
rng=np.random.default_rng(3);rows=[];tot=0
for n in names:
    tl=ALL[n];ts=[tl.T*f for f in (0.35,0.6,0.85)] if tl.T>1.5 else [tl.T*0.5,tl.T*0.9]
    ts+= [k['t'] for k in tl.keys if rng.random()<0.15][:1]
    w=0;reg=collections.Counter();mx=0
    for t in ts:
        q,tt,_=r.solve(tl.P(min(t,tl.T)));e,d=C.check_sev(q,tt);w=max(w,int(e.sum()));reg.update(C.dom[e]);mx=max(mx,float(d[e].max())*1000 if e.any() else 0)
    rows.append((n,w,round(mx),dict(reg.most_common(2))));tot+=w;print(n,w,round(mx),dict(reg.most_common(2)),flush=True)
print('TOTAL max-per-clip sum',tot,'clips with exposure',sum(1 for x in rows if x[1]>0),'of',len(rows))
