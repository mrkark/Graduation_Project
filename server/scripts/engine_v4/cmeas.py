import numpy as np,collections
from clip import *
from build_all import ALL
from tl import get_rig
r=get_rig();sk=r.sk
CLIPS=('zenkutsu_dachi_left','kokutsu_dachi_left','age_uke_left','gedan_barai_left','oi_zuki_left','gyaku_zuki_left','mae_geri_left','hikite_left','turn_left','heian_shodan_preview')
def measure(C,label,verbose=False):
    out=[];reg=collections.Counter()
    for n in CLIPS:
        tl=ALL[n];worst=0
        for k in range(0,int(tl.T*10)+1,3):
            qq,tt,_=r.solve(tl.P(min(k/10,tl.T)));e,d=C.check(qq,tt);e&=~np.isin(C.dom,['Toe.L','Toe.R','Foot.L','Foot.R'])
            if e.sum()>worst:worst=e.sum();wc=collections.Counter(C.dom[e])
        out.append(int(worst));reg.update(wc)
    print(label,out,'total',sum(out));
    if verbose:print(reg.most_common(8))
    return out
