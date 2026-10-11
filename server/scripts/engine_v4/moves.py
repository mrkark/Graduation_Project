"""Move sequencer: each move appends keys to one world-frame Timeline. Atomic clips are cut from the same code."""
from tech import *
def unwrap(prev,new,sign=0):
    d=new-prev
    while d>np.pi+1e-6 or (sign<0 and d>1e-6 and d>np.pi*0.0 and False):d-=2*np.pi;
    while d<-np.pi-1e-6:d+=2*np.pi
    return prev+d
class Seq:
    def __init__(s,start,name='seq'):
        s.tl=Timeline(name);s.cur=start;s.t=0.0;s.tl.key(0.0,start);s.log=[]
    def hold(s,dur,S=None):
        S=S or s.cur;s.t+=dur;s.tl.key(s.t,S);s.cur=S
    def goto(s,dur,S,**kw):
        s.t+=dur;s.tl.key(s.t,S,**kw);s.cur=S
def fix_angles(S_prev,S_new,turn_sign=0):
    """make yaw values continuous with the previous state (unwrapped) ; turn_sign>0 left, <0 right preferred for ties"""
    for k in('yaw','look','aim'):
        S_new[k]=prev_unwrap(S_prev[k],S_new[k],turn_sign)
    for sd in 'LR':
        S_new['feet'][sd]['yaw']=prev_unwrap(S_prev['feet'][sd]['yaw'],S_new['feet'][sd]['yaw'],turn_sign)
    return S_new
def prev_unwrap(prev,new,sign=0):
    d=(new-prev+np.pi)%(2*np.pi)-np.pi
    if abs(abs(d)-np.pi)<1e-3 and sign!=0:d=np.pi*np.sign(sign)
    return prev+d
def canon(name,lead,arms,heading=0.0,fist=(1,1),**kw):
    return state_from_stance(stance(name,lead),arms,fist=fist,**kw)
def stance_state(name,lead,arms,support=None,heading=0.0,prev=None,sign=0,fist=(1,1),pelvis_yaw_extra=0.0,**kw):
    """canonical stance placed in world so that foot `support[0]` ball sits at support[1] and body heading is `heading`"""
    S=canon(name,lead,arms,fist=fist,**kw);S['yaw']+=pelvis_yaw_extra
    if support is not None:S=place(S,support[0],support[1],heading)
    else:S=xf_state(S,heading,(0,0))
    if prev is not None:S=fix_angles(prev,S,sign)
    return S

def swing_via(cur,new,swing,support):
    A0,_,_=fk_ankle(cur['feet'][swing]);A1,_,_=fk_ankle(new['feet'][swing]);As,_,_=fk_ankle(cur['feet'][support])
    m=0.5*(A0+A1);m[1]=0.078;d=m-As;d[1]=0
    if np.linalg.norm(d)<0.30:
        dv=(A1-A0);dv[1]=0
        perp=np.array([dv[2],0,-dv[0]]);perp=unit(perp) if np.linalg.norm(perp)>1e-6 else np.array([1.0,0,0])
        if np.dot(perp,d)<0:perp=-perp
        base=As+(unit(d)*0.30 if np.linalg.norm(d)>0.02 else perp*0.30)
        m=base;m[1]=0.078
    return m
