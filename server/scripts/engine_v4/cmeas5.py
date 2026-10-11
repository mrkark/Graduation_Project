import sys
from cmeas3 import *
from clip5 import *
from cloth import *
if __name__=='__main__':
    C=Clip5(sk)
    evalset(C,'ORIG weights',POSES)
    z=np.load('cloth_weights.npz')
    C.cl[0].J,C.cl[0].W=smooth_weights(z['J2'],z['W2'],C.cl[0].F,iters=2);C.cl[1].J,C.cl[1].W=smooth_weights(z['J3'],z['W3'],C.cl[1].F,iters=2)
    evalset(C,'transfer+smooth2',POSES)
