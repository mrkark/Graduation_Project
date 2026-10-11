import numpy as np
def joint_offsets(sk,P,names=('UpperArm.L','UpperArm.R','LowerArm.L','LowerArm.R','UpperLeg.L','UpperLeg.R','LowerLeg.L','LowerLeg.R','Shoulder.L','Shoulder.R','Spine','Spine1'),sigma=0.075):
    W0=np.array(sk.fk(sk.rest_q,sk.rest_t)[0]);f=np.zeros(len(P))
    for n in names:
        o=W0[sk.idx[n]][:3,3];d=np.linalg.norm(P-o,axis=1);f=np.maximum(f,np.exp(-(d/sigma)**2))
    return f
