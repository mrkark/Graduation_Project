import sys,json,numpy as np
import build_all as BA
from kata_defs2 import *
from sample import sample
import glbio,cloth_phys as cp
from qsmooth import adaptive_smooth,maxrot
from tl import get_rig
r=get_rig();sk=r.sk;Hi=sk.idx['Hips'];B=cp.build_bones(sk)
z=np.load('final_weights.npz');cw=np.load('cloth_weights.npz');weights={0:(z['J0'],z['W0']),1:(z['J1'],z['W1']),2:(cw['J2'],cw['W2']),3:(cw['J3'],cw['W3'])}
NEW={}
SIDE={'L':'left','R':'right'}
TECH_STANCE={'shuto_uke':'kokutsu','morote_uke':'kokutsu','kakiwake_uke':'kokutsu','haishu_uke':'kokutsu','yoko_empi':'kiba','tate_shuto_uke':'kokutsu'}
TECHS=['uchi_uke','soto_uke','gedan_barai','age_uke','shuto_uke','morote_uke','kakiwake_uke','haishu_uke','mae_empi','yoko_empi','age_empi','otoshi_empi','ushiro_empi','uraken','yoko_tettsui','tettsui','nukite','teisho','shuto_uchi',
 'age_zuki','mawashi_zuki','tate_zuki','kagi_zuki','oi_zuki','gyaku_zuki','jodan_zuki','gedan_zuki','osae_uke','sukui_uke','manji_uke','hasami','morote_age_uke','koho_zuki_age','morote_zuki','yama_zuki','yoko_zuki','juji_uke','gedan_juji_uke','shuto_juji_uke']
for tn in TECHS:
    for sd in 'LR':
        st=TECH_STANCE.get(tn,'zenkutsu');kb=st=='kiba'
        mv=[M(0,st,'L' if kb else sd,[f'{sd}:{tn}'])]
        seq,ev=build_kata(f'tech_{tn}_{SIDE[sd]}',mv,start_stance='shizentai');seq.hold(0.4)
        NEW[f'tech_{tn}_{SIDE[sd]}']=seq.tl
for kd in ('mae_geri','mae_keage','mawashi','yoko_kekomi','yoko_keage','ushiro','hiza','mikazuki','nami_gaeshi','yoko_fumikomi'):
    for sd in 'LR':
        seq,ev=build_kata(f'kick_{kd}_{SIDE[sd]}',[KICK(kd,sd)],start_stance='zenkutsu');seq.hold(0.3)
        NEW[f'kick_{kd}_{SIDE[sd]}']=seq.tl
for nm,(dy,h) in {'jump_turn_180':(180,0.30),'jump_turn_360':(360,0.34),'jump_turn_180_right':(-180,0.30),'jump_forward':(0,0.30)}.items():
    seq,ev=build_kata(nm,[JUMP(dy,'shizentai','L',h=h,dz=0.9 if nm=='jump_forward' else 0.0)],start_stance='shizentai');seq.hold(0.4);NEW[nm]=seq.tl
for stn in ('heisoku','musubi','hachiji','uchi_hachiji','renoji','neko','kosa','hangetsu','sanchin','shiko','moto','tsuru'):
    for ld in 'LR':
        if stn in('heisoku','musubi','hachiji','uchi_hachiji','shiko') and ld=='R':continue
        n=f'stance_{stn}'+('' if stn in('heisoku','musubi','hachiji','uchi_hachiji','shiko') else '_'+SIDE[ld])
        tl=breathe(canon(stn,ld,{'L':a_guard('L'),'R':a_guard('R')}),n);NEW[n]=tl
clips=[];names=BA.names+list(NEW)
ALLC=dict(BA.ALL);ALLC.update(NEW)
for n in names:
    tl=ALLC[n];fr=sample(tl,60);Q=np.stack([f['q'] for f in fr]);Tr=np.stack([f['tr'] for f in fr]);Ht=Tr[:,Hi]
    Qs,fx=adaptive_smooth(Q)
    loop=bool(getattr(tl,'loop',False))
    cq=cp.simulate(sk,B,np.concatenate([Qs,Qs]),np.concatenate([Tr,Tr]),60)[len(Qs):] if loop else cp.simulate(sk,B,Qs,Tr,60)
    ex=dict(loop=loop,fps=60,rootMotion={'hipsDelta':[round(float(x),4) for x in (Ht[-1]-Ht[0])],'rootTranslation':0},clothBones=len(B),isNew=n in NEW)
    clips.append(dict(name=n,fps=60,q=Qs,hips_t=Ht,cq=cq,extras=ex));print(n,len(Q),fx,flush=True)
sz=glbio.write('out4/karateka_techniques_v4.glb',weights,clips,cloth=B);print('written',sz,len(clips))
