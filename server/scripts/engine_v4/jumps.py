"""Jump builder: crouch -> push-off -> flight (all feet air, tucked) -> landing -> settle.  Pelvis rises via H (Root stays 0)."""
from kicks2 import *
def jump_clip(name,start='shizentai',end='shizentai',dyaw_deg=180,height=0.30,dz=0.0,lead_s='L',lead_e='L',arms_s=None,arms_f=None,tuck=0.50,fist=(1,1),T_air=0.50):
    G=GUARD();arms_s=arms_s or G;arms_f=arms_f or G
    S0=canon(start,lead_s,arms_s);dy=np.radians(dyaw_deg)
    S5=canon(end,lead_e,arms_f,heading=dy)
    # translate landing by dz along its heading
    S5['H']=S5['H']+np.array([np.sin(dy)*0,0,0])+Ry(dy)@np.array([0,0,dz]) if False else S5['H']
    def shifted(S,d):
        o=copy.deepcopy(S)
        for sd in 'LR':
            f=o['feet'][sd]
            if f['mode']=='air':f['p']=tuple(np.asarray(f['p'])+d)
            else:f['p']=(f['p'][0]+d[0],f['p'][1]+d[2])
        o['H']=o['H']+d;return o
    d=np.array([0,0,dz]);d=Ry(dy)@d if False else d
    S5=shifted(S5,d) if dz else S5
    S1=copy.deepcopy(S0);S1['H']=S0['H']+np.array([0,-0.14,0]);S1['chest']=(0,np.radians(8),0)
    hx=lambda S,sd:S['H']+Ry(S['yaw'])@np.array([sgn(sd)*0.11,0,0])
    # take-off : legs extended, up on toes
    S2=copy.deepcopy(S0);S2['H']=S0['H']+np.array([0,0.22,0]);S2['yaw']=dy*0.12
    for sd in 'LR':
        h=hx(S2,sd);S2['feet'][sd]=air((h[0],0.12,h[2]-0.04),S2['yaw'],np.radians(-55),pole=(0,0.1,1))
    # apex : knees tucked, rotated by dyaw*0.55
    S3=copy.deepcopy(S2);S3['H']=S0['H']+np.array([0,height,0])+np.array([0,0,dz*0.5]);S3['yaw']=dy*0.60
    for sd in 'LR':
        h=hx(S3,sd);S3['feet'][sd]=air((h[0],h[1]-0.80+tuck*0.9-0.0,h[2]-0.12*0 -0.10),S3['yaw'],np.radians(-35),pole=(0,0.3,1))
    # pre-landing : legs reaching down, rotation done
    S4=copy.deepcopy(S3);S4['yaw']=dy;S4['H']=S5['H']+np.array([0,0.10,0])-Ry(dy)@np.array([0,0,0])
    for sd in 'LR':
        h=hx(S4,sd);S4['feet'][sd]=air((h[0],0.10,h[2]+0.0),dy,np.radians(-15),pole=(0,0.1,1))
    S5c=copy.deepcopy(S5);S5c['H']=S5['H']+np.array([0,-0.14,0])
    tl=Timeline(name);E={'all':e_io};t=0.0
    tl.key(0,S0);tl.key(0.1,copy.deepcopy(S0))
    tl.key(0.45,S1,ease=E);tl.key(0.62,S2,ease={'all':e_snap})
    tl.key(0.62+T_air*0.45,S3,ease=E);tl.key(0.62+T_air,S4,ease=E)
    tl.key(0.62+T_air+0.10,S5c,ease={'all':e_snap});tl.key(0.62+T_air+0.45,S5,ease=E);tl.key(0.62+T_air+0.65,copy.deepcopy(S5))
    return tl
def lib_jumps():
    o={}
    o['jump_turn_180']=jump_clip('jump_turn_180',dyaw_deg=180)
    o['jump_turn_360']=jump_clip('jump_turn_360',dyaw_deg=360,height=0.34,T_air=0.56)
    o['jump_forward']=jump_clip('jump_forward',dyaw_deg=0,dz=0.9,height=0.30)
    o['jump_kanku_turn_180']=jump_clip('jump_kanku_turn_180',dyaw_deg=180,height=0.30)
    return o
