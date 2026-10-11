"""Extended hand-technique presets (aim frame, hip-relative unless noted).  Each technique(side) returns
   dict(final={'L':spec,'R':spec}, prep={'L':spec,'R':spec}  (start of the swing/chamber for each arm),
        path={'L':arm_path|None,'R':...}, fist=(fL,fR), tag=name)
side = the main (active) arm; for two-arm techniques side only decides mirroring."""
from moves import *
def _A(side,c,ax,pole,palm,knuckle=0.065,ref='hip',frame='aim',twist=0.5):
    d=A(c,ax,pole,palm,knuckle,ref=ref,frame=frame,twist_fore=twist);d['side']=side;return d
def X(s,x):return x*s
def a_reach(side,drop=0.18,reach=0.55):return a_punch(side,drop=drop,inward=0.04,reach=reach)
# ------------------------------------------------------------------ blocks
def t_uchi_uke(side):
    s=sgn(side);o=OPP[side]
    prep=_A(side,(-0.06*s,0.36,0.30),(-0.75*s,0.25,0.60),(0.5*s,-1,0.1),(0,-1,0.2))
    mid=_A(side,(0.06*s,0.44,0.36),(0.1*s,0.8,0.5),(0.3*s,-1,0.3),(-0.3*s,-0.3,-0.9))
    fin=_A(side,(0.22*s,0.52,0.40),(0.50*s,0.85,0.20),(0.10*s,-1,0.35),(-0.8*s,0.2,-0.5))
    return dict(tag='uchi_uke',final={side:fin,o:a_hikite(o)},path={side:arm_path(prep,mid,fin,knots=[0.4,0.7,1.0])},prep={side:prep,o:a_reach(o,0.42,0.40)},fist=(1,1))
def t_soto_uke(side):
    s=sgn(side);o=OPP[side]
    prep=_A(side,(0.26*s,0.62,0.10),(0.15*s,1.0,0.05),(0.9*s,0.2,-0.3),(0,0,1))
    mid=_A(side,(0.24*s,0.56,0.26),(0.05*s,0.9,0.35),(0.5*s,-0.6,0.2),(-0.4*s,0.1,0.9))
    fin=_A(side,(0.15*s,0.52,0.40),(0.0,1.0,0.10),(0.10*s,-1,0.30),(-0.9*s,0.2,-0.3))
    return dict(tag='soto_uke',final={side:fin,o:a_hikite(o)},path={side:arm_path(prep,mid,fin,knots=[0.35,0.7,1.0])},prep={side:prep,o:a_reach(o,0.42,0.40)},fist=(1,1))
def t_gedan_barai(side):
    o=OPP[side];return dict(tag='gedan_barai',final={side:a_gedan(side),o:a_hikite(o)},path={side:arm_path(a_gedan_prep(side),a_gedan(side),knots=[0.45,1.0])},prep={side:a_gedan_prep(side),o:a_reach(o)},fist=(1,1))
def t_age_uke(side):
    o=OPP[side];return dict(tag='age_uke',final={side:a_age(side),o:a_hikite(o)},path={side:arm_path(a_age_prep(side),a_age(side),knots=[0.5,1.0])},prep={side:a_age_prep(side),o:a_reach(o,0.42)},fist=(1,1))
def t_shuto_uke(side):
    o=OPP[side];return dict(tag='shuto_uke',final={side:a_shuto_final(side),o:a_shuto_support(o)},path={side:arm_path(a_shuto_prep(side),a_shuto_final(side),knots=[0.5,1.0])},prep={side:a_shuto_prep(side),o:a_reach(o,0.40,0.40)},fist=(0,0))
