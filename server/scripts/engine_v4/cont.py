import numpy as np,sys
from build_all import ALL,names
from tl import get_rig
r=get_rig();sk=r.sk;inv={v:k for k,v in sk.idx.items()}
FPS=60;res={}
for n in names:
    tl=ALL[n];F=int(round(tl.T*FPS))+1;prev=None;worst={}
    for k in range(F):
        q,tr,info=r.solve(tl.P(min(k/FPS,tl.T)))
        if prev is not None:
            d=2*np.degrees(np.arccos(np.clip(np.abs((q*prev).sum(1)),0,1)))
            for j in np.where(d>40)[0]:
                if d[j]>worst.get(inv[j],(0,0))[0]:worst[inv[j]]=(round(float(d[j]),1),round(k/FPS,3))
        prev=q
    if worst:res[n]=worst
for n,w in res.items():print(n,w)
print('clips with >40deg/frame steps:',len(res))
