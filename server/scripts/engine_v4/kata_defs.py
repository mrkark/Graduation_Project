"""Kata move lists (JKA-style variant, sources: themartialway.com.au outlines + own knowledge).  conf: high/med/low"""
from kata_engine import *
def Z(turn,lead,*t,**kw):return M(turn,'zenkutsu',lead,t,**kw)
def K(turn,lead,*t,**kw):return M(turn,'kokutsu',lead,t,**kw)
def B(turn,*t,**kw):return M(turn,'kiba','L',t,**kw)       # kiba
def HS(turn,*t,support='L',**kw):return M(turn,'heisoku','L',t,support=support,**kw)
def IP(*t,**kw):return M(0,None,None,t,mode='inplace',**kw)
def KICK(kind,side,**kw):return M(0,None,None,[],kick=f'{kind}:{side}',**kw)
def JUMP(turn,stance,lead,*t,h=0.3,dz=0.0,k=None,**kw):return M(turn,stance,lead,t,jump=f'j:{h}:{dz}'+(f':{k}' if k else ''),**kw)
KATA={}
def kata(name,conf,start='heisoku'):
    def deco(f):KATA[name]=dict(fn=f,conf=conf,start=start);return f
    return deco
@kata('heian_shodan','high')
def _():return [Z(90,'L','L:gedan_barai'),Z(0,'R','R:oi_zuki'),Z(-180,'R','R:gedan_barai'),M(0,'moto','R',['R:tettsui'],support='L'),Z(0,'L','L:oi_zuki'),Z(90,'L','L:gedan_barai'),
 Z(0,'R','R:age_uke'),Z(0,'L','L:age_uke'),Z(0,'R','R:age_uke',kiai=True),Z(270,'L','L:gedan_barai'),Z(0,'R','R:oi_zuki'),Z(-180,'R','R:gedan_barai'),Z(0,'L','L:oi_zuki'),Z(90,'L','L:gedan_barai'),
 Z(0,'R','R:oi_zuki'),Z(0,'L','L:oi_zuki'),Z(0,'R','R:oi_zuki',kiai=True),K(-270,'L','L:shuto_uke'),K(45,'R','R:shuto_uke'),K(-135,'R','R:shuto_uke'),K(45,'L','L:shuto_uke')]
@kata('heian_nidan','med')
def _():return [K(90,'L','L:soto_uke'),Z(0,'R','R:gedan_zuki'),Z(0,'L','L:zuki'),K(-180,'R','R:soto_uke'),Z(0,'L','L:gedan_zuki'),Z(0,'R','R:zuki'),
 B(0,'R:uraken'),KICK('yoko_keage','R'),K(90,'L','L:shuto_uke'),K(0,'R','R:shuto_uke'),K(0,'L','L:shuto_uke'),Z(0,'R','R:nukite','L:hikite',kiai=True),K(-90,'L','L:shuto_uke'),
 K(-45,'R','R:shuto_uke'),K(0,'R','R:shuto_uke'),K(45,'L','L:shuto_uke'),Z(-45,'R','R:uchi_uke'),KICK('mae_geri','R'),Z(0,'R','L:gyaku_zuki'),
 Z(0,'L','L:uchi_uke'),KICK('mae_geri','L'),Z(0,'L','R:gyaku_zuki'),Z(0,'R','R:gedan_barai'),Z(90,'L','L:gedan_barai'),Z(45,'R','R:age_uke'),Z(-135,'R','R:gedan_barai'),Z(0,'L','L:age_uke',kiai=True)]
@kata('heian_sandan','med')
def _():return [K(90,'L','L:uchi_uke'),HS(0,'L:gedan_barai','R:uchi_uke'),IP('R:gedan_barai','L:uchi_uke'),K(-180,'R','R:uchi_uke'),HS(0,'R:gedan_barai','L:uchi_uke',support='R'),IP('L:gedan_barai','R:uchi_uke'),
 K(90,'L','L:morote_uke'),Z(0,'R','R:nukite','L:osae_uke'),B(180,'L:yoko_tettsui'),Z(0,'R','R:oi_zuki',kiai=True),HS(180,'L:hikite','R:hikite',support='R'),
 M(-90,'kiba','L',['R:yoko_empi'],note='yoko-fumikomi'),IP('R:tate_uraken'),M(180,'kiba','L',['L:yoko_empi']),IP('L:tate_uraken'),M(-180,'kiba','L',['R:yoko_empi']),IP('R:tate_uraken'),IP('L:tate_shuto_uke'),
 Z(0,'L','L:oi_zuki'),B(180,'R:tate_zuki','L:ushiro_empi'),IP('L:tate_zuki','R:ushiro_empi',kiai=True)]
@kata('heian_yondan','med')
def _():return [K(90,'L','L:jodan_haishu_uke'),K(-180,'R','R:jodan_haishu_uke'),Z(0,'L','L:gedan_juji_uke'),K(0,'R','R:morote_uke'),HS(0,'L:hikite','R:hikite',support='R'),KICK('yoko_keage','L'),Z(90,'L','R:mae_empi'),
 HS(0,'R:hikite','L:hikite',support='L'),KICK('yoko_keage','R'),Z(-180,'R','L:mae_empi'),Z(90,'L','L:shuto_uke','R:shuto_uchi'),KICK('mae_keage','R'),Z(0,'R','R:uraken',kiai=True),
 K(135,'L','L:kakiwake_uke'),KICK('mae_geri','R'),Z(0,'R','R:oi_zuki'),IP('L:gyaku_zuki'),K(-90,'R','R:kakiwake_uke'),KICK('mae_geri','L'),Z(0,'L','L:oi_zuki'),IP('R:gyaku_zuki'),
 K(45,'L','L:morote_uke'),K(0,'R','R:morote_uke'),K(0,'L','L:morote_uke'),KICK('hiza','R',dur=1.2),K(180,'L','L:shuto_uke',kiai=True),K(0,'R','R:shuto_uke')]
