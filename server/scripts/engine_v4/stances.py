"""Stance library (feet + pelvis), authored in an anchor frame: origin on floor, +Z forward, +X = character's left."""
import numpy as np
from rig import *
rig=None
def get_rig():
    global rig
    if rig is None:rig=Rig()
    return rig
def hip_pos(Hxz,Hy,yaw,side,pitch=0):
    return np.array([Hxz[0],Hy,Hxz[1]])+Ry(yaw)@np.array([0.105 if side=='L' else -0.105,0,0])
def solve_height(feet,Hxz,yaw,leg,frac):
    """pelvis height so that the `leg` runs at `frac` of full extension (frac<1 = bent knee)."""
    r=get_rig();Lmax=r.L_thigh+r.L_shin;A,_,_=r.foot_resolve(feet[leg])
    off=np.array([0.105 if leg=='L' else -0.105,0,0]);off=Ry(yaw)@off
    hx=Hxz[0]+off[0];hz=Hxz[1]+off[2]
    dh2=(A[0]-hx)**2+(A[2]-hz)**2;d=frac*Lmax
    dy=np.sqrt(max(d*d-dh2,1e-6))
    return A[1]+dy
def flat(x,z,yaw=0):
    """flat foot given by ANKLE xz; stored ball-anchored (pitch 0) so pivots are exact"""
    y=yaw*D2R;return dict(mode='ball',p=(x+0.082*np.sin(y),z+0.082*np.cos(y)),yaw=y,pitch=0.0)
def bl(bx,bz,yaw=0):return dict(mode='ball',p=(bx,bz),yaw=yaw*D2R,pitch=0.0)
def make(feet,Hxz,yaw_deg,leg=None,frac=None,Hy=None,pitch=0):
    yaw=yaw_deg*D2R
    if Hy is None:Hy=solve_height(feet,Hxz,yaw,leg,frac)
    return dict(feet={k:dict(v) for k,v in feet.items()},H=np.array([Hxz[0],Hy,Hxz[1]]),yaw=yaw,pitch=pitch*D2R)
def mirror(S):
    """mirror a stance across the sagittal plane (L<->R)"""
    out=dict(S);out['feet']={}
    for sd,o in (('L','R'),('R','L')):
        f=dict(S['feet'][sd]);
        f['p']=(-f['p'][0],)+tuple(f['p'][1:])
        f['yaw']=-f['yaw']
        if 'knee_pole' in f:kp=f['knee_pole'];f['knee_pole']=(-kp[0],)+tuple(kp[1:])
        out['feet'][o]=f
    out['H']=np.array([-S['H'][0],S['H'][1],S['H'][2]]);out['yaw']=-S['yaw'];return out

