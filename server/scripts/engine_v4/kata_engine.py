"""Data-driven kata builder.  A kata = list of Move records; each is built from reusable primitives (step_into / strike_in_place / kicks / jumps)."""
from jumps import *
import tech2 as T2
import tech3 as T3
from tech2 import _A
def _zuki(side,level='chudan'):
    o=OPP[side];s=sgn(side)
    fin={'chudan':a_punch(side),'jodan':a_punch_jodan(side),'gedan':a_punch(side,drop=0.40,inward=0.03,reach=0.62)}[level]
    return dict(tag='zuki_'+level,final={side:fin,o:a_hikite(o)},path={side:None},prep={side:a_hikite(side),o:a_hikite(o)},fist=(1,1))
def _tettsui(side):
    o=OPP[side];return dict(tag='tettsui',final={side:a_tettsui(side),o:a_hikite(o)},path={side:arm_path(a_tettsui_prep(side),a_tettsui(side),knots=[0.5,1.0])},prep={side:a_tettsui_prep(side),o:a_hikite(o)},fist=(1,1))
def _hikite(side):
    o=OPP[side];return dict(tag='hikite',final={side:a_hikite(side),o:a_hikite(o)},path={},prep={},fist=(1,1))
def _guard(side):return dict(tag='guard',final={'L':a_guard('L'),'R':a_guard('R')},path={},prep={},fist=(1,1))
BASIC={'zuki':lambda s,**k:_zuki(s,'chudan'),'oi_zuki':lambda s,**k:_zuki(s,'chudan'),'gyaku_zuki':lambda s,**k:_zuki(s,'chudan'),'jodan_zuki':lambda s,**k:_zuki(s,'jodan'),
 'gedan_zuki':lambda s,**k:_zuki(s,'gedan'),'tettsui':lambda s,**k:_tettsui(s),'hikite':lambda s,**k:_hikite(s),'guard':lambda s,**k:_guard(s),
 'kizami_zuki':lambda s,**k:_zuki(s,'chudan')}
def tech(name,side,**kw):
    if name in BASIC:return BASIC[name](side,**kw)
    if name in T3.EXTRA:return T3.EXTRA[name](side,**kw)
    return T2.TECH[name](side,**kw)
# ------------------------------------------------------------------ move record
def M(turn=0,stance=None,lead=None,t=(),mode=None,kiai=False,kick=None,jump=None,dur=None,note='',support=None):
    """turn: heading change in degrees (+left) applied BEFORE the move ; t: ['L:gedan_barai', 'R:zuki:level=jodan', ...]"""
    return dict(turn=turn,stance=stance,lead=lead,t=list(t),mode=mode,kiai=kiai,kick=kick,jump=jump,dur=dur,note=note,support=support)
def parse_t(spec):
    parts=spec.split(':');side=parts[0];name=parts[1];kw={}
    for p in parts[2:]:
        k,v=p.split('=');kw[k]=v
    return side,name,kw
def arms_of(tlist):
    """-> arms_final,arms_prep,paths,fist,strike"""
    fin={};pre={};path={};fist=[None,None];strike=None
    for sp in tlist:
        sd,nm,kw=parse_t(sp);d=tech(nm,sd,**kw)
        if strike is None:strike=sd
        for k,v in d['final'].items():
            if k not in fin or k==sd:fin[k]=v
        for k,v in d['prep'].items():pre.setdefault(k,v) if k!=sd else pre.__setitem__(k,v)
        for k,v in d['path'].items():
            if v is not None:path[k]=v
        for i,k in enumerate('LR'):
            if k in d['final'] and (k==sd or fist[i] is None):fist[i]=d['fist'][i]
    for sd in 'LR':
        if sd not in fin:fin[sd]=a_hikite(sd)
    fist=tuple(1 if f is None else f for f in fist)
    return fin,pre,path,fist,strike
