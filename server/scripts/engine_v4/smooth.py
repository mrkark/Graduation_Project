import numpy as np
ARMJ=[f'{n}.{s}' for n in ('Shoulder','UpperArm','LowerArm','Hand') for s in 'LR']
def _align(Q):
    Q=Q.copy()
    for k in range(1,len(Q)):
        d=(Q[k]*Q[k-1]).sum(-1);Q[k]=np.where(d[...,None]<0,-Q[k],Q[k])
    return Q
def steps(Q):
    d=np.abs((Q[1:]*Q[:-1]).sum(-1)).clip(0,1);return 2*np.degrees(np.arccos(d))
def fix_pops(Q,idx,thr=22.0,iters=12):
    """adaptive local smoothing of arm joint rotations only where per-frame step exceeds thr (deg)"""
    Q=_align(Q);J=[idx[n] for n in ARMJ if n in idx];n=0
    for it in range(iters):
        st=steps(Q[:,J]);bad=np.where(st.max(1)>thr)[0]+1     # frame k = step between k-1 and k
        if len(bad)==0:break
        mark=np.zeros(len(Q),bool)
        for k in bad:mark[max(k-2,0):k+2]=True
        Qn=Q.copy()
        for k in np.where(mark)[0]:
            if k==0 or k==len(Q)-1:continue
            v=0.25*Q[k-1][J]+0.5*Q[k][J]+0.25*Q[k+1][J];Qn[k][J]=v/np.linalg.norm(v,axis=-1,keepdims=True)
        Q=Qn;n+=1
    return Q,n
