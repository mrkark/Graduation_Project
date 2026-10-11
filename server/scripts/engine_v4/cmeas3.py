import numpy as np,collections,sys
from cmeas import *
from clip3 import *
from library import lib_kiba_soto
ALL.update(lib_kiba_soto())
POSES=[('zenkutsu_dachi_left',0.3),('oi_zuki_left',0.7),('gyaku_zuki_left',0.8),('gedan_barai_left',0.9),('age_uke_left',1.0),('soto_uke_left',1.2),('kokutsu_dachi_left',0.5),('kiba_dachi',0.5),('mae_geri_left',0.95),('hikite_both',0.9),('turn_with_step_left',0.7),('heian_shodan_preview',10.0),('heian_shodan_preview',19.0),('heian_shodan_preview',24.7)]
def evalset(C,label,poses=POSES):
    tot=[];reg=collections.Counter();mx=[]
    for n,t in poses:
        q,tt,_=r.solve(ALL[n].P(min(t,ALL[n].T)));e,d=C.check_sev(q,tt);tot.append(int(e.sum()));reg.update(C.dom[e]);mx.append(round(float(d[e].max())*1000,0) if e.any() else 0)
    print(label,tot,'sum',sum(tot),'max mm',max(mx),reg.most_common(5),flush=True);return tot
if __name__=='__main__':
    C=Clip4(sk);evalset(C,'orig cloth weights')
    z=np.load('cloth_weights.npz');from cloth import *
    C.cl[0].J,C.cl[0].W=smooth_weights(z['J2'],z['W2'],C.cl[0].F,iters=2);C.cl[1].J,C.cl[1].W=smooth_weights(z['J3'],z['W3'],C.cl[1].F,iters=2)
    evalset(C,'transfer+smooth2')
