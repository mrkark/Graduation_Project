"""Core helpers for procedural Shotokan motion: easing, arm presets (torso frame), pose assembly."""
import numpy as np
from rig import *
from stances import *
FPS=30
# ---------------- easing / phase helpers ----------------
def clamp01(x):return float(np.clip(x,0,1))
def seg(t,t0,t1):return clamp01((t-t0)/(t1-t0)) if t1>t0 else (1.0 if t>=t1 else 0.0)
def e_io(p):p=clamp01(p);return p*p*(3-2*p)                 # smoothstep
def e_in(p,k=2.0):p=clamp01(p);return p**k                  # accelerate
def e_out(p,k=2.0):p=clamp01(p);return 1-(1-p)**k           # decelerate
def e_snap(p):p=clamp01(p);return 1-(1-p)**3                # fast attack, very soft landing (kime)
def e_sin(p):return 0.5-0.5*np.cos(np.pi*clamp01(p))
def lerp(a,b,p):return a+(b-a)*p
def lerpv(a,b,p):return np.asarray(a,float)*(1-p)+np.asarray(b,float)*p
def lerp_ang(a,b,p):return a+(b-a)*p
# ---------------- torso-frame helpers ----------------
def tf(ctx,v,frame='torso'):
    """torso-frame vector -> world vector (yaw of chest only); frame='aim' uses the technique heading"""
    return Ry(ctx['chest_yaw'] if frame=='torso' else ctx['aim_yaw'])@np.asarray(v,float)
def tp(ctx,v):return ctx['Hpos']+tf(ctx,v)
def sgn(side):return 1.0 if side=='L' else -1.0
# ---------------- arm presets -----------------
# each returns a dict of vectors in TORSO frame:  c=fist point(center or knuckle), ax=axis hint, pole, palm, knuckle offset
def A(c,ax,pole,palm,knuckle=0.065,ref='hip',twist_fore=0.5,frame='torso'):
    import sys;sd=sys._getframe(1).f_locals.get('side','L')
    return dict(side=sd,c=np.asarray(c,float),ax=np.asarray(ax,float),pole=np.asarray(pole,float),palm=np.asarray(palm,float),knuckle=knuckle,ref=ref,twist_fore=twist_fore,frame=frame)
def a_hang(side):
    s=sgn(side);return A((0.215*s,0.01,0.03),(0,-1,0.1),(0,-0.2,-1),(-s,0,0),0.065)
def a_yoi(side):
    s=sgn(side);return A((0.10*s,0.07,0.22),(0.0,-0.35,1),(0.6*s,-0.7,-0.3),(0,-1,0.2),0.065)
def a_hikite(side):
    s=sgn(side);return A((0.185*s,0.135,0.045),(-0.12*s,-0.3,1),(0.25*s,-1,-0.35),(0,1,0),0.065)
def a_punch(side,drop=0.14,inward=0.05,reach=0.60):
    """chudan seiken-zuki final: ref=shoulder-relative contact point"""
    s=sgn(side);z=np.sqrt(max(reach**2-drop**2-inward**2,0.01))
    return A((-inward*s,-drop,z),(0,-0.05,1),(0.12*s,-1,-0.25),(0,-1,0),0.088,ref='shoulder',frame='aim')
def a_punch_jodan(side):return a_punch(side,drop=-0.01,inward=0.04,reach=0.60)
def a_gedan(side):
    s=sgn(side);v=np.array([0.0,-0.77,0.64]);return A(v*0.575+np.array([-0.02*s,0,0]),v,(0.55*s,0.45,-0.2),(0,-1,0),0.07,ref='shoulder',frame='aim')
def a_gedan_prep(side):
    """gedan-barai start: fist at opposite ear/shoulder, elbow in front"""
    s=sgn(side);return A((-0.12*s,0.37,0.20),(0.35*s,0.4,1),(0.1*s,-0.4,1),(-s*0.3,0.2,-1),0.065,ref='hip')
def a_age(side):
    s=sgn(side);return A((0.10*s,0.80,0.42),(0.35*s,1.0,0.3),(0.4*s,-0.7,0.2),(0.0,0.2,1.0),0.07,ref='hip')
def a_age_prep(side):
    s=sgn(side);return A((-0.12*s,0.22,0.30),(0.2*s,0.1,1),(0.5*s,-1,0.3),(0,0.5,-1),0.065)
def resolve_arm(spec,ctx):
    base=ctx['S'] if spec['ref']=='shoulder' else ctx['Hpos']
    fr=spec.get('frame','torso')
    return dict(fist_pt=base+tf(ctx,spec['c'],fr),axis=unit(tf(ctx,spec['ax'],fr)),pole=unit(tf(ctx,spec['pole'],fr)),palm=unit(tf(ctx,spec['palm'],fr)),knuckle=spec['knuckle'],twist_fore=spec.get('twist_fore',0.5),side=spec.get('side','L'))
