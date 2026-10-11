import numpy as np,collections
from cmeas import *
from clip3 import *
C=Clip3(sk);z=np.load('cloth_weights.npz')
C.cl[0].J,C.cl[0].W=z['J2'],z['W2'];C.cl[1].J,C.cl[1].W=z['J3'],z['W3']
inv={v:k for k,v in sk.idx.items()}
tl=ALL['zenkutsu_dachi_left'];q,tt,_=r.solve(tl.P(0.3));e=C.check(q,tt)
zz=np.load('fixed_weights.npz');Bj=zz['J0'];Bw=zz['W0']
W0=sk.fk(sk.rest_q,sk.rest_t)[0]
ids=np.where(e&(C.dom=='LowerArm.L'))[0]
Pbr=C.body.P
o=np.array(W0[sk.idx['LowerArm.L']])[:3,3];h=np.array(W0[sk.idx['Hand.L']])[:3,3]
ax=(h-o)/np.linalg.norm(h-o)
t=(Pbr[ids]-o)@ax
print('forearm length',np.linalg.norm(h-o),'exposed along-bone: min %.3f max %.3f'%(t.min(),t.max()))
print('weights of exposed:',collections.Counter([tuple((inv[j],round(float(w),1)) for j,w in zip(Bj[i],Bw[i]) if w>0.05) for i in ids]).most_common(4))
V=C.cl[0].P;tt_=(V-o)@ax;rad=np.linalg.norm((V-o)-np.outer(tt_,ax),axis=1);sel=(rad<0.09)&(tt_>-0.05)&(tt_<0.4)
print('jacket verts near forearm axis: along-bone %.3f..%.3f'%(tt_[sel].min(),tt_[sel].max()))
print('covered forearm verts along-bone pct 0/50/100:',np.percentile(((Pbr[C.cov&(C.dom=="LowerArm.L")]-o)@ax),[0,50,100]))
