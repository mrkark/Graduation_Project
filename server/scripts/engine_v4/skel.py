import numpy as np, os
from glb import *
default_glb = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../client/public/models/karateka_lowpoly.glb'))
SRC = default_glb if os.path.exists(default_glb) else '../showcase/karateka_lowpoly.glb'
def qmul(a,b):
    x1,y1,z1,w1=np.moveaxis(a,-1,0);x2,y2,z2,w2=np.moveaxis(b,-1,0)
    return np.stack([w1*x2+x1*w2+y1*z2-z1*y2,w1*y2-x1*z2+y1*w2+z1*x2,w1*z2+x1*y2-y1*x2+z1*w2,w1*w2-x1*x2-y1*y2-z1*z2],-1)
def qnorm(q): return q/np.linalg.norm(q,axis=-1,keepdims=True)
def q2m(q):
    q=np.asarray(q,float);x,y,z,w=np.moveaxis(q,-1,0)
    m=np.empty(q.shape[:-1]+(3,3))
    m[...,0,0]=1-2*(y*y+z*z);m[...,0,1]=2*(x*y-z*w);m[...,0,2]=2*(x*z+y*w)
    m[...,1,0]=2*(x*y+z*w);m[...,1,1]=1-2*(x*x+z*z);m[...,1,2]=2*(y*z-x*w)
    m[...,2,0]=2*(x*z-y*w);m[...,2,1]=2*(y*z+x*w);m[...,2,2]=1-2*(x*x+y*y)
    return m
def m2q(R):
    R=np.asarray(R,float);t=np.trace(R)
    if t>0:
        s=np.sqrt(t+1)*2;q=[(R[2,1]-R[1,2])/s,(R[0,2]-R[2,0])/s,(R[1,0]-R[0,1])/s,s/4]
    elif R[0,0]>R[1,1] and R[0,0]>R[2,2]:
        s=np.sqrt(1+R[0,0]-R[1,1]-R[2,2])*2;q=[s/4,(R[0,1]+R[1,0])/s,(R[0,2]+R[2,0])/s,(R[2,1]-R[1,2])/s]
    elif R[1,1]>R[2,2]:
        s=np.sqrt(1+R[1,1]-R[0,0]-R[2,2])*2;q=[(R[0,1]+R[1,0])/s,s/4,(R[1,2]+R[2,1])/s,(R[0,2]-R[2,0])/s]
    else:
        s=np.sqrt(1+R[2,2]-R[0,0]-R[1,1])*2;q=[(R[0,2]+R[2,0])/s,(R[1,2]+R[2,1])/s,s/4,(R[1,0]-R[0,1])/s]
    q=np.array(q);q/=np.linalg.norm(q);return q
def axq(axis,ang):
    a=np.asarray(axis,float);a=a/np.linalg.norm(a);s=np.sin(ang/2);return np.array([a[0]*s,a[1]*s,a[2]*s,np.cos(ang/2)])
class Skel:
    def __init__(s,path=SRC):
        s.js,s.bn=load(path);js=s.js;N=js['nodes']
        s.J=js['skins'][0]['joints'];s.names=[N[j]['name'] for j in s.J];s.idx={n:i for i,n in enumerate(s.names)}
        jm={j:i for i,j in enumerate(s.J)}
        s.parent=np.array([jm.get(next((p for p,n in enumerate(N) if j in n.get('children',[])),-1),-1) for j in s.J])
        s.rest_t=np.array([N[j].get('translation',[0,0,0]) for j in s.J],float)
        s.rest_q=np.array([N[j].get('rotation',[0,0,0,1]) for j in s.J],float)
        s.rest_s=np.array([N[j].get('scale',[1,1,1]) for j in s.J],float)
        s.ibm=acc(js,s.bn,js['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
        s.nj=len(s.J)
        # topological order (parents first)
        s.order=[];seen=set()
        def add(i):
            if i in seen:return
            if s.parent[i]>=0:add(s.parent[i])
            seen.add(i);s.order.append(i)
        for i in range(s.nj):add(i)
        s.rest_world=s.fk(s.rest_q,s.rest_t)[0]
    def fk(s,q,t=None):
        """q: (nj,4) local quats; t: (nj,3) local translations (default rest). returns world (nj,4,4), and rot (nj,3,3)"""
        if t is None:t=s.rest_t
        W=np.zeros((s.nj,4,4));
        R=q2m(q)*s.rest_s[:,None,:]
        for i in s.order:
            L=np.eye(4);L[:3,:3]=R[i];L[:3,3]=t[i]
            W[i]=(W[s.parent[i]]@L) if s.parent[i]>=0 else L
        return W,None
    def pos(s,W,name): return W[s.idx[name]][:3,3]
class Mesh:
    def __init__(s,sk,mi):
        a=sk.js['meshes'][mi]['primitives'][0]['attributes']
        s.P=acc(sk.js,sk.bn,a['POSITION']);s.J=acc(sk.js,sk.bn,a['JOINTS_0']).astype(int);s.W=acc(sk.js,sk.bn,a['WEIGHTS_0'])
        pi=sk.js['meshes'][mi]['primitives'][0]
        s.F=acc(sk.js,sk.bn,pi['indices']).reshape(-1,3) if 'indices' in pi else None
        s.sk=sk
    def skin(s,Wm):
        M=Wm@s.sk.ibm  # (nj,4,4)
        Ph=np.c_[s.P,np.ones(len(s.P))]
        out=np.zeros((len(s.P),3))
        for k in range(4):
            Mk=M[s.J[:,k]]
            out+=s.W[:,k:k+1]*np.einsum('nij,nj->ni',Mk[:,:3,:],Ph)
        return out