def _rot_about(v,ax,ang):
    c,s_=np.cos(ang),np.sin(ang);return v*c+np.cross(ax,v)*s_+ax*np.dot(ax,v)*(1-c)
def blend_palm(a,b,p,ax,side):
    """rotate palm direction about the forearm axis (pronation/supination) instead of lerping vectors (no flip through zero)"""
    ax=unit(ax);pa=a-np.dot(a,ax)*ax;pb=b-np.dot(b,ax)*ax
    if np.linalg.norm(pa)<1e-6 or np.linalg.norm(pb)<1e-6:return unit(lerpv(a,b,p))
    ang=np.arctan2(np.dot(np.cross(pa,pb),ax),np.dot(pa,pb))
    if abs(ang)>150*np.pi/180:      # ambiguous half-turn : go through the medial direction (anatomical pronation/supination)
        lat=unit(np.cross(np.array([0,1.0,0]),ax)) if abs(ax[1])<0.95 else np.array([1.0,0,0])
        med=-(1.0 if side=='L' else -1.0)*lat
        best=None
        for sg in(1,-1):
            mid=_rot_about(unit(pa),ax,sg*np.pi/2)
            sc=np.dot(mid,med)
            if best is None or sc>best[0]:best=(sc,sg)
        ang=best[1]*np.pi
    pr=_rot_about(pa,ax,ang*p);ax_c=lerp(np.dot(a,ax),np.dot(b,ax),p)
    mag=lerp(np.linalg.norm(pa),np.linalg.norm(pb),p)
    return unit(unit(pr)*mag+ax_c*ax)
def blend_resolved(a,b,p):
    axv=unit(lerpv(a['axis'],b['axis'],p));side=a.get('side','L')
    return dict(fist_pt=lerpv(a['fist_pt'],b['fist_pt'],p),axis=axv,pole=unit(lerpv(a['pole'],b['pole'],p)),
                palm=blend_palm(a['palm'],b['palm'],p,axv,side),knuckle=lerp(a['knuckle'],b['knuckle'],p),twist_fore=lerp(a['twist_fore'],b['twist_fore'],p),side=side)
def arm_fn(*keys):
    """keys: list of (spec, weight)  -> weighted blend of several specs (weights sum to 1). Returns callable(ctx)."""
    def f(ctx):
        out=None;wsum=0
        for sp,w in keys:
            if w<=1e-9:continue
            r=resolve_arm(sp,ctx)
            if out is None:out=r;wsum=w
            else:
                wsum+=w;out=blend_resolved(out,r,w/wsum)
        return out
    return f
def arm_pair(a,b,p):return arm_fn((a,1-p),(b,p))

# ---- more arm presets ----
def a_guard(side):
    s=sgn(side);return A((0.13*s,0.37,0.27),(0.1*s,0.5,1),(0.6*s,-1,-0.3),(0,0.2,-1),0.065)
def a_tettsui_prep(side):
    s=sgn(side);return A((0.10*s,0.78,0.10),(0,1.0,0.35),(1.0*s,-0.1,0.4),(-s,0,0.4),0.07)
def a_tettsui(side):
    s=sgn(side);return A((0.07*s,0.24,0.38),(0.0,-0.15,1),(0.45*s,-1,-0.3),(-s,0,0.0),0.07)
def a_shuto_final(side):
    s=sgn(side);return A((0.30*s,0.50,0.30),(0.2*s,0.3,1),(0.4*s,-1,-0.2),(-s*0.3,1,0.2),0.10)
def a_shuto_prep(side):
    s=sgn(side);return A((0.0*s,0.74,0.16),(0.2*s,-0.4,1),(0.3*s,-1,0.35),(-s*0.2,1,0),0.08)
def a_shuto_support(side):
    s=sgn(side);return A((0.08*s,0.28,0.30),(0.5*s,0.1,1),(0.6*s,-1,-0.2),(0,1,0),0.10)

def a_soto_prep(side):
    """soto-uke start : fist near the opposite ear/shoulder, forearm across the chest, elbow low in front"""
    s=sgn(side);return A((-0.10*s,0.50,0.22),(-0.55*s,0.55,0.55),(0.15*s,-1,0.45),(0.2*s,-0.3,-1),0.065,ref='hip')
def a_soto_mid(side):
    s=sgn(side);return A((0.04*s,0.50,0.34),(0.0,0.9,0.3),(0.15*s,-1,0.3),(-s*0.8,0.0,-0.5),0.065,ref='hip')
def a_soto_final(side):
    """soto-uke end : fist at shoulder height outside the shoulder line, forearm ~vertical, elbow ~90-100 deg and low"""
    s=sgn(side);return A((0.27*s,0.52,0.36),(0.12*s,1.0,0.15),(0.05*s,-1,0.35),(-s*0.9,0.2,-0.3),0.065,ref='hip')
