import numpy as np,collections,sys,time
from cmeas5 import *
import opt_cloth
C=Clip5(sk);z=np.load('cloth_weights.npz')
rng=np.random.default_rng(7)
names=list(ALL);poses=[]
while len(poses)<int(sys.argv[1]):
    n=names[rng.integers(len(names))];t=rng.random()*ALL[n].T;poses.append((n,t))
def run(label):
    tot=0;reg=collections.Counter();per=[]
    for n,t in poses:
        q,tt,_=r.solve(ALL[n].P(t));e,d=C.check_sev(q,tt);tot+=e.sum();per.append(int(e.sum()));reg.update(C.dom[e])
    print(label,'total',tot,'poses with any',sum(1 for p in per if p),'of',len(per),reg.most_common(5),flush=True)
run('ORIG')
C.cl[0].J,C.cl[0].W=smooth_weights(z['J2'],z['W2'],C.cl[0].F,iters=2);C.cl[1].J,C.cl[1].W=smooth_weights(z['J3'],z['W3'],C.cl[1].F,iters=2)
run('transfer+smooth2')
