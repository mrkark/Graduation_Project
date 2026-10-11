import view,sys
from build_all import ALL
from library import *
ALL.update(lib_kiba_soto())
from tl import get_rig
r=get_rig();view.setup()
DEMOS=[('01_zenkutsu_dachi','zenkutsu_dachi_left'),('02_kokutsu_dachi','kokutsu_dachi_left'),('03_kiba_dachi','kiba_dachi'),('04_oi_zuki','oi_zuki_left'),('05_gyaku_zuki','gyaku_zuki_left'),('06_gedan_barai','gedan_barai_left'),('07_age_uke','age_uke_left'),('08_soto_uke','soto_uke_left'),('09_mae_geri','mae_geri_left'),('10_forward_step','step_forward_left'),('11_backward_step','step_backward_left'),('12_turn_45','turn_left'),('13_turn_90','turn_with_step_left')]
import os;os.makedirs('demo',exist_ok=True)
sel=[a for a in sys.argv[1:]]
for nm,cl in DEMOS:
    if sel and nm[:2] not in sel:continue
    tl=ALL[cl];T=tl.T;ts=[T*f for f in (0.0,0.2,0.35,0.5,0.65,0.8,1.0)]
    poses=[]
    for t in ts:
        q,tr,_=r.solve(tl.P(min(t,T)));poses.append((q,tr))
    view.sheet(poses,[f'{cl} t={t:.2f}' for t in ts],f'demo/{nm}.png',views=('front','side','back','v45'),skel=False)
    print('ok',nm)