def stance(name,lead='L'):
    """returns stance dict. lead = side that is forward (zenkutsu/kokutsu/fudo)"""
    if name=='shizentai':
        S=make({'L':flat(0.15,0,12),'R':flat(-0.15,0,-12)},(0,0),0,'L',0.9995)
        S['H'][1]=solve_height(S['feet'],(0,0),0,'L',0.985)
    elif name=='heiko':
        S=make({'L':flat(0.16,0,0),'R':flat(-0.16,0,0)},(0,0),0,'L',0.985)
    elif name=='zenkutsu':
        S=make({'L':bl(0.14,0.542,0),'R':bl(-0.14,-0.358,-22)},(0,0.04),0,'R',0.985)
        if lead=='R':S=mirror(S)
    elif name=='kokutsu':
        S=make({'L':flat(0.06,0.36,0),'R':flat(-0.07,-0.30,-90)},(-0.03,-0.11),-42,'R',0.80)
        if lead=='R':S=mirror(S)
    elif name=='kiba':
        S=make({'L':flat(0.34,0,0),'R':flat(-0.34,0,0)},(0,0),0,'L',0.72)
        S['feet']['L']['knee_pole']=(0.5,0,0.866);S['feet']['R']['knee_pole']=(-0.5,0,0.866)
    elif name=='heisoku':
        S=make({'L':flat(0.055,0,0),'R':flat(-0.055,0,0)},(0,0),0,'L',0.9995);S['H'][1]=solve_height(S['feet'],(0,0),0,'L',0.985)
    elif name=='musubi':
        S=make({'L':flat(0.08,0,22),'R':flat(-0.08,0,-22)},(0,0),0,'L',0.9995);S['H'][1]=solve_height(S['feet'],(0,0),0,'L',0.985)
    elif name=='hachiji':
        S=make({'L':flat(0.20,0,8),'R':flat(-0.20,0,-8)},(0,0),0,'L',0.9995);S['H'][1]=solve_height(S['feet'],(0,0),0,'L',0.985)
    elif name=='uchi_hachiji':
        S=make({'L':flat(0.20,0,-14),'R':flat(-0.20,0,14)},(0,0),0,'L',0.9995);S['H'][1]=solve_height(S['feet'],(0,0),0,'L',0.97)
    elif name=='renoji':
        S=make({'L':flat(0.10,0.04,0),'R':flat(-0.12,-0.02,-70)},(0,0),0,'L',0.97)
        if lead=='R':S=mirror(S)
    elif name=='neko':
        # cat stance : ~90% weight on the rear leg, front heel raised, rear foot 45deg out, deep rear knee
        S=make({'L':dict(mode='ball',p=(0.05,0.30),yaw=0.0,pitch=-38*D2R),'R':flat(-0.10,-0.08,-45)},(-0.03,-0.04),-30,'R',0.78)
        S['feet']['R']['knee_pole']=(-0.55,0,0.83)
        if lead=='R':S=mirror(S)
    elif name=='kosa':
        # cross stance : front foot flat, rear foot behind it on the ball, rear knee tucked behind the front knee
        S=make({'L':flat(-0.02,0.10,0),'R':dict(mode='ball',p=(0.07,-0.18),yaw=-25*D2R,pitch=-35*D2R)},(0.02,-0.02),0,'L',0.80)
        S['feet']['L']['knee_pole']=(0,0,1);S['feet']['R']['knee_pole']=(0.25,0,1)
        if lead=='R':S=mirror(S)
    elif name=='hangetsu':
        # half-moon : toes turned inward, wide, knees squeezed, lead foot a shoulder-width ahead
        S=make({'L':flat(0.17,0.20,-30),'R':flat(-0.17,-0.16,30)},(0,0.02),0,'R',0.86)
        S['feet']['L']['knee_pole']=(-0.40,0,0.92);S['feet']['R']['knee_pole']=(0.40,0,0.92)
        if lead=='R':S=mirror(S)
    elif name=='sanchin':
        S=make({'L':flat(0.14,0.13,-35),'R':flat(-0.14,-0.07,35)},(0,0.0),0,'R',0.90)
        S['feet']['L']['knee_pole']=(-0.45,0,0.89);S['feet']['R']['knee_pole']=(0.45,0,0.89)
        if lead=='R':S=mirror(S)
    elif name=='shiko':
        S=make({'L':flat(0.44,0,35),'R':flat(-0.44,0,-35)},(0,0),0,'L',0.66)
        S['feet']['L']['knee_pole']=(0.6,0,0.8);S['feet']['R']['knee_pole']=(-0.6,0,0.8)
    elif name=='moto':
        S=make({'L':bl(0.12,0.40,0),'R':bl(-0.12,-0.25,-22)},(0,0.03),0,'R',0.93)
        if lead=='R':S=mirror(S)
    elif name=='tsuru':
        S=make({'L':flat(0.06,0.0,0),'R':dict(mode='air',p=(0.10,0.52,-0.12),yaw=0.0,pitch=-0.6)},(0.0,0.0),0,'L',0.97)
        S['feet']['R']['knee_pole']=(0.0,0.0,1.0)
        if lead=='R':S=mirror(S)
    elif name=='fudo':
        S=make({'L':flat(0.15,0.34,0),'R':flat(-0.15,-0.34,-35)},(0,0),0,'R',0.86)
        if lead=='R':S=mirror(S)
    else:raise KeyError(name)
    S['name']=name;S['lead']=lead
    return S
def base_P(S,arms=None,fist=None,chest=(0,0,0)):
    P=dict(pelvis=S['H'].copy(),pelvis_ypr=(S['yaw'],S['pitch'],0),chest_ypr=chest,foot={k:dict(v) for k,v in S['feet'].items()})
    if arms:P['arm']=arms
    if fist:P['fist']=fist
    return P
