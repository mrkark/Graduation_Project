import numpy as np
from kata_engine import *
def popscan(tl,fps=60,thr=35):
    r=get_rig();sk=r.sk;inv={v:k for k,v in sk.idx.items()};prev=None;out=[];tm=0
    for t in np.arange(0,tl.T,1/fps):
        q,tt,inf=r.solve(tl.P(t))
        if prev is not None:
            d=2*np.degrees(np.arccos(np.clip(np.abs((q*prev).sum(-1)),0,1)))
            tm=max(tm,d.max())
            if d.max()>thr:out.append((round(t,2),round(float(d.max()),1),inv.get(int(np.argmax(d)),'?')))
        prev=q
    return tm,out
if __name__=='__main__':
    mv=[M(90,'zenkutsu','L',['L:gedan_barai']),M(0,'zenkutsu','R',['R:oi_zuki']),M(0,'zenkutsu','R',['L:age_uke'],mode='inplace'),M(0,None,None,[],kick='mawashi:L'),M(0,'zenkutsu','L',['L:zuki'])]
    seq,ev=build_kata('test',mv);print(popscan(seq.tl))
