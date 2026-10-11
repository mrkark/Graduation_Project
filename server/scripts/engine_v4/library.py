"""Atomic Shotokan action library (87 clips) built from the procedural move engine."""
from heian import *
GUARD=lambda: {'L':a_guard('L'),'R':a_guard('R')}
def S_shiz(arms=None):return canon('shizentai','L',arms or {'L':a_yoi('L'),'R':a_yoi('R')})
def S_zen(lead,arms):return canon('zenkutsu',lead,arms)
def zen_gedan(lead):return S_zen(lead,{lead:a_gedan(lead),OPP[lead]:a_hikite(OPP[lead])})
def zen_punch(lead,hand):return S_zen(lead,{hand:a_punch(hand),OPP[hand]:a_hikite(OPP[hand])})
def breathe(S,name,T=2.0):
    tl=Timeline(name);tl.key(0,S);S2=copy.deepcopy(S);S2['H']=S['H']+np.array([0,0.004,0]);S2['chest']=(0,0.012,0)
    tl.key(T/2,S2,ease={'all':e_io});tl.key(T,copy.deepcopy(S),ease={'all':e_io});tl.loop=True;return tl
def clip_from(seq,name,loop=False):
    seq.tl.name=name;seq.tl.loop=loop;return seq.tl
def shift_state(S,dz=0,dx=0,dy=0,foot=None):
    o=copy.deepcopy(S);o['H']=S['H']+np.array([dx,dy,dz]);return o

def lib_stances():
    out={}
    out['idle_shizentai']=breathe(S_shiz(),'idle_shizentai')
    for sd,nm in (('L','left'),('R','right')):
        out[f'zenkutsu_dachi_{nm}']=breathe(zen_gedan(sd),f'zenkutsu_dachi_{nm}')
        S=canon('kokutsu',sd,{sd:a_shuto_final(sd),OPP[sd]:a_shuto_support(OPP[sd])},fist=(0,0))
        out[f'kokutsu_dachi_{nm}']=breathe(S,f'kokutsu_dachi_{nm}')
    out['heiko_dachi']=breathe(canon('heiko','L',{'L':a_yoi('L'),'R':a_yoi('R')}),'heiko_dachi')
    out['fudo_dachi']=breathe(canon('fudo','L',GUARD()),'fudo_dachi')
    return out
def lib_transitions():
    out={}
    for sd,nm in (('L','left'),('R','right')):
        o=OPP[sd]
        seq=Seq(S_shiz());step_into(seq,'zenkutsu',sd,0.0,o,{sd:a_gedan(sd),o:a_hikite(o)},strike=sd,arms_prep={sd:a_gedan_prep(sd)},dur=0.8,prep_t=0.3,settle_t=0.2);out[f'enter_zenkutsu_{nm}']=clip_from(seq,f'enter_zenkutsu_{nm}')
        seq=Seq(zen_gedan(sd));step_into(seq,'shizentai','L',0.0,o,{'L':a_yoi('L'),'R':a_yoi('R')},dur=0.8,prep_t=0.2,settle_t=0.2);out[f'exit_zenkutsu_{nm}']=clip_from(seq,f'exit_zenkutsu_{nm}')
        seq=Seq(S_shiz());step_into(seq,'kokutsu',sd,0.0,o,{sd:a_shuto_final(sd),o:a_shuto_support(o)},strike=sd,arms_prep={sd:a_shuto_prep(sd)},dur=0.85,prep_t=0.3,settle_t=0.2,fist=(0,0));out[f'enter_kokutsu_{nm}']=clip_from(seq,f'enter_kokutsu_{nm}')
        seq=Seq(canon('kokutsu',sd,{sd:a_shuto_final(sd),o:a_shuto_support(o)},fist=(0,0)));step_into(seq,'shizentai','L',0.0,o,{'L':a_yoi('L'),'R':a_yoi('R')},dur=0.8,prep_t=0.2,settle_t=0.2,fist=(1,1));out[f'exit_kokutsu_{nm}']=clip_from(seq,f'exit_kokutsu_{nm}')
    seq=Seq(S_shiz());step_into(seq,'heiko','L',0.0,'R',{'L':a_yoi('L'),'R':a_yoi('R')},dur=0.6,prep_t=0.2,settle_t=0.2);out['enter_heiko_dachi']=clip_from(seq,'enter_heiko_dachi')
    seq=Seq(canon('heiko','L',{'L':a_yoi('L'),'R':a_yoi('R')}));step_into(seq,'shizentai','L',0.0,'R',{'L':a_yoi('L'),'R':a_yoi('R')},dur=0.6,prep_t=0.2,settle_t=0.2);out['exit_heiko_dachi']=clip_from(seq,'exit_heiko_dachi')
    return out

