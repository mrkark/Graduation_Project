from moves import *
D=np.pi/180
def yoi_state():
    S=state_from_stance(stance('shizentai'),{'L':a_yoi('L'),'R':a_yoi('R')},fist=(1,1))
    return S
def build_heian(verbose=False):
    seq=Seq(yoi_state(),'heian_shodan_preview');ev=[]
    seq.hold(1.2)                       # rei / yoi
    h=0.0                               # heading (rad, +left)
    def mark(n,name):ev.append((n,name,round(seq.t,3)))
    gedan=lambda sd:{sd:a_gedan(sd),OPP[sd]:a_hikite(OPP[sd])}
    oi=lambda sd:{sd:a_punch(sd),OPP[sd]:a_hikite(OPP[sd])}
    def lead_support(sd):return OPP[sd]
    # 1 hidari gedan-barai: turn left 90, step L
    h+=90*D;step_into(seq,'zenkutsu','L',h,'R',gedan('L'),strike='L',arms_prep={'L':a_gedan_prep('L')},turn_sign=1,dur=0.80,prep_t=0.30);mark(1,'L gedan-barai')
    # 2 migi oi-zuki
    step_into(seq,'zenkutsu','R',h,'L',oi('R'),strike='R');mark(2,'R oi-zuki')
    # 3 turn right 180, R gedan-barai (pivot on L, R swings)
    h-=180*D;step_into(seq,'zenkutsu','R',h,'L',gedan('R'),strike='R',arms_prep={'R':a_gedan_prep('R')},turn_sign=-1,dur=0.95,prep_t=0.30);mark(3,'R gedan-barai turn180')
    # 4 migi tettsui-uchi, draw right foot back
    tettsui_withdraw(seq,'R',h);mark(4,'R tettsui-uchi')
    # 5 hidari oi-zuki
    step_into(seq,'zenkutsu','L',h,'R',oi('L'),strike='L');mark(5,'L oi-zuki')
    # 6 turn left 90, L gedan-barai
    h+=90*D;step_into(seq,'zenkutsu','L',h,'R',gedan('L'),strike='L',arms_prep={'L':a_gedan_prep('L')},turn_sign=1,dur=0.85,prep_t=0.30);mark(6,'L gedan-barai turn90')
    # 7-9 age-uke R,L,R advancing
    for n,sd in ((7,'R'),(8,'L'),(9,'R')):
        arms={sd:arm_path(a_age_prep(sd),a_age(sd),knots=[0.5,1.0]),OPP[sd]:a_hikite(OPP[sd])}
        step_into(seq,'zenkutsu',sd,h,OPP[sd],arms,strike=sd,dur=0.72);mark(n,sd+' age-uke'+(' KIAI' if n==9 else ''))
    # 10 turn left 270, L gedan
    h+=270*D;step_into(seq,'zenkutsu','L',h,'R',gedan('L'),strike='L',arms_prep={'L':a_gedan_prep('L')},turn_sign=1,dur=1.10,prep_t=0.35);mark(10,'L gedan-barai turn270')
    # 11 R oi ; 12 turn right 180 R gedan ; 13 L oi ; 14 turn left 90 L gedan ; 15 R oi ; 16 L oi ; 17 R oi (kiai)
    step_into(seq,'zenkutsu','R',h,'L',oi('R'),strike='R');mark(11,'R oi-zuki')
    h-=180*D;step_into(seq,'zenkutsu','R',h,'L',gedan('R'),strike='R',arms_prep={'R':a_gedan_prep('R')},turn_sign=-1,dur=0.95,prep_t=0.30);mark(12,'R gedan-barai turn180')
    step_into(seq,'zenkutsu','L',h,'R',oi('L'),strike='L');mark(13,'L oi-zuki')
    h+=90*D;step_into(seq,'zenkutsu','L',h,'R',gedan('L'),strike='L',arms_prep={'L':a_gedan_prep('L')},turn_sign=1,dur=0.85,prep_t=0.30);mark(14,'L gedan-barai turn90')
    for n,sd in ((15,'R'),(16,'L'),(17,'R')):
        step_into(seq,'zenkutsu',sd,h,OPP[sd],oi(sd),strike=sd);mark(n,sd+' oi-zuki'+(' KIAI' if n==17 else ''))
    # 18-21 shuto-uke in kokutsu (Move 18: turn 90° through the back into East)
    shuto=lambda sd:{sd:arm_path(a_shuto_prep(sd),a_shuto_final(sd),knots=[0.5,1.0]),OPP[sd]:a_shuto_support(OPP[sd])}
    for n,sd,dh,dur,tsign in ((18,'L',-270,1.05,-1),(19,'R',45,0.85,1),(20,'R',-135,1.05,-1),(21,'L',45,0.85,1)):
        h+=dh*D;step_into(seq,'kokutsu',sd,h,OPP[sd],shuto(sd),strike=sd,turn_sign=tsign,dur=dur,prep_t=0.32 if abs(dh)>100 else 0.25,fist=(0,0),chest=(0,0,0));mark(n,sd+' shuto-uke kokutsu')
    # 22 return to yoi facing front
    hf=round(h/(2*np.pi))*2*np.pi
    S=stance_state('shizentai','L',{'L':a_yoi('L'),'R':a_yoi('R')},support=('R',ball_of(seq.cur,'R')),heading=hf)
    seq.goto(1.1,S,ease={'all':e_io},lift={'L':0.04});seq.hold(0.8);mark(22,'return to yoi')
    return seq,ev
if __name__=='__main__':
    import view,json
    sk,ms=view.setup()
    seq,ev=build_heian();fr=sample(seq.tl);print(len(fr),'frames',seq.t,'s');print(ev)
    res=audit(seq.tl,fr)
    for f in fr:
        if any('over' in k for k in f['info']):print(round(f['t'],2),{k:round(float(v),3) for k,v in f['info'].items() if 'over' in k});
