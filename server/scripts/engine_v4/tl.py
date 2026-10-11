"""Timeline / state blending for procedural karate motion."""
from kmotion import *
import copy
def fk_ankle(desc):return get_rig().foot_resolve(desc)
def pole_blend(a,b,p,yaw):
    """interpolate knee poles as heading angle RELATIVE to the foot yaw (no zero-crossing when the foot turns by 180deg)"""
    def rel(x):
        kp=np.asarray(x.get('knee_pole',[np.sin(x['yaw']),0,np.cos(x['yaw'])]),float);kp=kp/max(np.linalg.norm(kp),1e-9)
        return np.arctan2(kp[0],kp[2])-x['yaw'],kp[1]/max(np.hypot(kp[0],kp[2]),1e-6)
    ra,ya=rel(a);rb,yb=rel(b);dr=(rb-ra+np.pi)%(2*np.pi)-np.pi
    r=ra+dr*p;yy=ya+(yb-ya)*p;ang=yaw+r
    return tuple(unit(np.array([np.sin(ang),yy,np.cos(ang)])))
def foot_blend(a,b,p,lift=0.0,lift_peak=0.5):
    if a is b or p<=0:return a
    if p>=1 and lift==0:return b
    if a['mode']==b['mode'] and a['mode']!='air' and lift==0:
        d=dict(mode=a['mode'],p=tuple(lerpv(a['p'],b['p'],p)),yaw=lerp(a['yaw'],b['yaw'],p),pitch=lerp(a.get('pitch',0),b.get('pitch',0),p),roll=lerp(a.get('roll',0),b.get('roll',0),p))
        if 'knee_pole' in a or 'knee_pole' in b:d['knee_pole']=pole_blend(a,b,p,d['yaw'])
        return d
    Aa,_,_=fk_ankle(a);Ab,_,_=fk_ankle(b)
    pos=lerpv(Aa,Ab,p)
    if lift: # asymmetric arc : peak at lift_peak
        x=p/lift_peak if p<lift_peak else (1-p)/(1-lift_peak)
        pos=pos+np.array([0,lift*np.sin(np.pi/2*np.clip(x,0,1)),0])
    d=dict(mode='air',p=tuple(pos),yaw=lerp(a['yaw'],b['yaw'],p),pitch=lerp(a.get('pitch',0),b.get('pitch',0),p),roll=lerp(a.get('roll',0),b.get('roll',0),p))
    if 'knee_pole' in a or 'knee_pole' in b:d['knee_pole']=pole_blend(a,b,p,d['yaw'])
    return d
def new_state(**kw):
    S=dict(H=np.zeros(3),yaw=0.0,pitch=0.0,roll=0.0,chest=(0,0,0),feet={},arm={},clav={'L':(0,0),'R':(0,0)},fist={'L':0.0,'R':0.0},look=0.0,aim=0.0,knee_bias={'L':0.0,'R':0.0})
    S.update(kw);return S
def state_from_stance(St,arms,fist=(1,1),chest=(0,0,0),look=0.0,aim=0.0,clav=None,yaw=None):
    S=new_state(H=St['H'].copy(),yaw=St['yaw'] if yaw is None else yaw,pitch=St['pitch'],chest=chest,feet={k:dict(v) for k,v in St['feet'].items()},arm=dict(arms),fist={'L':fist[0],'R':fist[1]},look=look,aim=aim)
    if clav:S['clav']=clav
    return S
