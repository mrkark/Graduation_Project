import numpy as np,sys
from cmeas3 import *
from cloth import *
C=Clip4(sk);zz=np.load('fixed_weights.npz')
Bp=C.body.P;Bj=zz['J0'].astype(int);Bw=zz['W0']
POS=[POSES[i] for i in (0,1,5,6,10,12,13)]
for k,p,sm in ((1,2,0),(2,2,0),(3,3,1),(1,2,1)):
    for mi,cm in ((2,C.cl[0]),(3,C.cl[1])):
        J,W=transfer(Bp,Bj,Bw,cm.P,k=k,p=p)
        if sm:J,W=smooth_weights(J,W,cm.F,iters=sm)
        cm.J,cm.W=J,W
    evalset(C,f'transfer k={k} p={p} smooth={sm}',POS)