def air(A,yaw=0.0,pitch=0.0,pole=None):
    d=dict(mode='air',p=tuple(A),yaw=yaw,pitch=pitch)
    if pole is not None:d['knee_pole']=tuple(unit(pole))
    return d
def lib_footwork():
    out={}
    G=GUARD
    # diagonal/forward/back steps in zenkutsu (guard arms)
    for sd,nm in (('L','left'),('R','right')):
        o=OPP[sd]
        seq=Seq(S_zen(o,G()));step_into(seq,'zenkutsu',sd,0.0,o,G(),dur=0.75,prep_t=0.15,settle_t=0.25);out[f'step_forward_{nm}']=clip_from(seq,f'step_forward_{nm}')
        seq=Seq(S_zen(sd,G()));step_into(seq,'zenkutsu',o,0.0,sd,G(),dur=0.8,prep_t=0.15,settle_t=0.25);out[f'step_backward_{nm}']=clip_from(seq,f'step_backward_{nm}')
    # walking steps from shizentai : left foot forward, right foot joins
    def walk(dirn,name):
        S0=S_shiz(G());seq=Seq(S0)
        sgnd=1 if dirn>0 else -1
        # support right, swing left forward 0.5 into short natural stance
        S1=copy.deepcopy(S0);A0,_,_=fk_ankle(S0['feet']['L']);
        S1['feet']['L']=dict(S0['feet']['L']);S1['feet']['L']['p']=(S0['feet']['L']['p'][0],S0['feet']['L']['p'][1]+0.5*sgnd)
        S1['H']=S0['H']+np.array([0,-0.03,0.25*sgnd]);S1['look']=0
        S2=copy.deepcopy(S1);S2['feet']['R']=dict(S0['feet']['R']);S2['feet']['R']['p']=(S0['feet']['R']['p'][0],S0['feet']['R']['p'][1]+0.5*sgnd);S2['H']=S0['H']+np.array([0,0,0.5*sgnd])
        seq.goto(0.55,S1,ease={'all':e_io},lift={'L':0.05},delay={'H':(0.0,1.0)})
        seq.goto(0.55,S2,ease={'all':e_io},lift={'R':0.05})
        seq.hold(0.2);return clip_from(seq,name)
    out['step_forward']=walk(1,'step_forward');out['step_backward']=walk(-1,'step_backward')
    # suri-ashi slides in zenkutsu L
    def slide(dirn,name):
        S0=S_zen('L',G());sg=dirn;seq=Seq(S0)
        dz=0.15*sg
        S1=copy.deepcopy(S0);S1['feet']['L']=dict(S0['feet']['L']);S1['feet']['L']['p']=(S0['feet']['L']['p'][0],S0['feet']['L']['p'][1]+dz);S1['H']=S0['H']+np.array([0,0,0.5*dz])
        S2=copy.deepcopy(S1);S2['feet']['R']=dict(S0['feet']['R']);S2['feet']['R']['p']=(S0['feet']['R']['p'][0],S0['feet']['R']['p'][1]+dz);S2['H']=S0['H']+np.array([0,0,dz])
        first,second=('L','R') if dirn>0 else ('R','L')
        # back slide moves rear foot first
        if dirn<0:
            S1=copy.deepcopy(S0);S1['feet']['R']=dict(S0['feet']['R']);S1['feet']['R']['p']=(S0['feet']['R']['p'][0],S0['feet']['R']['p'][1]+dz);S1['H']=S0['H']+np.array([0,0,0.5*dz])
            S2=copy.deepcopy(S1);S2['feet']['L']=dict(S0['feet']['L']);S2['feet']['L']['p']=(S0['feet']['L']['p'][0],S0['feet']['L']['p'][1]+dz);S2['H']=S0['H']+np.array([0,0,dz])
        seq.goto(0.45,S1,ease={'all':e_io},lift={first:0.012});seq.goto(0.45,S2,ease={'all':e_io},lift={second:0.012});seq.hold(0.2);return clip_from(seq,name)
    out['slide_forward']=slide(1,'slide_forward');out['slide_backward']=slide(-1,'slide_backward')
    # weight shifts (feet fixed). forward shift lifts the rear heel
    def shift(S0,dz,dx,name,heel=None,T=1.0):
        S1=copy.deepcopy(S0);S1['H']=S0['H']+np.array([dx,0,dz])
        if heel:
            f=dict(S0['feet'][heel]);f['pitch']=-14*D2R;S1['feet'][heel]=f
        tl=Timeline(name);tl.key(0,S0);tl.key(T*0.45,S1,ease={'all':e_io});tl.key(T*0.55,copy.deepcopy(S1));tl.key(T,copy.deepcopy(S0),ease={'all':e_io});return tl
    Z=S_zen('L',G())
    out['shift_weight_forward']=shift(Z,0.10,0,'shift_weight_forward','R');out['shift_weight_backward']=shift(Z,-0.10,0,'shift_weight_backward')
    Hh=canon('heiko','L',G())
    out['shift_weight_left']=shift(Hh,0,0.06,'shift_weight_left');out['shift_weight_right']=shift(Hh,0,-0.06,'shift_weight_right')
    Fd=canon('fudo','L',G())
    out['stance_shift_forward']=shift(Fd,0.08,0,'stance_shift_forward','R');out['stance_shift_backward']=shift(Fd,-0.08,0,'stance_shift_backward')
    out['stance_shift_left']=shift(Fd,0,0.07,'stance_shift_left');out['stance_shift_right']=shift(Fd,0,-0.07,'stance_shift_right')
    return out

