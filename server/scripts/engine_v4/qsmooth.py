import numpy as np
def align(Q):
    Q=Q.copy()
    for i in range(1,len(Q)):
        s=np.sign((Q[i]*Q[i-1]).sum(-1,keepdims=True));s[s==0]=1;Q[i]*=s
    return Q
def adaptive_smooth(Q,thr=42.0,pad=3,sig=1.4):
    """Gaussian-blur only the joints/frames where a rotation jumps by more than thr degrees/frame. returns Q', n_fixed"""
    Q=align(Q);F,J,_=Q.shape
    d=2*np.degrees(np.arccos(np.clip(np.abs((Q[1:]*Q[:-1]).sum(-1)),0,1)))        # F-1,J
    k=np.arange(-pad*2,pad*2+1);g=np.exp(-0.5*(k/sig)**2);g/=g.sum()
    out=Q.copy();fixed=0
    for j in range(J):
        bad=np.where(d[:,j]>thr)[0]
        if len(bad)==0:continue
        m=np.zeros(F)
        for b in bad:m[max(0,b-pad):min(F,b+pad+2)]=1.0
        m=np.convolve(m,np.exp(-0.5*(np.arange(-3,4)/1.5)**2)/np.exp(-0.5*(np.arange(-3,4)/1.5)**2).sum(),mode='same');m=np.clip(m*1.6,0,1)
        pq=np.pad(Q[:,j],((len(k)//2,len(k)//2),(0,0)),mode='edge')
        bl=np.stack([np.convolve(pq[:,c],g,mode='valid') for c in range(4)],-1)
        bl/=np.linalg.norm(bl,axis=1,keepdims=True)
        o=Q[:,j]*(1-m[:,None])+bl*m[:,None];o/=np.linalg.norm(o,axis=1,keepdims=True);out[:,j]=o;fixed+=len(bad)
    return out,fixed
def maxrot(Q):
    Q=align(Q);d=2*np.degrees(np.arccos(np.clip(np.abs((Q[1:]*Q[:-1]).sum(-1)),0,1)));return float(d.max()),int((d>40).sum())
