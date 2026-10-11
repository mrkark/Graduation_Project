import numpy as np,collections
from wvar2 import *
for mi,cm in ((2,C.cl[0]),(3,C.cl[1])):
    J,W=transfer(Bp,Bj,Bw,cm.P,k=6,p=2);J,W=smooth_weights(J,W,cm.F,iters=2);cm.J,cm.W=J,W
q,tt,_=r.solve(ALL['heian_shodan_preview'].P(19.0));e,d=C.check_sev(q,tt)
W0=sk.fk(sk.rest_q,sk.rest_t)[0]
ids=np.where(e&(C.dom=='UpperLeg.L'))[0]
o=np.array(W0[sk.idx['UpperLeg.L']])[:3,3];kn=np.array(W0[sk.idx['LowerLeg.L']])[:3,3];ax=(kn-o)/np.linalg.norm(kn-o)
t=(C.body.P[ids]-o)@ax;print('thigh len',np.linalg.norm(kn-o),'exposed along-bone',np.round(np.percentile(t,[0,50,100]),3),'dist outside mm',np.round(np.percentile(d[ids],[10,50,90])*1000,1))
print('body weights:',collections.Counter([tuple((inv[j],round(float(w),1)) for j,w in zip(Bj[i],Bw[i]) if w>0.05) for i in ids]).most_common(3))
pm=C.cl[1];tp=(pm.P-o)@ax;rad=np.linalg.norm((pm.P-o)-np.outer(tp,ax),axis=1);sel=(rad<0.14)&(np.abs(tp-np.median(t))<0.03)&(pm.P[:,0]>0)
print('pants verts around same ring: n',sel.sum(),collections.Counter([tuple((inv[j],round(float(w),1)) for j,w in zip(pm.J[i],pm.W[i]) if w>0.05) for i in np.where(sel)[0]]).most_common(4))
print('posed knee flex rad/deg:', None)