def lib_turns():
    out={}
    G=GUARD
    for sd,nm,sg in (('L','left',1),('R','right',-1)):
        o=OPP[sd]
        # pivot : both feet pivot on their balls (35 deg), pelvis follows (small turn within a stance)
        S0=S_zen('L',G());S1=copy.deepcopy(S0)
        for k in 'LR':S1['feet'][k]=dict(S0['feet'][k]);S1['feet'][k]['yaw']+=sg*35*D2R
        S1['yaw']+=sg*35*D2R;S1['look']+=sg*35*D2R;S1['aim']+=sg*35*D2R
        tl=Timeline(f'pivot_{nm}');tl.key(0,S0);tl.key(0.2,copy.deepcopy(S0));tl.key(0.7,S1,ease={'all':e_io},delay={'look':(0,0.6)});tl.key(1.0,copy.deepcopy(S1));out[f'pivot_{nm}']=tl
        # turn 45 in natural stance (step + pivot)
        seq=Seq(S_shiz(G()));step_into(seq,'shizentai','L',sg*45*D2R,'R',G(),turn_sign=sg,dur=0.8,prep_t=0.25,settle_t=0.3);out[f'turn_{nm}']=clip_from(seq,f'turn_{nm}')
        seq=Seq(S_shiz(G()));step_into(seq,'shizentai','L',sg*90*D2R,'R',G(),turn_sign=sg,dur=0.95,prep_t=0.3,settle_t=0.3);out[f'turn_with_step_{nm}']=clip_from(seq,f'turn_with_step_{nm}')
        seq=Seq(S_shiz(G()));step_into(seq,'zenkutsu',sd,sg*45*D2R,o,{sd:a_gedan(sd),o:a_hikite(o)},strike=sd,arms_prep={sd:a_gedan_prep(sd)},turn_sign=sg,dur=0.95,prep_t=0.3,settle_t=0.25);out[f'turn_into_zenkutsu_{nm}']=clip_from(seq,f'turn_into_zenkutsu_{nm}')
        seq=Seq(S_shiz(G()));step_into(seq,'kokutsu',sd,sg*45*D2R,o,{sd:a_shuto_final(sd),o:a_shuto_support(o)},strike=sd,arms_prep={sd:a_shuto_prep(sd)},turn_sign=sg,dur=1.0,prep_t=0.3,settle_t=0.25,fist=(0,0));out[f'turn_into_kokutsu_{nm}']=clip_from(seq,f'turn_into_kokutsu_{nm}')
        # hip rotation (koshi) in place: hanmi -> shomen, feet fixed
        lead=OPP[sd]    # strike with `sd` fist as gyaku punch
        S0=S_zen(lead,{lead:a_gedan(lead),sd:a_hikite(sd)});seq=Seq(S0)
        strike_in_place(seq,sd,a_punch(sd),a_hikite(lead),yaw_prep=-sg*(-1)*0+(-35*D2R if lead=='L' else 35*D2R),yaw_final=(6*D2R if lead=='L' else -6*D2R),dur=0.5,prep_t=0.25)
        out[f'hip_rotation_{nm}']=clip_from(seq,f'hip_rotation_{nm}')
    # pivot on front / rear foot in zenkutsu L (90 deg left)
    seq=Seq(S_zen('L',G()));step_into(seq,'zenkutsu','L',90*D2R,'L',G(),turn_sign=1,dur=0.9,prep_t=0.25,settle_t=0.3);out['front_leg_pivot']=clip_from(seq,'front_leg_pivot')
    seq=Seq(S_zen('L',G()));step_into(seq,'zenkutsu','L',90*D2R,'R',G(),turn_sign=1,dur=0.9,prep_t=0.25,settle_t=0.3);out['rear_leg_pivot']=clip_from(seq,'rear_leg_pivot')
    # kata transitions
    seq=Seq(zen_punch('R','L'));gd={'L':a_gedan('L'),'R':a_hikite('R')}
    step_into(seq,'zenkutsu','L',90*D2R,'R',gd,strike='L',arms_prep={'L':a_gedan_prep('L')},turn_sign=1,dur=0.9,prep_t=0.3);out['turn_and_block']=clip_from(seq,'turn_and_block')
    seq=Seq(zen_gedan('R'));step_into(seq,'zenkutsu','L',90*D2R,'R',{'L':a_punch('L'),'R':a_hikite('R')},strike='L',turn_sign=1,dur=0.9,prep_t=0.3);out['turn_and_punch']=clip_from(seq,'turn_and_punch')
    seq=Seq(zen_gedan('L'));step_into(seq,'zenkutsu','R',-180*D2R,'L',G(),turn_sign=-1,dur=0.95,prep_t=0.3);step_into(seq,'zenkutsu','L',-180*D2R,'R',G(),dur=0.75,prep_t=0.15);out['turn_and_step']=clip_from(seq,'turn_and_step')
    seq=Seq(zen_gedan('L'));step_into(seq,'zenkutsu','R',-180*D2R,'L',{'R':a_gedan('R'),'L':a_hikite('L')},strike='R',arms_prep={'R':a_gedan_prep('R')},turn_sign=-1,dur=0.95,prep_t=0.3);out['turn_and_enter_zenkutsu']=clip_from(seq,'turn_and_enter_zenkutsu')
    seq=Seq(zen_gedan('L'));step_into(seq,'kokutsu','R',-90*D2R,'L',{'R':a_shuto_final('R'),'L':a_shuto_support('L')},strike='R',arms_prep={'R':a_shuto_prep('R')},turn_sign=-1,dur=1.0,prep_t=0.3,fist=(0,0));out['turn_and_enter_kokutsu']=clip_from(seq,'turn_and_enter_kokutsu')
    seq=Seq(zen_gedan('L'));step_into(seq,'shizentai','L',-180*D2R,'R',{'L':a_yoi('L'),'R':a_yoi('R')},turn_sign=-1,dur=1.1,prep_t=0.3);out['turn_and_recover']=clip_from(seq,'turn_and_recover')
    return out

