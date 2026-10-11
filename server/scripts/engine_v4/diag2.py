import numpy as np,collections
from cmeas import *
from clip3 import *
C=Clip4(sk);print('covered (away from cuffs/hems):',C.cov.sum())
res=[]
for n,t in (('zenkutsu_dachi_left',0.3),('oi_zuki_left',0.7),('age_uke_left',1.0),('kokutsu_dachi_left',0.5),('mae_geri_left',1.0),('kiba_dachi',0.5),('heian_shodan_preview',10.0)):
    from library import lib_kiba_soto
    tl=ALL[n] if n in ALL else lib_kiba_soto()[n]
    q,tt,_=r.solve(tl.P(t));e=C.check(q,tt);res.append(int(e.sum()));print(n,e.sum(),collections.Counter(C.dom[e]).most_common(4),flush=True)
