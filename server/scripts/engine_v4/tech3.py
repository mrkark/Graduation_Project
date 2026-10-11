"""More arm presets + aliases used by kata data."""
import tech2 as T2
from tech2 import _A,a_hikite,arm_path,sgn,OPP
def t_osae(side):
    s=sgn(side);o=OPP[side]
    fin=_A(side,(0.06*s,0.36,0.46),(0,-0.1,1),(0.3*s,-1,0.0),(0,-1,0.0),0.12)
    return dict(tag='osae_uke',final={side:fin,o:a_hikite(o)},path={side:arm_path(a_hikite(side),fin)},prep={side:a_hikite(side),o:a_hikite(o)},fist=(0,1) if side=='L' else (1,0))
def t_sukui(side):
    s=sgn(side);o=OPP[side]
    lo=_A(side,(0.10*s,0.12,0.34),(0.2*s,-0.5,0.8),(0.5*s,-1,0.2),(0,0.2,1),0.065)
    fin=_A(side,(0.12*s,0.46,0.46),(0.1*s,0.7,0.7),(0.4*s,-1,0.2),(0,1,0.1),0.065)
    return dict(tag='sukui_uke',final={side:fin,o:a_hikite(o)},path={side:arm_path(lo,fin)},prep={side:lo,o:a_hikite(o)},fist=(1,1))
def t_manji(side):
    s=sgn(side);o=OPP[side]
    hi=_A(side,(0.20*s,0.66,0.12),(0.3*s,0.9,0.2),(0.8*s,0.2,-0.5),(0,0.2,1),0.10)
    lo=_A(o,(-0.02*s,0.24,0.40),(0,-0.5,0.8),(-0.2*s,-1,0.1),(0,-0.8,0.3),0.10)
    return dict(tag='manji_uke',final={side:hi,o:lo},path={},prep={side:hi,o:lo},fist=(0,0))
def t_tettsui_hasami(side):
    s=sgn(side)
    fL=_A('L',(0.14,0.40,0.42),(0.1,-0.3,1),(0.5,-1,0.2),(-1,0,0),0.07);fR=_A('R',(-0.14,0.40,0.42),(-0.1,-0.3,1),(-0.5,-1,0.2),(1,0,0),0.07)
    pL=_A('L',(0.38,0.58,0.20),(0.5,0.4,0.8),(0.9,-0.4,0),(-1,0,0),0.07);pR=_A('R',(-0.38,0.58,0.20),(-0.5,0.4,0.8),(-0.9,-0.4,0),(1,0,0),0.07)
    return dict(tag='hasami',final={'L':fL,'R':fR},path={'L':arm_path(pL,fL),'R':arm_path(pR,fR)},prep={'L':pL,'R':pR},fist=(1,1))
def t_morote_age(side):
    fL=_A('L',(0.10,0.80,0.30),(0.2,1,0.4),(0.6,-0.4,0.6),(0,0,1),0.07);fR=_A('R',(-0.10,0.80,0.30),(-0.2,1,0.4),(-0.6,-0.4,0.6),(0,0,1),0.07)
    pL=_A('L',(0.14,0.34,0.30),(0,0.3,1),(0.5,-1,0.2),(0,-1,0),0.07);pR=_A('R',(-0.14,0.34,0.30),(0,0.3,1),(-0.5,-1,0.2),(0,-1,0),0.07)
    return dict(tag='morote_age',final={'L':fL,'R':fR},path={'L':arm_path(pL,fL),'R':arm_path(pR,fR)},prep={'L':pL,'R':pR},fist=(0,0))
def t_koho_age(side):
    fL=_A('L',(0.12,0.60,0.42),(0.0,0.7,0.7),(0.4,-1,0.2),(0,0,-1),0.07);fR=_A('R',(-0.12,0.60,0.42),(0.0,0.7,0.7),(-0.4,-1,0.2),(0,0,-1),0.07)
    return dict(tag='koho_age',final={'L':fL,'R':fR},path={'L':arm_path(a_hikite('L'),fL),'R':arm_path(a_hikite('R'),fR)},prep={'L':a_hikite('L'),'R':a_hikite('R')},fist=(1,1))
def t_yoko_zuki(side):
    s=sgn(side);o=OPP[side]
    fin=_A(side,(0.46*s,0.50,0.14),(0.95*s,0,0.15),(0.1*s,-1,0.2),(0,-1,0),0.07)
    return dict(tag='yoko_zuki',final={side:fin,o:_A(o,(0.0,0.44,0.28),(-0.6*s,0.1,0.8),(-0.2*s,-1,0.4),(0,-1,0.2),0.065)},path={side:arm_path(a_hikite(side),fin)},prep={side:a_hikite(side),o:a_hikite(o)},fist=(1,1))
def t_kagi(side):
    d=T2.t_mawashi_zuki(side);d['tag']='kagi_zuki';return d
def t_haishu_hold(side):
    return T2.t_haishu_uke(side)
EXTRA={'osae_uke':t_osae,'sukui_uke':t_sukui,'manji_uke':t_manji,'hasami':t_tettsui_hasami,'morote_age_uke':t_morote_age,'koho_zuki_age':t_koho_age,'yoko_zuki':t_yoko_zuki,'kagi_zuki':t_kagi,
 'tate_nukite':lambda s,**k:T2.t_nukite(s),'nukite':lambda s,**k:T2.t_nukite(s),'yoko_tettsui':lambda s,**k:T2.t_uraken(s,'yoko'),'tate_uraken':lambda s,**k:T2.t_uraken(s,'mae'),'uraken':lambda s,**k:T2.t_uraken(s,'mae'),
 'yoko_empi':lambda s,**k:T2.t_empi(s,'yoko'),'mae_empi':lambda s,**k:T2.t_empi(s,'mae'),'ushiro_empi':lambda s,**k:T2.t_empi(s,'ushiro'),'age_empi':lambda s,**k:T2.t_empi(s,'age'),'otoshi_empi':lambda s,**k:T2.t_empi(s,'otoshi'),
 'tate_shuto_uke':lambda s,**k:T2.t_shuto_uke(s),'nagashi_uke':lambda s,**k:T2.t_haishu_uke(s),'ura_zuki':lambda s,**k:T2.t_age_zuki(s),'shuto_juji_uke':lambda s,**k:T2.t_juji_uke(s,'jodan',True),
 'gedan_juji_uke':lambda s,**k:T2.t_juji_uke(s,'gedan',False),'jodan_juji_uke':lambda s,**k:T2.t_juji_uke(s,'jodan',False),'jodan_haishu_uke':lambda s,**k:T2.t_haishu_uke(s)}