def arm_move(S0,side,spec,dur,name,fist_to=None,hold=0.15,settle=0.3,ease_p=2.2,body=None):
    S1=copy.deepcopy(S0);S1['arm'][side]=spec
    if fist_to is not None:S1['fist'][side]=fist_to
    if body:body(S1)
    tl=Timeline(name);tl.key(0,S0);tl.key(0.12,copy.deepcopy(S0));tl.key(0.12+dur,S1,ease={'all':e_io,'arm'+side:lambda p:e_in(p,ease_p)});tl.key(0.12+dur+hold,copy.deepcopy(S1));tl.key(0.12+dur+hold+settle,copy.deepcopy(S1));return tl
def lib_arms_and_techniques():
    out={}
    for sd,nm in (('L','left'),('R','right')):
        o=OPP[sd];lead_g=o     # gyaku : opposite leg forward
        # hikite / chamber / fist_*  (base: zenkutsu with the opposite leg forward)
        base=S_zen(lead_g,{sd:a_punch(sd),o:a_hikite(o)})
        out[f'hikite_{nm}']=arm_move(base,sd,a_hikite(sd),0.35,f'hikite_{nm}')
        out[f'fist_retraction_{nm}']=arm_move(base,sd,a_hikite(sd),0.3,f'fist_retraction_{nm}')
        base2=S_zen(lead_g,{sd:a_hikite(sd),o:a_hikite(o)})
        out[f'fist_extension_{nm}']=arm_move(base2,sd,a_punch(sd),0.3,f'fist_extension_{nm}',hold=0.1)
        base3=S_zen(lead_g,{sd:a_hang(sd),o:a_hikite(o)});base3['fist'][sd]=0.0
        out[f'chamber_{nm}']=arm_move(base3,sd,a_hikite(sd),0.5,f'chamber_{nm}',fist_to=1.0)
        out[f'fist_chamber_{nm}']=arm_move(S_zen(lead_g,{sd:a_yoi(sd),o:a_hikite(o)}),sd,a_hikite(sd),0.4,f'fist_chamber_{nm}')
    # both-arm versions
    for key,spec_from,spec_to in (('hikite_both',a_guard,a_hikite),('chamber_both',a_hang,a_hikite)):
        S0=canon('heiko','L',{'L':spec_from('L'),'R':spec_from('R')});S1=copy.deepcopy(S0);S1['arm']={'L':spec_to('L'),'R':spec_to('R')}
        if key=='chamber_both':S0['fist']={'L':0.0,'R':0.0}
        tl=Timeline(key);tl.key(0,S0);tl.key(0.12,copy.deepcopy(S0));tl.key(0.62,S1,ease={'all':e_io});tl.key(0.8,copy.deepcopy(S1));tl.key(1.1,copy.deepcopy(S1));out[key]=tl
    # techniques
    for sd,nm in (('L','left'),('R','right')):
        o=OPP[sd]
        seq=Seq(state_from_stance(zen(o),{o:a_punch(o),sd:a_hikite(sd)}));
        # oi-zuki : step with `sd`
        tl=oi_zuki(sd,name=f'oi_zuki_{nm}');out[f'oi_zuki_{nm}']=tl
        # chudan / jodan zuki : same-side punch in place, front leg = same side
        for lev,spec in (('chudan',a_punch(sd)),('jodan',a_punch_jodan(sd))):
            S0=S_zen(sd,{sd:a_hikite(sd),o:a_gedan(o)}) if False else S_zen(sd,{sd:a_hikite(sd),o:a_hikite(o)});seq=Seq(S0)
            strike_in_place(seq,sd,spec,a_hikite(o),yaw_prep=(-10*D2R if sd=='L' else 10*D2R),yaw_final=0.0,dur=0.42,prep_t=0.2,clav_strike=(0,5*D2R),clav_other=(0,-6*D2R))
            out[f'{lev}_zuki_{nm}']=clip_from(seq,f'{lev}_zuki_{nm}')
        # gyaku-zuki : lead = opposite leg, punch with sd
        S0=S_zen(o,{o:a_gedan(o),sd:a_hikite(sd)});seq=Seq(S0)
        strike_in_place(seq,sd,a_punch(sd),a_hikite(o),yaw_prep=(-35*D2R if o=='L' else 35*D2R),yaw_final=(6*D2R if o=='L' else -6*D2R),dur=0.5,prep_t=0.28)
        out[f'gyaku_zuki_{nm}']=clip_from(seq,f'gyaku_zuki_{nm}')
        # gedan-barai : lead = same side
        S0=S_zen(sd,{sd:a_punch(sd),o:a_hikite(o)});seq=Seq(S0)
        strike_in_place(seq,sd,a_gedan(sd),a_hikite(o),yaw_prep=(-35*D2R if sd=='L' else 35*D2R),yaw_final=0.0,arm_path_=arm_path(a_gedan_prep(sd),a_gedan(sd),knots=[0.45,1.0]),dur=0.55,prep_t=0.3,clav_strike=(0,4*D2R))
        out[f'gedan_barai_{nm}']=clip_from(seq,f'gedan_barai_{nm}')
        # age-uke : lead = same side
        S0=S_zen(sd,{sd:a_gedan(sd),o:a_hikite(o)});seq=Seq(S0)
        strike_in_place(seq,sd,a_age(sd),a_hikite(o),yaw_prep=(-20*D2R if sd=='L' else 20*D2R),yaw_final=0.0,arm_path_=arm_path(a_age_prep(sd),a_age(sd),knots=[0.5,1.0]),dur=0.6,prep_t=0.3,clav_strike=(4*D2R,3*D2R))
        out[f'age_uke_{nm}']=clip_from(seq,f'age_uke_{nm}')
    return out

