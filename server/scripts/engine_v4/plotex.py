import numpy as np,matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt,sys,collections
from cmeas3 import *
from cloth import *
C=Clip4(sk);z=np.load('cloth_weights.npz')
C.cl[0].J,C.cl[0].W=smooth_weights(z['J2'],z['W2'],C.cl[0].F,iters=2);C.cl[1].J,C.cl[1].W=smooth_weights(z['J3'],z['W3'],C.cl[1].F,iters=2)
n,t=sys.argv[1],float(sys.argv[2])
q,tt,_=r.solve(ALL[n].P(t));e,d=C.check_sev(q,tt);Wm=sk.fk(q,tt)[0];pb=C.body.skin(Wm);V,F=C.cloth_tris(Wm)
print(collections.Counter(C.dom[e]).most_common(5))
fig,axs=plt.subplots(1,3,figsize=(15,6))
c=pb[e].mean(0) if e.any() else pb.mean(0)
for ax,(a,b) in zip(axs,((0,1),(2,1),(0,2))):
    ax.scatter(V[:,a],V[:,b],s=1.5,c='#7aa6d6',alpha=.6);ax.scatter(pb[~e,a],pb[~e,b],s=0.6,c='#bbb',alpha=.35);ax.scatter(pb[e,a],pb[e,b],s=8,c='r');ax.set_aspect('equal')
    ax.set_xlim(c[a]-0.45,c[a]+0.45);ax.set_ylim(c[b]-0.45,c[b]+0.45)
plt.tight_layout();plt.savefig('plotex.png',dpi=70)
