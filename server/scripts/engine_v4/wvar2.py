import numpy as np,sys
from cmeas3 import *
from cloth import *
C=Clip4(sk);zz=np.load('fixed_weights.npz')
Bp=C.body.P;Bj=zz['J0'].astype(int);Bw=zz['W0']
inv={v:k for k,v in sk.idx.items()}
side=np.array([1 if inv[j].endswith('.L') else (-1 if inv[j].endswith('.R') else 0) for j in range(sk.nj)])
def sidefix(J,W,P,thr=0.02):
    J=J.astype(int).copy();W=W.copy();hips=sk.idx['Hips']
    for v in range(len(P)):
        x=P[v,0];s=0 if abs(x)<thr else (1 if x>0 else -1)
        if s==0:continue
        bad=(side[J[v]]==-s)&(W[v]>0)
        if bad.any():
            W[v,bad]=0
            if W[v].sum()<1e-6:J[v,0]=hips;W[v,0]=1
            W[v]/=W[v].sum()
    return J.astype(np.uint16),W.astype(np.float32)
if __name__=='__main__':
    POS=[POSES[i] for i in (0,1,5,6,10,12,13)]
    for mi,cm in ((2,C.cl[0]),(3,C.cl[1])):
        J,W=transfer(Bp,Bj,Bw,cm.P,k=6,p=2);J,W=sidefix(J,W,cm.P);J,W=smooth_weights(J,W,cm.F,iters=2);J,W=sidefix(J,W,cm.P);cm.J,cm.W=J,W
    evalset(C,'side-aware transfer k6 + smooth2 (ref 318)',POS)