# ---------------- mae-geri (rear leg kicks from zenkutsu, support = front leg) ----------------
def kick_states(sd):
    o=OPP[sd]                       # kicker = sd (rear leg), support = front = o
    S0=S_zen(o,GUARD())
    ks=S0['feet'][sd]; sup=S0['feet'][o]
    sbx,sbz=sup['p']                # support ball
    # S1 stabilise : pelvis over the supporting foot, upright, shomen
    S1=copy.deepcopy(S0);S1['H']=np.array([sbx-0.04*(1 if o=='L' else -1)*0,0.84,sbz-0.06]);S1['yaw']=0.0;S1['look']=0
    S1['H'][0]=sbx-(0.105 if o=='L' else -0.105)+0.0
    hx=S1['H'][0]+(0.105 if sd=='L' else -0.105);hz=S1['H'][2]
    S1['feet'][sd]=air((hx,0.16,hz-0.30),0.0,20*D2R,pole=(0,0.2,1.0))
    def chamber_foot(hy):
        knee=np.array([hx,hy+0.06,hz+0.40]);A=knee+0.42*unit(np.array([0,-0.82,-0.57]))
        return air(A,0.0,35*D2R,pole=(0,0.35,1.0))
    S2=copy.deepcopy(S1);S2['feet'][sd]=chamber_foot(0.84)
    S3=copy.deepcopy(S1);S3['H']=S1['H']+np.array([0,0,0.03]);S3['feet'][sd]=air((hx,0.76,S3['H'][2]+0.70),0.0,60*D2R,pole=(0,0.2,1.0))
    S3['chest']=(0,0.0,0)
    S4=copy.deepcopy(S2)
    return S0,S1,S2,S3,S4