def t_morote_uke(side):
    """augmented forearm block : blocking arm in uchi-uke position, other fist braced under its elbow"""
    s=sgn(side);o=OPP[side];so=sgn(o)
    base=t_uchi_uke(side);fin=base['final'][side]
    brace=_A(o,(0.14*s,0.38,0.34),(0.7*s,0.25,0.5),(-0.3*so,-1,0.1),(0,1,0.2))
    return dict(tag='morote_uke',final={side:fin,o:brace},path={side:base['path'][side]},prep={side:base['prep'][side],o:a_hikite(o)},fist=(1,1))
def t_juji_uke(side,level='jodan',open_hand=True):
    """X block : wrists crossed, both hands open (palms forward for jodan / down for gedan)"""
    s=sgn(side);o=OPP[side]
    if level=='jodan':
        fL=_A('L',(0.06,0.76,0.40),(0.55,0.65,0.45),(0.3,-1,0.2),(0,0.3,1),0.10)
        fR=_A('R',(-0.06,0.76,0.42),(-0.55,0.65,0.45),(-0.3,-1,0.2),(0,0.3,1),0.10)
    else:
        fL=_A('L',(0.05,0.20,0.40),(0.55,-0.55,0.55),(0.4,-0.2,-0.8),(0,0.3,1),0.10)
        fR=_A('R',(-0.05,0.20,0.40),(-0.55,-0.55,0.55),(-0.4,-0.2,-0.8),(0,0.3,1),0.10)
    pL=_A('L',(0.15,0.40,0.32),(0.2,0.2,1),(0.5,-1,0.1),(0,-1,0),0.10);pR=_A('R',(-0.15,0.40,0.32),(-0.2,0.2,1),(-0.5,-1,0.1),(0,-1,0),0.10)
    return dict(tag='juji_uke_'+level,final={'L':fL,'R':fR},path={'L':arm_path(pL,fL),'R':arm_path(pR,fR)},prep={'L':pL,'R':pR},fist=(0,0) if open_hand else (1,1))
def t_kakiwake_uke(side,level='jodan'):
    """wedge block : crossed wrists at the chest spread apart ; fists"""
    h=0.64 if level=='jodan' else 0.30
    fL=_A('L',(0.32,h,0.38),(0.45,0.7,0.55),(0.5,-1,0.0),(-0.7,0.3,0.6));fR=_A('R',(-0.32,h,0.38),(-0.45,0.7,0.55),(-0.5,-1,0.0),(0.7,0.3,0.6))
    cL=_A('L',(-0.06,0.40,0.30),(-0.2,0.4,1),(0.6,-1,0.2),(0,-1,0.4));cR=_A('R',(0.06,0.40,0.32),(0.2,0.4,1),(-0.6,-1,0.2),(0,-1,0.4))
    return dict(tag='kakiwake_uke',final={'L':fL,'R':fR},path={'L':arm_path(cL,fL),'R':arm_path(cR,fR)},prep={'L':cL,'R':cR},fist=(1,1))
def t_haishu_uke(side):
    s=sgn(side);o=OPP[side]
    prep=_A(side,(-0.10*s,0.45,0.26),(-0.4*s,0.3,1),(0.4*s,-1,0.2),(0,1,0),0.10)
    fin=_A(side,(0.16*s,0.52,0.50),(0.3*s,0.2,1),(0.4*s,-1,0.0),(-0.5*s,0.8,0.0),0.10)
    return dict(tag='haishu_uke',final={side:fin,o:a_hikite(o)},path={side:arm_path(prep,fin)},prep={side:prep,o:a_reach(o,0.42,0.40)},fist=(0,0))
