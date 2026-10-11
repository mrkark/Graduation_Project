import numpy as np,matplotlib;matplotlib.use('Agg')
import matplotlib.pyplot as plt
from skel import *
from rig import *
_sk=None;_meshes=None
def setup(use_fixed=True):
    global _sk,_meshes
    _sk=Skel();_meshes=[Mesh(_sk,i) for i in range(4)]
    if use_fixed:
        z=np.load('final_weights.npz')
        for i,m in enumerate(_meshes):m.J=z[f'J{i}'].astype(int);m.W=z[f'W{i}']
    return _sk,_meshes
COL=['#c07a50','#222','#7a8fa8','#5a6a85']
def draw(ax,q,t,view,sub=3,lim=None,skel=True,cen=None):
    t=t.copy();_h=_sk.idx['Hips'];t[_h]=t[_h]-np.array([t[_h][0],0,t[_h][2]])
    W,_=_sk.fk(q,t)
    for mi,m in enumerate(_meshes):
        X=m.skin(W)[::sub]
        if view in('back','v45'):
            c45=np.cos(np.pi/4);X=np.c_[(-X[:,0] if view=='back' else X[:,0]*c45+X[:,2]*c45),X[:,1],X[:,2]]
            ax.scatter(X[:,0],X[:,1],s=0.6,c=COL[mi],alpha=.7)
        elif view=='front':ax.scatter(X[:,0],X[:,1],s=0.6,c=COL[mi],alpha=.7)
        elif view=='side':ax.scatter(X[:,2],X[:,1],s=0.6,c=COL[mi],alpha=.7)
        elif view=='top':ax.scatter(X[:,0],X[:,2],s=0.6,c=COL[mi],alpha=.7)
    if skel and view not in('back','v45'):
        for i in range(_sk.nj):
            p=_sk.parent[i]
            if p<0:continue
            a=W[p][:3,3];b=W[i][:3,3]
            if view=='front':ax.plot([a[0],b[0]],[a[1],b[1]],'r-',lw=.6)
            elif view=='side':ax.plot([a[2],b[2]],[a[1],b[1]],'r-',lw=.6)
            else:ax.plot([a[0],b[0]],[a[2],b[2]],'r-',lw=.6)
    ax.set_aspect('equal')
    if lim:
        cx,cy=lim if view!='top' else (0,0)
    if view in('front',):ax.set_xlim(-1,1);ax.set_ylim(0,1.9)
    elif view in('side','back','v45'):ax.set_xlim(-1,1);ax.set_ylim(0,1.9)
    else:ax.set_xlim(-1,1);ax.set_ylim(-1,1)
    ax.axhline(0,color='g',lw=.5) if view!='top' else None
    ax.set_xticks([]);ax.set_yticks([])
def sheet(poses,titles,fn,views=('front','side','top'),sub=3,skel=True):
    n=len(poses);fig,axs=plt.subplots(len(views),n,figsize=(3.6*n,3.6*len(views)),squeeze=False)
    for c,(P,ti) in enumerate(zip(poses,titles)):
        q,t=P
        for r,v in enumerate(views):
            draw(axs[r][c],q,t,v,sub=sub,skel=skel)
            if r==0:axs[r][c].set_title(ti,fontsize=8)
    plt.tight_layout();plt.savefig(fn,dpi=80);plt.close()