def lib_kicks():
    out={}
    for sd,nm in (('L','left'),('R','right')):
        S0,S1,S2,S3,S4=kick_states(sd)
        E={'all':e_io}
        # chamber clip : stance -> shift -> chamber
        tl=Timeline(f'mae_geri_chamber_{nm}');tl.key(0,S0);tl.key(0.1,copy.deepcopy(S0))
        tl.key(0.5,S1,ease=E);tl.key(0.9,S2,ease=E,lift={},delay={});tl.key(1.1,copy.deepcopy(S2));out[f'mae_geri_chamber_{nm}']=tl
        # recovery : extension -> rechamber -> stance
        tl=Timeline(f'mae_geri_recovery_{nm}');tl.key(0,S3);tl.key(0.08,copy.deepcopy(S3))
        tl.key(0.33,S4,ease=E);tl.key(0.75,S1,ease=E);tl.key(1.2,S0,ease=E);tl.key(1.4,copy.deepcopy(S0));out[f'mae_geri_recovery_{nm}']=tl
        # full kick : STABILIZE -> CHAMBER -> EXTENSION -> KIME -> RECHAMBER -> RECOVERY
        tl=Timeline(f'mae_geri_{nm}');tl.key(0,S0);tl.key(0.1,copy.deepcopy(S0))
        tl.key(0.45,S1,ease=E);tl.key(0.80,S2,ease=E);tl.key(0.93,S3,ease={'all':e_snap});tl.key(1.01,copy.deepcopy(S3))
        tl.key(1.27,S4,ease=E);tl.key(1.62,S1,ease=E);tl.key(2.1,S0,ease=E);tl.key(2.3,copy.deepcopy(S0));out[f'mae_geri_{nm}']=tl
    return out