@kata('heian_godan','med')
def _():return [K(90,'L','L:uchi_uke'),IP('R:gyaku_zuki'),HS(0,'L:kagi_zuki',support='R'),K(-180,'R','R:uchi_uke'),IP('L:gyaku_zuki'),HS(0,'R:kagi_zuki',support='L'),
 K(90,'R','R:morote_uke'),Z(0,'L','L:gedan_juji_uke'),IP('L:shuto_juji_uke'),Z(0,'R','L:osae_uke'),Z(0,'R','L:oi_zuki',kiai=True),
 M(180,'kiba','L',['R:gedan_barai']),KICK('mikazuki','R'),B(0,'R:mae_empi'),M(0,'kosa','R',['R:morote_uke'],support='R'),M(180,'renoji','R',['L:koho_zuki_age','R:koho_zuki_age']),
 JUMP(180,'kosa','R','L:gedan_juji_uke',h=0.32),Z(90,'R','R:morote_uke',kiai=True),Z(90,'L','L:gedan_barai','R:nukite'),K(0,'L','L:gedan_barai','R:uchi_uke'),
 Z(-90,'R','R:nagashi_uke','L:nukite'),K(0,'R','R:gedan_barai','L:uchi_uke')]
@kata('tekki_shodan','high')
def _():return [M(-90,'kiba','L',['L:haishu_uke']),IP('L:mae_empi'),IP('L:gedan_barai'),IP('R:kagi_zuki'),M(180,'kiba','L',['R:uchi_uke']),IP('R:gedan_barai','L:nagashi_uke'),IP('L:ura_zuki'),
 KICK('nami_gaeshi','L'),KICK('nami_gaeshi','R'),IP('L:yoko_zuki','R:kagi_zuki',kiai=True),IP('L:haishu_uke'),IP('R:mae_empi'),IP('R:gedan_barai'),IP('L:kagi_zuki'),
 M(180,'kiba','L',['L:uchi_uke']),IP('L:gedan_barai','R:nagashi_uke'),IP('R:ura_zuki'),KICK('nami_gaeshi','R'),KICK('nami_gaeshi','L'),IP('R:yoko_zuki','L:kagi_zuki',kiai=True)]
@kata('tekki_nidan','low')
def _():return [M(-90,'kiba','L',['L:haishu_uke']),IP('R:mae_empi'),IP('L:gedan_barai'),IP('R:zuki'),IP('L:soto_uke'),IP('R:yoko_zuki'),M(180,'kiba','L',['R:gedan_barai']),IP('L:mae_empi'),
 IP('R:soto_uke'),IP('L:yoko_zuki'),IP('R:uchi_uke'),IP('L:gedan_barai','R:uchi_uke'),IP('L:zuki',kiai=True),M(180,'kiba','L',['L:gedan_barai']),IP('R:mae_empi'),IP('R:uchi_uke'),
 IP('L:soto_uke'),IP('R:gedan_barai','L:uchi_uke'),IP('R:zuki',kiai=True)]
@kata('tekki_sandan','low')
def _():return [M(-90,'kiba','L',['L:gedan_barai']),IP('R:uchi_uke'),IP('R:gedan_barai'),IP('L:uchi_uke'),IP('L:mae_empi'),IP('R:gedan_barai','L:uchi_uke'),M(180,'kiba','L',['R:gedan_barai']),
 IP('L:uchi_uke'),IP('L:gedan_barai'),IP('R:uchi_uke'),IP('R:mae_empi'),IP('L:gedan_barai','R:uchi_uke'),IP('R:zuki',kiai=True),M(180,'kiba','L',['L:gedan_barai']),IP('R:uchi_uke'),
 IP('R:gedan_barai'),IP('L:uchi_uke'),IP('L:zuki',kiai=True)]
@kata('bassai_dai','med')
def _():return [JUMP(0,'kosa','R','R:morote_uke',h=0.12),Z(90,'L','L:uchi_uke'),IP('R:uchi_uke'),Z(180,'R','L:soto_uke'),IP('R:uchi_uke'),
 Z(-90,'R','R:soto_uke'),IP('L:uchi_uke'),HS(0,'L:tate_shuto_uke',support='R'),IP('R:zuki'),IP('R:uchi_uke'),IP('L:zuki'),IP('L:uchi_uke'),
 K(0,'R','R:shuto_uke'),K(0,'L','L:shuto_uke'),K(0,'R','R:shuto_uke'),K(0,'L','L:shuto_uke'),KICK('yoko_fumikomi','R',kiai=True),K(180,'L','L:shuto_uke'),K(0,'R','R:shuto_uke'),
 HS(0,'R:morote_age_uke',support='L'),Z(0,'R','R:hasami'),Z(0,'R','R:oi_zuki'),Z(180,'L','L:nagashi_uke','R:nukite'),HS(-90,'L:manji_uke',support='R'),M(180,'kiba','L',['R:gedan_barai']),
 KICK('mikazuki','R'),B(0,'R:empi'),IP('R:gedan_barai','L:hikite'),IP('L:gedan_barai','R:hikite'),IP('R:gedan_barai','L:hikite'),Z(-90,'R','L:yama_zuki'),HS(0,'L:hikite',support='R'),
 Z(0,'L','R:yama_zuki'),HS(0,'R:hikite',support='L'),Z(0,'R','L:yama_zuki'),Z(90,'L','R:sukui_uke'),Z(-90,'R','L:sukui_uke'),K(45,'R','R:shuto_uke'),K(-90,'R','R:shuto_uke'),K(0,'L','L:shuto_uke',kiai=True)]