def build_kata(name,moves,start_stance='heisoku',yoi_hold=1.2):
    S0=canon(start_stance,'L',{'L':a_yoi('L'),'R':a_yoi('R')})
    seq=Seq(S0,name);seq.hold(yoi_hold);h=0.0;ev=[];prev_kick=None
    for n,m in enumerate(moves,1):
        h+=np.radians(m['turn']);cur=seq.cur
        fin,pre,path,fist,strike=arms_of(m['t']) if m['t'] else ({'L':a_hikite('L'),'R':a_hikite('R')},{},{},(1,1),None)
        t0=seq.t;st=m['stance'];ld=m['lead']
        if m['kick']:
            kind,ks=m['kick'].split(':');nx=moves[n] if n<len(moves) else None;land=not(nx and nx['stance'] and nx['mode']!='inplace' and not nx['kick'] and not nx['jump']);do_kick(seq,kind,ks,h,m['dur'] or 1.5,land=land);prev_kick=None if land else ks
        elif m['jump']:
            jump_seq(seq,m,h,fin,fist,strike,pre,path);prev_kick=None
        else:
            mode=m['mode'] or ('turn' if abs(m['turn'])>1 else 'fwd')
            same=(st==cur.get('name_',None) or False)
            if mode=='inplace':
                inplace(seq,strike,fin,pre,path,fist,h)
            else:
                support=OPP[ld] if mode in('fwd','turn') else ld
                if prev_kick is not None:support=OPP[prev_kick]
                if m['support']:support=m['support']
                arms_f=dict(fin)
                for k,v in path.items():arms_f[k]=v
                tsign=int(np.sign(m['turn'])) if m['turn'] else 0
                big=abs(m['turn'])>100
                dur=m['dur'] or ((1.05 if big else 0.9) if st in('kokutsu',) else (1.0 if big else 0.8))
                step_into(seq,st,ld,h,support,arms_f,strike=strike,arms_prep={k:v for k,v in pre.items()},turn_sign=tsign,dur=dur,prep_t=0.30 if st=='kokutsu' else 0.24,fist=fist)
            prev_kick=None
        seq.cur['name_']=st or seq.cur.get('name_')
        if ld:seq.cur['lead_']=ld
        ev.append((n,m['t'],m['kick'] or m['jump'] or st,round(t0,2),round(seq.t,2),m['kiai']))
        if m['kiai']:seq.hold(0.25)
    return seq,ev
def inplace(seq,strike,fin,pre,path,fist,h):
    cur=seq.cur;o=OPP[strike];s=sgn(strike)
    lead=seq.cur.get('lead_')
    # strike_in_place : hip yaw relative to the current stance yaw
    base=cur['yaw']
    same=(lead==strike)
    dp=(-30*D2R*s) if same else (+35*D2R*s)
    df=0.0 if same else (-6*D2R*s)
    if cur.get('name_') in ('kiba','heisoku','heiko','musubi','shiko'):dp=-8*D2R*s;df=3*D2R*s
    strike_in_place(seq,strike,fin[strike],fin[o],yaw_prep=base+dp,yaw_final=base+df,arm_path_=path.get(strike),dur=0.68,prep_t=0.30,other_prep=pre.get(o),fist=fist)
def do_kick(seq,kind,sd,h,dur,land=False):
    k=KINDS[kind];o=OPP[sd];s=sgn(sd);so=sgn(o);cur=seq.cur;orig=copy.deepcopy(cur)
    sbx,sbz=ball_of(cur,o)
    side_k=kind.startswith('yoko')
    hb=h-s*np.pi/2 if side_k else h
    yawp=hb+(np.radians(k['yawp'])*s if kind!='ushiro' else np.radians(k['yawp'])*-s)
    S1=copy.deepcopy(cur);S1['yaw']=yawp
    off=Ry(yawp)@np.array([so*0.105,0,0]);fwd=Ry(h)@np.array([0,0,-0.03])
    S1['H']=np.array([sbx-off[0]+fwd[0],0.85,sbz-off[2]+fwd[2]])
    sf=dict(cur['feet'][o]);sf['yaw']=cur['feet'][o]['yaw']+np.radians(k['supyaw'])*s+(hb-h);S1['feet'][o]=sf
    hip=lambda S:S['H']+Ry(S['yaw'])@np.array([s*0.105,0,0])
    def mk(S,loc,pitch,roll,pole):
        v=np.array([s*loc[0] if kind!='ushiro' else loc[0],loc[1],loc[2]]);A_=hip(S)+Ry(S['yaw'])@v
        d=air(A_,S['yaw'],np.radians(pitch),pole=Ry(S['yaw'])@np.asarray(pole,float));d['roll']=np.radians(roll)*s;return d
    hp=hip(S1);S1['feet'][sd]=air((hp[0],0.20,hp[2])+Ry(yawp)@np.array([0,0,-0.25]) if False else tuple(np.array([hp[0],0.20,hp[2]])+Ry(yawp)@np.array([0,0,-0.25])),yawp,0.3)
    S1['chest']=(np.radians(k['chest_yaw'])*s,0,0);S1['aim']=hb
    S2=copy.deepcopy(S1);S2['feet'][sd]=mk(S2,k['ch_foot'],35,0,(0.3*s if kind!='ushiro' else 0,0.4,1.0))
    S3=copy.deepcopy(S1);S3['H']=S1['H']+Ry(yawp)@np.array([0,0,0.02])
    S3['feet'][sd]=mk(S3,k['ex_foot'],k['ex_pitch'],k['ex_roll'],(0.0,0.2,1.0) if kind!='ushiro' else (0,0.2,-1))
    if kind.startswith('yoko'):S3['chest']=(0,0,np.radians(18)*-s)
    E={'all':e_io}
    seq.goto(0.38,S1,ease=E);seq.goto(0.30,S2,ease=E);seq.goto(0.17,S3,ease={'all':e_snap});seq.hold(0.06)
    seq.goto(0.26,copy.deepcopy(S2),ease=E)
    if land:seq.goto(0.45,orig,ease=E);seq.hold(0.1)
