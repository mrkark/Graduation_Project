import sys,numpy as np
from kata_defs2 import *
def diag(nm,thr=38,fps=60):
    d=KATA[nm];mv=d['fn']();seq,ev=build_kata(nm,mv,start_stance=d['start']);tl=seq.tl;r=get_rig();inv={v:k for k,v in r.sk.idx.items()}
    def mvof(t):
        for e in ev:
            if e[3]<=t<=e[4]+1e-6:return e[0],e[1],e[2]
        return None
    prev=None;rows=[];ov=[]
    for t in np.arange(0,tl.T,1/fps):
        q,tt,inf=r.solve(tl.P(t))
        for k,v in inf.items():
            if 'over' in k and v>0.01:ov.append((round(t,2),k,round(float(v),3),mvof(t)))
        if prev is not None:
            dd=2*np.degrees(np.arccos(np.clip(np.abs((q*prev).sum(-1)),0,1)))
            if dd.max()>thr:rows.append((round(t,2),round(float(dd.max()),0),inv[int(np.argmax(dd))],mvof(t)))
        prev=q
    return rows,ov
if __name__=='__main__':
    for nm in sys.argv[1:]:
        rows,ov=diag(nm);print(nm);[print(' pop',r) for r in rows];[print(' over',o) for o in ov[:6]]