# ---------------- kiba-dachi, soto-uke ----------------
def S_kiba(arms=None):return canon('kiba','L',arms or {'L':a_hikite('L'),'R':a_hikite('R')})
def lib_kiba_soto():
    out={}
    out['kiba_dachi']=breathe(S_kiba(),'kiba_dachi')
    seq=Seq(canon('heiko','L',{'L':a_yoi('L'),'R':a_yoi('R')}));step_into(seq,'kiba','L',0.0,'R',{'L':a_hikite('L'),'R':a_hikite('R')},dur=0.8,prep_t=0.2,settle_t=0.3);out['enter_kiba_dachi']=clip_from(seq,'enter_kiba_dachi')
    seq=Seq(S_kiba());step_into(seq,'heiko','L',0.0,'R',{'L':a_yoi('L'),'R':a_yoi('R')},dur=0.8,prep_t=0.2,settle_t=0.3);out['exit_kiba_dachi']=clip_from(seq,'exit_kiba_dachi')
    for sd,nm in (('L','left'),('R','right')):
        o=OPP[sd]
        S0=S_zen(sd,{sd:a_hikite(sd),o:a_hikite(o)});seq=Seq(S0)
        strike_in_place(seq,sd,a_soto_final(sd),a_hikite(o),yaw_prep=(-30*D2R if sd=='L' else 30*D2R),yaw_final=(8*D2R if sd=='L' else -8*D2R),
                        arm_path_=arm_path(a_soto_prep(sd),a_soto_mid(sd),a_soto_final(sd),knots=[0.3,0.65,1.0]),dur=0.6,prep_t=0.3,clav_strike=(0,3*D2R))
        out[f'soto_uke_{nm}']=clip_from(seq,f'soto_uke_{nm}')
    return out