def jump_seq(seq,m,h,fin,fist,strike,pre,path):
    cur=seq.cur;st=m['stance'];ld=m['lead'];o=OPP[ld];dy=h-cur['yaw']
    arms_f=dict(fin)
    S5=stance_state(st,ld,arms_f,support=(o,ball_of(cur,o)),heading=h,fist=fist)
    jp=str(m['jump']).split(':');hgt=float(jp[1]) if len(jp)>1 else 0.30;dz=float(jp[2]) if len(jp)>2 else 0.0;ksd=jp[3] if len(jp)>3 else None
    if dz:
        d=Ry(h)@np.array([0,0,dz]);S5['H']=S5['H']+d
        for sd_ in 'LR':
            f=S5['feet'][sd_];f['p']=(f['p'][0]+d[0],f['p'][1]+d[2]) if len(f['p'])==2 else tuple(np.asarray(f['p'])+d)
    hx=lambda S,sd:S['H']+Ry(S['yaw'])@np.array([sgn(sd)*0.11,0,0])
    S1=copy.deepcopy(cur);S1['H']=cur['H']+np.array([0,-0.14,0]);S1['chest']=(0,np.radians(8),0)
    S2=copy.deepcopy(cur);S2['H']=cur['H']+np.array([0,0.22,0]);S2['yaw']=cur['yaw']+dy*0.12
    for sd in 'LR':hh=hx(S2,sd);S2['feet'][sd]=air((hh[0],0.12,hh[2]-0.04),S2['yaw'],np.radians(-55),pole=(0,0.1,1))
    S3=copy.deepcopy(S2);S3['H']=0.5*(cur['H']+S5['H'])+np.array([0,hgt,0]);S3['aim']=S3['yaw'];S3['yaw']=cur['yaw']+dy*0.6
    for sd in 'LR':hh=hx(S3,sd);S3['feet'][sd]=air((hh[0],hh[1]-0.46,hh[2]-0.10),S3['yaw'],np.radians(-35),pole=Ry(S3['yaw'])@np.array([0,0.3,1]))
    if ksd:
        hh=hx(S3,ksd);S3['feet'][ksd]=air(hh+Ry(S3['yaw'])@np.array([0,-0.12,0.72]),S3['yaw'],np.radians(55),pole=Ry(S3['yaw'])@np.array([0,0.2,1]))
    S4=copy.deepcopy(S3);S4['yaw']=S5['yaw'];S4['H']=S5['H']+np.array([0,0.10,0])
    for sd in 'LR':hh=hx(S4,sd);S4['feet'][sd]=air((hh[0],0.10,hh[2]),S4['yaw'],np.radians(-15),pole=Ry(S4['yaw'])@np.array([0,0.1,1]))
    S5c=copy.deepcopy(S5);S5c['H']=S5['H']+np.array([0,-0.14,0])
    for sd_ in 'LR':
        S4['arm'][sd_]=arm_final(fin[sd_]);S5c['arm'][sd_]=arm_final(fin[sd_])
    for S_ in (S1,S2,S4,S5c):S_['aim']=S_['yaw']
    S3['aim']=S3['yaw'];S5['aim']=S5['yaw']
    E={'all':e_io};ta=0.50
    seq.goto(0.38,S1,ease=E);seq.goto(0.17,S2,ease={'all':e_snap});seq.goto(ta*0.45,S3,ease=E);seq.goto(ta*0.55,S4,ease=E)
    seq.goto(0.10,S5c,ease={'all':e_snap});seq.goto(0.35,S5,ease=E)
