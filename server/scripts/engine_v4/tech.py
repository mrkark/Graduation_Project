"""Technique timelines. All authored in the anchor frame of the clip start (Root stays 0)."""
from sample import *
OPP={'L':'R','R':'L'}
def shift_stance(S,dz=0.0,dx=0.0):
    o=dict(S);o['feet']={}
    for k,f in S['feet'].items():
        f=dict(f);p=list(f['p']);p[0]+=dx;p[-1]+=dz;f['p']=tuple(p);o['feet'][k]=f
    o['H']=S['H']+np.array([dx,0,dz]);return o
def st(Sn,armL,armR,fist=(1,1),**kw):
    return state_from_stance(Sn,{'L':armL,'R':armR},fist=fist,**kw)
STEP=0.90   # ball-to-ball stance length of zenkutsu
def zen(lead,dz=0.0):return shift_stance(stance('zenkutsu',lead),dz)
def punch_state(lead,hand,dz=0.0,**kw):
    """zenkutsu with `hand` punching (chudan) and the other hand in hikite"""
    S=zen(lead,dz);arms={hand:a_punch(hand),OPP[hand]:a_hikite(OPP[hand])}
    return state_from_stance(S,arms,look=0.0,**kw)
def oi_zuki(side,entry=None,jodan=False,name=None):
    o=OPP[side];pa=a_punch_jodan if jodan else a_punch
    S0=entry or state_from_stance(zen(o),{o:a_punch(o),side:a_hikite(side)})
    S2=zen(side,STEP)
    Sa=copy.deepcopy(S0);Sa['H']=S0['H']+np.array([0,0,0.035])
    A0,_,_=fk_ankle(S0['feet'][side]);Sa['feet'][side]=dict(mode='air',p=tuple(A0+np.array([0,0.018,0.09])),yaw=S0['feet'][side]['yaw'],pitch=-6*D2R)
    Sb=state_from_stance(S2,{side:pa(side),o:a_hikite(o)})
    Sk=copy.deepcopy(Sb)
    tl=Timeline(name or 'oi_zuki_'+('left' if side=='L' else 'right'))
    tl.key(0.0,S0)
    tl.key(0.14,Sa,ease={'all':e_io},delay={'arm'+o:(0.2,1.0)})
    tl.key(0.64,Sb,ease={'H':e_io,'pel':e_io,'foot'+side:e_io,'foot'+o:e_io,'arm'+side:lambda p:e_in(p,2.4),'arm'+o:e_io,'look':e_io,'clav':e_io,'chest':e_io},
           delay={'foot'+o:(0.35,1.0),'arm'+side:(0.45,1.0),'arm'+o:(0.0,0.7),'H':(0.0,0.92),'pel':(0.0,0.92)},lift={side:0.045},lift_peak={side:0.45})
    tl.key(0.74,Sk)          # kime : short stabilisation
    tl.key(1.10,Sk)          # recovery
    return tl

# ======================= generic placement / transforms =======================
def xf_pt(p,yaw,T):
    c,s=np.cos(yaw),np.sin(yaw);return (c*p[0]+s*p[1]+T[0],-s*p[0]+c*p[1]+T[1])   # rotation about +Y (xz plane): x'=c x + s z ; z'=-s x + c z
def xf_state(S,yaw,T):
    """rigidly move a state: rotate by yaw (about +Y) then translate xz by T"""
    o=copy.deepcopy(S)
    x,z=xf_pt((S['H'][0],S['H'][2]),yaw,T);o['H']=np.array([x,S['H'][1],z])
    o['yaw']=S['yaw']+yaw;o['look']=S['look']+yaw;o['aim']=S['aim']+yaw
    for sd,f in S['feet'].items():
        f=dict(f)
        if f['mode']=='air':
            x,z=xf_pt((f['p'][0],f['p'][2]),yaw,T);f['p']=(x,f['p'][1],z)
        else:
            f['p']=xf_pt(f['p'],yaw,T)
        f['yaw']=f['yaw']+yaw
        if 'knee_pole' in f:
            kp=f['knee_pole'];c,s=np.cos(yaw),np.sin(yaw);f['knee_pole']=(c*kp[0]+s*kp[2],kp[1],-s*kp[0]+c*kp[2])
        o['feet'][sd]=f
    return o
def place(S,role_side,ball_xz,heading):
    """place stance-state S (authored at origin facing +Z) so that its `role_side` foot ball is at ball_xz and the body heads `heading` (rad, +left)"""
    b=S['feet'][role_side]['p'];x,z=xf_pt(b,heading,(0,0));T=(ball_xz[0]-x,ball_xz[1]-z)
    return xf_state(S,heading,T)
def ball_of(state,side):
    p=state['feet'][side]['p'];return (p[0],p[1]) if len(p)==2 else (p[0],p[2])