def step_into(seq,name,lead,heading,support,arms_final,strike=None,arms_prep=None,dur=0.64,turn_sign=0,
              prep_t=0.14,kime_t=0.10,settle_t=0.36,pelvis_yaw_extra=0.0,fist=(1,1),lift=0.05,chest=(0,0,0),yaw_prep=None,clav_final=None,clav_prep=None,look=None,arm_delay=None):
    """move to a new stance `name`/`lead` heading `heading` keeping the ball of `support` foot fixed. Appends keys to seq."""
    cur=seq.cur;swing=OPP[support]
    S_new=stance_state(name,lead,arms_final,support=(support,ball_of(cur,support)),heading=heading,prev=None,sign=turn_sign,pelvis_yaw_extra=pelvis_yaw_extra,fist=fist,chest=chest)
    S_new['look']=heading if look is None else look
    if clav_final:S_new['clav']=clav_final
    # --- prep state: tiny forward travel, swing foot unloads, head leads, arms to prep
    Sa=copy.deepcopy(cur)
    A0,_,_=fk_ankle(cur['feet'][swing]);A1,_,_=fk_ankle(S_new['feet'][swing]);dirv=A1-A0;dirv[1]=0;dirv=unit(dirv)
    Hd=np.array([S_new['H'][0]-cur['H'][0],0,S_new['H'][2]-cur['H'][2]]);Hd=unit(Hd) if np.linalg.norm(Hd)>1e-6 else Hd
    Sa['H']=cur['H']+Hd*0.035
    Sa['feet'][swing]=dict(mode='air',p=tuple(A0+dirv*0.09+np.array([0,0.018,0])),yaw=cur['feet'][swing]['yaw'],pitch=-6*D2R)
    Sa['look']=S_new['look']
    if yaw_prep is not None:Sa['yaw']=prev_unwrap(cur['yaw'],yaw_prep,turn_sign)
    if clav_prep:Sa['clav']=clav_prep
    if arms_prep:
        for sd,sp in arms_prep.items():Sa['arm'][sd]=sp
    # --- via waypoint for the swing foot (avoids the support foot)
    ez={'H':e_io,'pel':e_io,'foot'+swing:e_io,'foot'+support:e_io,'look':e_io,'clav':e_io,'chest':e_io,'fist':e_io}
    for sd in 'LR':ez['arm'+sd]=e_io
    if strike:ez['arm'+strike]=lambda p:e_in(p,2.4)
    big=abs(S_new['yaw']-cur['yaw'])>40*D2R
    dl={'foot'+support:((0.0,0.92) if big else (0.35,1.0)),'H':(0.0,0.92),'pel':(0.0,0.92),'look':(0.0,0.5)}
    if strike:dl['arm'+strike]=(0.45,1.0);dl['arm'+OPP[strike]]=(0.0,0.7)
    if arm_delay:dl.update(arm_delay)
    t0=seq.t
    seq.goto(prep_t,Sa,ease={'all':e_io},delay={'look':(0,0.8)})
    seq.goto(dur-prep_t,S_new,ease=ez,delay=dl,lift={swing:lift},lift_peak={swing:0.45})
    seq.land=getattr(seq,'land',[])+[seq.t]
    # kime + settle
    Sk=copy.deepcopy(S_new);seq.goto(kime_t,Sk);seq.goto(settle_t,copy.deepcopy(Sk))
    return S_new

def strike_in_place(seq,strike,arm_final_,arm_other,yaw_prep,yaw_final,arm_path_=None,dur=0.55,prep_t=0.22,kime_t=0.10,settle_t=0.36,clav_strike=(0,6*D2R),clav_other=(0,-8*D2R),fist=(1,1),chest_prep=None,pelvis_dz=0.0,other_prep=None,**kw):
    """hips + arm technique without foot movement (gyaku-zuki, gedan-barai, age-uke in place)"""
    cur=seq.cur;o=OPP[strike]
    Sp=copy.deepcopy(cur);Sp['yaw']=prev_unwrap(cur['yaw'],yaw_prep);Sp['H']=cur['H']+np.array([0,0,pelvis_dz])
    Sp['arm'][o]=other_prep or arm_other
    if chest_prep:Sp['chest']=chest_prep
    Sf=copy.deepcopy(cur);Sf['yaw']=prev_unwrap(Sp['yaw'],yaw_final);Sf['arm'][strike]=arm_path_ or arm_final_;Sf['arm'][o]=arm_other
    Sf['clav']={strike:clav_strike,o:clav_other};Sf['fist']={'L':fist[0],'R':fist[1]}
    seq.goto(prep_t,Sp,ease={'all':e_io},delay={'arm'+strike:(0.2,1.0)})
    seq.goto(dur,Sf,ease={'pel':lambda p:e_io(p),'H':e_io,'arm'+strike:lambda p:e_in(p,2.2),'arm'+o:e_io,'clav':e_io,'chest':e_io},delay={'pel':(0.0,0.75),'arm'+strike:(0.30,1.0),'clav':(0.2,1.0)})
    Sk=copy.deepcopy(Sf);Sk['arm'][strike]=arm_final_;seq.goto(kime_t,Sk);seq.goto(settle_t,copy.deepcopy(Sk))
    return Sf
def tettsui_withdraw(seq,side,heading,dur=0.8):
    """Heian Shodan move 4 : draw the front foot back halfway into moto-dachi (half zenkutsu) and strike tettsui-uchi forward"""
    cur=seq.cur;o=OPP[side]   # `side` = hammer-fist side = front foot being drawn back ; o = rear foot, stays
    S_new=stance_state('moto',side,{side:a_tettsui(side),o:a_hikite(o)},support=(o,ball_of(cur,o)),heading=heading)
    # keep pelvis nicely positioned for half-zenkutsu (moto-dachi)
    S_new['H']=S_new['H']+np.array([0,-0.02,0])
    Sp=copy.deepcopy(cur);Sp['arm'][side]=a_tettsui_prep(side);Sp['arm'][o]=a_hikite(o)
    seq.goto(0.30,Sp,ease={'all':e_io})
    seq.goto(dur-0.30,S_new,ease={'all':e_io,'arm'+side:lambda p:e_in(p,2.2)},delay={'arm'+side:(0.35,1.0),'foot'+side:(0.0,0.9)},lift={side:0.03})
    seq.land=getattr(seq,'land',[])+[seq.t]
    Sk=copy.deepcopy(S_new);seq.goto(0.10,Sk);seq.goto(0.34,copy.deepcopy(Sk))
    return S_new
