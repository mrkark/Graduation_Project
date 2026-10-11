import numpy as np
from scipy.spatial import cKDTree
def transfer(body_P,body_J,body_W,cl_P,k=6,p=2.0,limit=None):
    T=cKDTree(body_P);d,idx=T.query(cl_P,k=k);d=d.reshape(len(cl_P),-1);idx=idx.reshape(len(cl_P),-1);J=np.zeros((len(cl_P),4),np.uint16);W=np.zeros((len(cl_P),4),np.float32)
    for v in range(len(cl_P)):
        acc={}
        wt=1.0/(d[v]+2e-3)**p;wt/=wt.sum()
        for n in range(k):
            for j,w in zip(body_J[idx[v,n]],body_W[idx[v,n]]):
                if w>0:acc[int(j)]=acc.get(int(j),0)+w*wt[n]
        top=sorted(acc.items(),key=lambda x:-x[1])[:4];s=sum(w for _,w in top)
        for i,(j,w) in enumerate(top):J[v,i]=j;W[v,i]=w/s
    return J,W

import scipy.sparse as sp
def adjacency(F,n):
    i=np.r_[F[:,0],F[:,1],F[:,2],F[:,1],F[:,2],F[:,0]];j=np.r_[F[:,1],F[:,2],F[:,0],F[:,0],F[:,1],F[:,2]]
    A=sp.coo_matrix((np.ones(len(i)),(i,j)),shape=(n,n)).tocsr();A.data[:]=1;return A
def smooth_weights(J,W,F,nj=64,iters=4,alpha=0.5):
    n=len(J);D=np.zeros((n,nj));
    for k in range(4):np.add.at(D,(np.arange(n),J[:,k].astype(int)),W[:,k])
    A=adjacency(F,n);deg=np.asarray(A.sum(1)).ravel();Dn=sp.diags(1/np.maximum(deg,1))@A
    for _ in range(iters):D=(1-alpha)*D+alpha*(Dn@D)
    Jn=np.zeros((n,4),np.uint16);Wn=np.zeros((n,4),np.float32)
    top=np.argsort(-D,1)[:,:4]
    for k in range(4):Jn[:,k]=top[:,k];Wn[:,k]=D[np.arange(n),top[:,k]]
    Wn/=Wn.sum(1,keepdims=True);return Jn,Wn