# ------------------------------------------------------------------ strikes
def t_empi(side,v='mae'):
    s=sgn(side);o=OPP[side]
    ch={'side':o}
    if v=='mae':fin=_A(side,(0.10*s,0.58,0.22),(-0.3*s,0.5,0.8),(0.0,0.1,1.0),(-0.5*s,0.8,0.0),0.065)           # elbow forward
    elif v=='yoko':fin=_A(side,(0.0,0.46,0.30),(-0.5*s,0.1,0.8),(1.0*s,0.0,-0.1),(0,-1,0.2),0.065)               # elbow thrust to the side, fist across the chest
    elif v=='age':fin=_A(side,(0.06*s,0.64,0.30),(-0.2*s,0.8,0.4),(0.2*s,0.8,0.6),(-0.6*s,0.5,0.5),0.065)       # rising elbow
    elif v=='otoshi':fin=_A(side,(0.08*s,0.40,0.26),(-0.2*s,0.9,0.1),(0.1*s,-1,0.2),(-0.5*s,0.4,0.8),0.065)      # dropping elbow
    elif v=='ushiro':fin=_A(side,(0.10*s,0.44,0.20),(0.2*s,0.2,0.9),(0.3*s,0.0,-1.0),(0,-1,0.2),0.065)           # elbow backward
    else:raise KeyError(v)
    pre=a_hikite(side)
    other=a_hikite(o) if v!='yoko' else _A(o,(0.0,0.46,0.46),(0,0.1,1),(-0.2*s,-1,0.2),(0,1,0),0.065)           # yoko-empi: other hand covers the fist
    return dict(tag='empi_'+v,final={side:fin,o:other},path={side:arm_path(pre,fin)},prep={side:pre,o:a_hikite(o)},fist=(1,1))
def t_uraken(side,v='mae'):
    s=sgn(side);o=OPP[side]
    ear=_A(side,(0.16*s,0.66,0.16),(0.1*s,0.5,0.8),(0.8*s,0.2,-0.4),(-0.8*s,0.2,0.4),0.065)
    if v=='mae':fin=_A(side,(0.06*s,0.54,0.58),(0.0,0.4,0.95),(0.2*s,-1,0.0),(0,1,0.3),0.07,ref='hip')
    elif v=='mawashi':fin=_A(side,(-0.02*s,0.66,0.52),(-0.6*s,0.1,0.8),(0.5*s,-0.4,0.2),(0.3*s,1,0.2),0.07)
    else:fin=_A(side,(0.40*s,0.56,0.30),(0.9*s,0.1,0.3),(0.2*s,-1,0.2),(0,1,0.2),0.07)     # yoko : to the side
    return dict(tag='uraken_'+v,final={side:fin,o:a_hikite(o)},path={side:arm_path(ear,fin)},prep={side:ear,o:a_hikite(o)},fist=(1,1))
def t_nukite(side,v='ippon',level='chudan'):
    s=sgn(side);o=OPP[side];h={'chudan':0.34,'jodan':0.60,'gedan':0.14}[level]
    fin=_A(side,(0.05*s,h,0.54),(0.0,0.0,1),(0.3*s,-1,-0.1),(0,1,0) if v=='ippon' else (-s*0.3,1,0),0.14)
    return dict(tag='nukite_'+v,final={side:fin,o:a_hikite(o)},path={side:arm_path(a_hikite(side),fin)},prep={side:a_hikite(side),o:a_hikite(o)},fist=(0,1) if side=='L' else (1,0))
def t_teisho(side,level='chudan'):
    s=sgn(side);o=OPP[side];h={'chudan':0.38,'jodan':0.62}[level]
    fin=_A(side,(0.06*s,h,0.52),(0,0.1,1),(0.3*s,-1,-0.1),(0,1,0.2),0.10)
    return dict(tag='teisho',final={side:fin,o:a_hikite(o)},path={side:arm_path(a_hikite(side),fin)},prep={side:a_hikite(side),o:a_hikite(o)},fist=(0,1) if side=='L' else (1,0))
def t_shuto_uchi(side):
    s=sgn(side);o=OPP[side]
    pre=_A(side,(0.22*s,0.68,0.10),(0.4*s,0.5,0.4),(0.9*s,0.0,-0.5),(-0.3*s,1,0),0.10)
    fin=_A(side,(-0.02*s,0.60,0.46),(-0.55*s,0.2,0.8),(0.5*s,-0.8,0.2),(0.2*s,1,0.2),0.10)
    return dict(tag='shuto_uchi',final={side:fin,o:a_hikite(o)},path={side:arm_path(pre,fin)},prep={side:pre,o:a_hikite(o)},fist=(0,1) if side=='L' else (1,0))
