"""Generic kicks from zenkutsu (rear leg kicks, front leg supports).  kinds: mawashi, yoko_keage, yoko_kekomi, ushiro, hiza, mae_keage"""
from library import *
def _rot(y):return Ry(y)
KINDS={
 # yawp: pelvis yaw sign*deg ; supyaw: support-foot pivot (deg*sign) ; chamber/ext: foot pos in pelvis frame relative to the kicker hip (side*x, y, z) ; roll deg*sign
 'mawashi':dict(yawp=-65,supyaw=-100,ch_knee=(0.34,0.12,0.40),ch_foot=(0.30,-0.22,0.02),ex_foot=(0.80,0.10,0.18),ex_pitch=0,ex_roll=0,lean=(0,0,-0.0),chest_yaw=18),
 'yoko_kekomi':dict(yawp=-10,supyaw=-35,ch_knee=(0.12,0.12,0.45),ch_foot=(0.10,-0.12,0.15),ex_foot=(0.78,0.02,-0.02),ex_pitch=0,ex_roll=-90,lean=(0,0,0),chest_yaw=0),
 'yoko_keage':dict(yawp=-10,supyaw=-35,ch_knee=(0.12,0.12,0.45),ch_foot=(0.10,-0.12,0.15),ex_foot=(0.70,0.30,-0.02),ex_pitch=0,ex_roll=-70,lean=(0,0,0),chest_yaw=0),
 'ushiro':dict(yawp=140,supyaw=-140,ch_knee=(0.0,0.12,0.40),ch_foot=(0.05,-0.20,0.15),ex_foot=(0.10,0.0,-0.76),ex_pitch=-40,ex_roll=0,lean=(0,0,0),chest_yaw=0),
 'mae_geri':dict(yawp=0,supyaw=0,ch_knee=(0.0,0.10,0.42),ch_foot=(0.0,-0.28,0.16),ex_foot=(0.0,-0.08,0.70),ex_pitch=60,ex_roll=0,lean=(0,0,0),chest_yaw=0),
 'mikazuki':dict(yawp=-10,supyaw=-20,ch_knee=(0.0,0.10,0.42),ch_foot=(0.0,-0.28,0.16),ex_foot=(-0.22,0.05,0.62),ex_pitch=20,ex_roll=35,lean=(0,0,0),chest_yaw=0),
 'yoko_fumikomi':dict(yawp=-10,supyaw=-35,ch_knee=(0.12,0.12,0.45),ch_foot=(0.10,-0.12,0.15),ex_foot=(0.74,-0.30,-0.02),ex_pitch=0,ex_roll=-90,lean=(0,0,0),chest_yaw=0),
 'nami_gaeshi':dict(yawp=0,supyaw=0,ch_knee=(0.0,0.10,0.42),ch_foot=(0.0,-0.28,0.16),ex_foot=(-0.12,-0.20,0.30),ex_pitch=10,ex_roll=-30,lean=(0,0,0),chest_yaw=0),
 'hiza':dict(yawp=0,supyaw=0,ch_knee=(0.04,0.20,0.40),ch_foot=(0.06,-0.30,0.30),ex_foot=(0.06,-0.20,0.50),ex_pitch=-30,ex_roll=0,lean=(0,0,0),chest_yaw=0),
 'mae_keage':dict(yawp=0,supyaw=0,ch_knee=(0.0,0.10,0.42),ch_foot=(0.0,-0.25,0.18),ex_foot=(0.0,0.0,0.68),ex_pitch=30,ex_roll=0,lean=(0,0,0),chest_yaw=0),
}
def kick_states2(kind,sd):
    k=KINDS[kind];o=OPP[sd];s=sgn(sd);so=sgn(o)
    S0=S_zen(o,GUARD());sup=S0['feet'][o];sbx,sbz=sup['p']
    yawp=np.radians(k['yawp'])*s if kind!='ushiro' else np.radians(k['yawp'])*-s
    S1=copy.deepcopy(S0);S1['yaw']=yawp
    off=Ry(yawp)@np.array([so*0.105,0,0])
    S1['H']=np.array([sbx-off[0],0.85,sbz-off[2]-0.03*np.cos(yawp)])
    sf=dict(S0['feet'][o]);sf['yaw']=sup['yaw']+np.radians(k['supyaw'])*s;S1['feet'][o]=sf
    if abs(k['supyaw'])>1:
        sf['pitch']=0.0
    hip=lambda S:S['H']+Ry(S['yaw'])@np.array([s*0.105,0,0])
    def foot(S,loc,pitch,roll,pole=None):
        h=hip(S);Rl=Ry(S['yaw']);v=np.array([s*loc[0] if kind!='ushiro' else loc[0],loc[1],loc[2]]);A=h+Rl@v
        A[1]=max(A[1]+loc[1]*0,0.08) if False else A[1]
        return air(A,S['yaw'],np.radians(pitch),pole=pole)
    # pelvis-frame hip height is S['H'][1] ; loc y is relative to hip
    def mk(S,loc,pitch,roll,pole):
        d=foot(S,loc,pitch,roll,pole);d['roll']=np.radians(roll)*s;return d
    S1['feet'][sd]=air((hip(S1)[0],0.20,hip(S1)[2]-0.25),yawp,0.3)
    S1['chest']=(np.radians(k['chest_yaw'])*s,0,0)
    S2=copy.deepcopy(S1)
    kn=np.array([s*k['ch_knee'][0],k['ch_knee'][1],k['ch_knee'][2]])
    S2['feet'][sd]=mk(S2,k['ch_foot'],35,0,(0.3*s if kind!='ushiro' else 0,0.4,1.0))
    S3=copy.deepcopy(S1);S3['H']=S1['H']+Ry(yawp)@np.array([0,0.0,0.02])
    S3['feet'][sd]=mk(S3,k['ex_foot'],k['ex_pitch'],k['ex_roll'],(0.0,0.2,1.0) if kind!='ushiro' else (0,0.2,-1))
    if kind.startswith('yoko'):S3['chest']=(0,0,np.radians(18)*s*-1)
    return S0,S1,S2,S3,copy.deepcopy(S2)
def kick_clip2(kind,sd):
    S0,S1,S2,S3,S4=kick_states2(kind,sd);E={'all':e_io};nm='left' if sd=='L' else 'right'
    tl=Timeline(f'{kind}_geri_{nm}');tl.key(0,S0);tl.key(0.1,copy.deepcopy(S0))
    tl.key(0.45,S1,ease=E);tl.key(0.80,S2,ease=E);tl.key(0.93,S3,ease={'all':e_snap});tl.key(1.01,copy.deepcopy(S3))
    tl.key(1.27,S4,ease=E);tl.key(1.62,S1,ease=E);tl.key(2.1,S0,ease=E);tl.key(2.3,copy.deepcopy(S0));return tl
def lib_kicks2():
    out={}
    for kd in KINDS:
        for sd in 'LR':
            t=kick_clip2(kd,sd);out[t.name]=t
    return out