GROUPS=['H','pel','chest','footL','footR','armL','armR','clav','look','fist','aim']
class Timeline:
    def __init__(s,name='clip'):
        s.keys=[];s.name=name;s.meta={}
    def key(s,t,state,ease=None,delay=None,lift=None,lift_peak=None):
        """segment *ending* at this key is shaped by ease/delay/lift ; ease: dict group->fn or fn ; delay: dict group->(d0,d1) fractions"""
        s.keys.append(dict(t=t,S=state,ease=ease or {},delay=delay or {},lift=lift or {},lp=lift_peak or {}));return s
    @property
    def T(s):return s.keys[-1]['t']
    def state(s,t):
        K=s.keys
        if t<=K[0]['t']:return K[0]['S']
        if t>=K[-1]['t']:return K[-1]['S']
        i=next(i for i in range(1,len(K)) if t<=K[i]['t']);a=K[i-1];b=K[i]
        x=(t-a['t'])/(b['t']-a['t'])
        def pg(g):
            ez=b['ease'];e=ez.get(g,ez.get('all',e_io));d0,d1=b['delay'].get(g,b['delay'].get('all',(0.0,1.0)))
            return e(seg(x,d0,d1)) if callable(e) else e
        return blend(a['S'],b['S'],pg,b['lift'],b['lp'])
    def P(s,t):return to_P(s.state(t))
def blend(A,B,pg,lift,lp):
    S=new_state()
    pH=pg('H');S['H']=lerpv(A['H'],B['H'],pH)
    pp=pg('pel')
    for k in('yaw','pitch','roll'):S[k]=lerp(A[k],B[k],pp)
    S['chest']=tuple(lerpv(A['chest'],B['chest'],pg('chest')))
    for sd in 'LR':
        S['feet'][sd]=foot_blend(A['feet'][sd],B['feet'][sd],pg('foot'+sd),lift.get(sd,0.0),lp.get(sd,0.5))
        S['clav'][sd]=tuple(lerpv(A['clav'][sd],B['clav'][sd],pg('clav')))
        S['fist'][sd]=lerp(A['fist'][sd],B['fist'][sd],pg('fist'))
        a=A['arm'].get(sd);b=B['arm'].get(sd);p=pg('arm'+sd)
        if a is None and b is None:continue
        if a is not None and b is not None and a is not b and str(a)==str(b):a=b=arm_final(a)   # identical (held) specs -> stay at the final pose
        if a is b or p<=0:S['arm'][sd]=a
        elif p>=1:S['arm'][sd]=b
        else:S['arm'][sd]=('pair',a,b,p)
        S['knee_bias'][sd]=lerp(A['knee_bias'][sd],B['knee_bias'][sd],pp)
    S['look']=lerp(A['look'],B['look'],pg('look'));S['aim']=lerp(A['aim'],B['aim'],pg('aim'))
    return S
def arm_final(spec):
    return spec['specs'][-1] if isinstance(spec,dict) and spec.get('kind')=='path' else spec
def arm_path(*specs,knots=None):
    n=len(specs);knots=knots or list(np.linspace(0,1,n+1)[1:])
    return dict(kind='path',specs=list(specs),knots=list(knots))
def arm_callable(spec):
    if spec is None:return None
    if isinstance(spec,tuple) and spec[0]=='pair':
        _,a,b,p=spec;a=arm_final(a)
        seq=[a]+(b['specs'] if b.get('kind')=='path' else [b]);kn=[0.0]+(b['knots'] if b.get('kind')=='path' else [1.0])
        for i in range(len(seq)-1):
            if p<=kn[i+1] or i==len(seq)-2:
                loc=clamp01((p-kn[i])/(kn[i+1]-kn[i]));return arm_fn((seq[i],1-loc),(seq[i+1],loc))
    return arm_fn((arm_final(spec),1))
def to_P(S):
    P=dict(pelvis=S['H'].copy(),pelvis_ypr=(S['yaw'],S['pitch'],S['roll']),chest_ypr=S['chest'],foot={k:dict(v) for k,v in S['feet'].items()},
           look_yaw=S['look'],aim_yaw=S['aim'],clav=S['clav'],fist=S['fist'],knee_bias={k:v/D2R for k,v in S['knee_bias'].items()})
    P['arm']={sd:arm_callable(S['arm'].get(sd)) for sd in 'LR' if S['arm'].get(sd) is not None}
    return P