def t_age_zuki(side):
    s=sgn(side);o=OPP[side]
    fin=_A(side,(0.06*s,0.62,0.40),(0,0.8,0.6),(0.3*s,-1,0.2),(0,0.2,-1),0.07)
    return dict(tag='age_zuki',final={side:fin,o:a_hikite(o)},path={side:arm_path(a_hikite(side),fin)},prep={side:a_hikite(side),o:a_hikite(o)},fist=(1,1))
def t_mawashi_zuki(side):
    s=sgn(side);o=OPP[side]
    pre=_A(side,(0.30*s,0.52,0.10),(0.3*s,0.1,0.9),(0.9*s,-0.2,-0.4),(-s*0.8,0.2,0.4),0.07)
    fin=_A(side,(0.04*s,0.52,0.52),(-0.5*s,0.1,0.85),(0.4*s,-1,0.2),(0.2*s,-0.1,-1),0.07)
    return dict(tag='mawashi_zuki',final={side:fin,o:a_hikite(o)},path={side:arm_path(pre,fin)},prep={side:pre,o:a_hikite(o)},fist=(1,1))
def t_tate_zuki(side):
    s=sgn(side);o=OPP[side];d=t_age_zuki(side)
    fin=_A(side,(0.0,0.46,0.56),(0,0,1),(0.2*s,-1,0.1),(-s,0,0),0.07)
    return dict(tag='tate_zuki',final={side:fin,o:a_hikite(o)},path={side:arm_path(a_hikite(side),fin)},prep={side:a_hikite(side),o:a_hikite(o)},fist=(1,1))
def t_morote_zuki(side):
    s=sgn(side);o=OPP[side]
    fL=_A('L',(0.06,0.46,0.58),(0,0,1),(0.2,-1,0.1),(-1,0,0));fR=_A('R',(-0.06,0.46,0.58),(0,0,1),(-0.2,-1,0.1),(1,0,0))
    return dict(tag='morote_zuki',final={'L':fL,'R':fR},path={'L':arm_path(a_hikite('L'),fL),'R':arm_path(a_hikite('R'),fR)},prep={'L':a_hikite('L'),'R':a_hikite('R')},fist=(1,1))
def t_yama_zuki(side):
    """U-punch / mountain punch : upper fist jodan, lower fist gedan-chudan, both forward"""
    s=sgn(side);o=OPP[side]
    up=_A(side,(0.05*s,0.74,0.48),(0,0.1,1),(0.3*s,-1,0.1),(-s,0,0));lo=_A(o,(-0.05*s,0.26,0.44),(0,-0.1,1),(-0.3*s,-1,0.1),(s,0,0))
    return dict(tag='yama_zuki',final={side:up,o:lo},path={side:arm_path(a_hikite(side),up),o:arm_path(a_hikite(o),lo)},prep={side:a_hikite(side),o:a_hikite(o)},fist=(1,1))
TECH={'uchi_uke':t_uchi_uke,'soto_uke':t_soto_uke,'gedan_barai':t_gedan_barai,'age_uke':t_age_uke,'shuto_uke':t_shuto_uke,'morote_uke':t_morote_uke,
 'juji_uke':t_juji_uke,'kakiwake_uke':t_kakiwake_uke,'haishu_uke':t_haishu_uke,'empi':t_empi,'uraken':t_uraken,'nukite':t_nukite,'teisho':t_teisho,'shuto_uchi':t_shuto_uchi,
 'age_zuki':t_age_zuki,'mawashi_zuki':t_mawashi_zuki,'tate_zuki':t_tate_zuki,'morote_zuki':t_morote_zuki,'yama_zuki':t_yama_zuki}
