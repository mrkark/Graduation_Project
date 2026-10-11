from kata_defs import *
def F(turn,lead,*t,**kw):return M(turn,'fudo',lead,t,**kw)
def H(turn,lead,*t,**kw):return M(turn,'hangetsu',lead,t,**kw)
def N(turn,lead,*t,**kw):return M(turn,'neko',lead,t,**kw)
def KS(turn,lead,*t,**kw):return M(turn,'kosa',lead,t,**kw)
def SA(turn,lead,*t,**kw):return M(turn,'sanchin',lead,t,**kw)
def HA(turn,*t,support='L',**kw):return M(turn,'hachiji','L',t,support=support,**kw)
def RE(turn,lead,*t,**kw):return M(turn,'renoji',lead,t,**kw)
@kata('kanku_dai','med')
def _():return [HA(0,'L:guard'),IP('R:zuki'),K(90,'L','L:jodan_haishu_uke'),IP('R:jodan_haishu_uke'),HA(0,'L:tate_shuto_uke'),IP('R:zuki'),IP('R:uchi_uke'),IP('L:zuki'),IP('L:uchi_uke'),
 KICK('yoko_keage','R'),IP('R:uraken'),K(-90,'L','L:shuto_uke'),K(0,'R','R:shuto_uke'),K(0,'L','L:shuto_uke'),Z(0,'R','R:nukite','L:osae_uke',kiai=True),
 Z(90,'L','L:shuto_uchi'),KICK('mae_geri','R'),K(90,'R','R:uchi_uke','L:gedan_barai'),Z(90,'L','R:nukite','L:nagashi_uke'),RE(0,'L','L:gedan_barai'),
 Z(0,'L','L:shuto_uchi'),KICK('mae_geri','R'),K(0,'R','R:uchi_uke','L:gedan_barai'),Z(0,'L','R:nukite','L:nagashi_uke'),RE(0,'L','L:gedan_barai'),
 KICK('yoko_keage','L'),Z(0,'L','R:mae_empi'),KICK('yoko_keage','R'),Z(0,'R','L:mae_empi'),K(180,'L','L:shuto_uke'),K(45,'R','R:shuto_uke'),K(135,'R','R:shuto_uke'),K(-90,'L','L:shuto_uke'),
 Z(0,'L','L:shuto_uchi'),KICK('mae_geri','R'),KS(0,'R','R:uraken'),Z(0,'L','R:uchi_uke'),IP('L:gyaku_zuki'),IP('R:zuki'),Z(180,'R','L:zuki'),
 B(0,'R:empi'),Z(-180,'L','L:shuto_uke'),K(180,'R','R:shuto_uke'),Z(-270,'L','L:uchi_uke'),IP('R:gyaku_zuki'),Z(180,'R','R:uchi_uke'),IP('L:gyaku_zuki'),IP('R:zuki'),
 KICK('yoko_keage','R'),IP('R:uraken'),Z(-90,'R','L:shuto_uke'),Z(0,'R','R:nukite','L:osae_uke'),B(180,'L:uraken'),B(0,'L:tettsui'),IP('R:mae_empi'),IP('R:gedan_barai'),
 B(180,'R:yoko_tettsui'),IP('R:gedan_zuki'),HA(0,'L:morote_age_uke'),M(270,'moto','L',['L:juji_uke']),JUMP(0,'zenkutsu','L','R:uraken',h=0.38,dz=0.8,k='L'),JUMP(0,'zenkutsu','L','R:uraken',h=0.38,dz=0.8,k='R',kiai=True)]
KATA['kanku_dai']['jump_kick']=True
@kata('jion','med',start='heisoku')
def _():return [Z(0,'L','R:uchi_uke','L:gedan_barai'),Z(-45,'L','L:age_uke'),KICK('mae_geri','R'),Z(0,'R','R:gyaku_zuki'),IP('L:gyaku_zuki'),IP('R:zuki'),
 Z(-90,'R','R:age_uke'),KICK('mae_geri','L'),Z(0,'L','L:gyaku_zuki'),IP('R:gyaku_zuki'),IP('L:zuki'),Z(180,'L','L:age_uke'),IP('R:gyaku_zuki'),Z(0,'R','R:age_uke'),IP('L:gyaku_zuki'),Z(0,'L','L:age_uke'),
 Z(0,'R','R:gyaku_zuki',kiai=True),Z(270,'L','R:manji_uke'),B(0,'R:kagi_zuki'),Z(180,'R','L:manji_uke'),B(0,'L:kagi_zuki'),Z(0,'L','L:gedan_barai'),B(0,'R:teisho'),B(0,'L:teisho'),B(0,'R:teisho'),
 K(90,'L','R:manji_uke'),HA(0,'L:morote_age_uke'),K(-180,'R','L:manji_uke'),HA(0,'R:morote_age_uke'),IP('R:gedan_barai'),B(0,'R:gedan_juji_uke'),Z(0,'R','R:gedan_barai'),Z(0,'L','L:uchi_uke'),
 Z(0,'R','R:juji_uke:level=jodan'),Z(0,'L','L:gyaku_zuki'),IP('R:age_zuki'),Z(270,'L','L:uchi_uke'),Z(0,'R','R:gyaku_zuki'),Z(-180,'R','R:uchi_uke'),Z(0,'L','L:gyaku_zuki'),
 B(90,'L:gedan_barai'),KICK('yoko_fumikomi','R'),KICK('yoko_fumikomi','L'),KICK('yoko_fumikomi','R'),B(0,'L:yoko_zuki'),B(0,'R:yoko_zuki',kiai=True)]
@kata('empi','med')
def _():return [M(90,'renoji','L',['L:gedan_barai']),HA(0,'L:hikite',support='L'),Z(-90,'R','R:gedan_barai'),B(0,'L:kagi_zuki'),Z(0,'L','L:gedan_barai'),IP('R:age_zuki'),
 KICK('mae_geri','R'),KS(0,'R','L:gedan_zuki','R:nagashi_uke'),Z(0,'L','R:gedan_barai'),Z(0,'L','L:gedan_barai'),IP('R:age_zuki'),KICK('mae_geri','R'),KS(0,'R','L:gedan_zuki','R:nagashi_uke'),
 Z(0,'L','R:gedan_barai'),Z(0,'L','L:gedan_barai'),B(180,'L:haishu_uke'),IP('R:mae_empi',kiai=True),B(0,'L:tate_shuto_uke'),IP('R:zuki'),IP('L:zuki'),Z(0,'L','L:gedan_barai'),IP('R:age_zuki'),
 K(0,'R','R:shuto_uke'),K(180,'L','L:shuto_uke'),IP('R:gyaku_zuki'),K(0,'R','R:shuto_uke'),Z(180,'L','L:gedan_barai'),IP('R:age_zuki'),KICK('mae_geri','R'),KS(0,'R','L:gedan_zuki','R:nagashi_uke'),
 Z(0,'L','R:gedan_barai'),Z(0,'L','L:gedan_barai'),IP('R:teisho'),Z(-90,'R','R:teisho','L:teisho'),Z(0,'L','L:teisho','R:teisho'),Z(0,'R','R:teisho','L:teisho'),K(0,'R','R:gedan_barai'),
 B(0,'R:shuto_uke'),B(0,'L:tate_shuto_uke'),JUMP(-360,'kokutsu','R','R:shuto_uke',h=0.36,kiai=True),K(0,'L','L:shuto_uke')]
@kata('gankaku','med')
def _():return [K(0,'R','R:jodan_haishu_uke','L:jodan_haishu_uke'),IP('R:gedan_juji_uke'),IP('L:zuki'),IP('R:gyaku_zuki'),M(-360,'kiba','L',['R:gedan_barai']),
 M(90,'moto','R',['R:juji_uke:level=jodan']),IP('R:juji_uke:level=gedan'),JUMP(0,'zenkutsu','L','R:gedan_juji_uke',h=0.34),Z(0,'R','R:gedan_juji_uke'),Z(180,'L','R:gedan_juji_uke'),
 K(180,'R','R:gedan_barai','L:gedan_barai'),K(0,'L','L:gedan_barai','R:gedan_barai'),Z(0,'R','L:shuto_uke','R:shuto_uke'),B(90,'L:shuto_uke'),HA(0,'L:guard','R:guard',support='L'),
 K(90,'L','L:uchi_uke','R:gedan_barai'),K(0,'R','R:uchi_uke','L:gedan_barai'),K(-180,'L','L:uchi_uke','R:gedan_barai'),M(0,'tsuru','L',['L:gedan_juji_uke'],note='kata-ashi'),M(0,'kiba','L',['L:uchi_uke','R:uchi_uke']),
 HA(0,'L:guard','R:guard',support='L'),K(90,'L','L:uchi_uke','R:gedan_barai'),K(0,'R','R:uchi_uke','L:gedan_barai'),K(0,'L','L:uchi_uke','R:gedan_barai'),HA(0,'L:morote_uke'),
 M(0,'moto','R',['R:shuto_uke','L:osae_uke']),Z(0,'L','L:uchi_uke'),Z(0,'R','R:gyaku_zuki'),IP('L:morote_zuki'),KICK('yoko_keage','L'),IP('L:uraken'),Z(0,'R','R:oi_zuki',kiai=True),
 KICK('yoko_keage','R'),IP('R:uraken'),B(0,'L:yoko_zuki'),KICK('yoko_keage','L'),IP('L:uraken'),B(0,'R:yoko_zuki'),B(0,'R:shuto_uchi'),Z(90,'R','L:mae_empi'),IP('R:hikite'),
 KICK('yoko_keage','L'),IP('L:uraken'),Z(0,'R','R:oi_zuki',kiai=True)]
@kata('hangetsu','high')
def _():return [H(45,'L','L:uchi_uke'),IP('R:gyaku_zuki'),H(-90,'R','R:uchi_uke'),IP('L:gyaku_zuki'),H(90,'L','L:uchi_uke'),IP('R:gyaku_zuki'),IP('R:zuki'),IP('R:zuki'),HA(0,'L:hikite','R:hikite'),
 H(180,'R','L:gedan_barai','R:uchi_uke',kiai=True),IP('L:uchi_uke'),H(0,'R','R:gedan_barai','L:uchi_uke'),IP('R:uchi_uke'),H(0,'L','L:gedan_barai','R:uchi_uke'),IP('L:uchi_uke'),
 H(90,'L','R:uchi_uke'),IP('L:gyaku_zuki'),IP('R:zuki'),H(180,'R','R:uchi_uke'),IP('R:gyaku_zuki'),IP('L:zuki'),H(-180,'L','R:uchi_uke'),IP('L:gyaku_zuki'),IP('R:zuki'),
 K(0,'L','L:uraken'),KS(0,'R'),KICK('mae_geri','L'),H(0,'L','L:gedan_barai'),IP('R:gyaku_zuki'),IP('L:age_uke'),K(0,'R','R:uraken'),KS(0,'L'),KICK('mae_geri','R'),H(0,'R','R:gedan_barai'),IP('L:gyaku_zuki'),IP('R:age_uke'),
 K(0,'L','L:uraken'),KICK('mikazuki','R',kiai=True),Z(0,'R','R:gedan_zuki'),N(0,'L','R:teisho','L:teisho')]
@kata('unsu','med')
def _():return [HA(0,'L:guard','R:guard'),N(0,'L','L:guard','R:guard'),IP('R:nukite'),N(45,'R','R:guard','L:guard'),IP('L:nukite'),N(0,'L','L:guard','R:guard'),IP('R:nukite'),
 Z(90,'L','L:shuto_uke','R:gyaku_zuki'),Z(-180,'R','R:shuto_uke','L:gyaku_zuki'),Z(180,'L','L:shuto_uke','R:gyaku_zuki'),Z(-180,'R','R:shuto_uke','L:gyaku_zuki'),
 KICK('mawashi','L'),KICK('mawashi','R'),B(0,'L:guard','R:guard'),Z(-90,'L','L:haishu_uke','R:haishu_uke'),Z(0,'R','R:haishu_uke','L:haishu_uke'),IP('L:shuto_uchi'),KICK('mae_geri','L'),Z(180,'R','R:soto_uke','L:gyaku_zuki'),
 Z(180,'L','R:shuto_uchi'),KICK('mae_geri','R'),Z(180,'L','L:soto_uke','R:gyaku_zuki'),HS(45,'L:guard','R:guard',support='R'),Z(0,'R','R:gedan_zuki'),IP('L:gedan_zuki'),IP('R:gedan_zuki'),
 F(180,'L','L:tate_shuto_uke'),Z(0,'L','R:teisho','L:teisho'),KICK('mae_geri','R',kiai=True),Z(0,'R','L:gyaku_zuki'),B(-135,'R:gedan_barai'),B(0,'L:haishu_uke'),B(180,'R:gedan_barai'),B(0,'R:haishu_uke'),
 B(0,'L:yoko_zuki'),K(-90,'R','L:haishu_uke'),JUMP(360,'kokutsu','R','R:shuto_uke',h=0.40,k='R'),SA(0,'L','R:teisho','L:teisho'),SA(0,'R','L:teisho','R:teisho'),Z(-180,'L','L:age_uke','R:gyaku_zuki',kiai=True)]
@kata('meikyo','med')
def _():return [B(0,'L:guard','R:guard'),IP('L:guard','R:guard'),Z(45,'L','L:gedan_barai'),Z(0,'R','R:oi_zuki'),Z(-90,'R','R:gedan_barai'),Z(0,'L','L:oi_zuki'),
 K(-45,'R','R:gedan_barai','L:age_uke'),IP('R:gedan_barai','L:age_uke'),IP('L:guard','R:guard'),B(45,'L:guard','R:guard'),Z(45,'L','L:uchi_uke'),Z(0,'R','R:oi_zuki'),Z(-90,'R','R:uchi_uke'),Z(0,'L','L:oi_zuki'),
 K(-45,'R','R:gedan_barai','L:age_uke'),IP('R:gedan_barai','L:age_uke'),IP('L:guard','R:guard'),B(45,'L:guard','R:guard'),Z(45,'L','L:age_uke'),Z(0,'R','R:oi_zuki'),Z(-90,'R','R:age_uke'),Z(0,'L','L:oi_zuki'),
 B(45,'L:tettsui'),KICK('mikazuki','R',kiai=True),K(0,'R','L:kakiwake_uke:level=gedan'),K(0,'L','R:morote_uke','L:morote_uke'),K(0,'R','R:morote_uke'),Z(0,'L','L:juji_uke:level=jodan'),
 Z(0,'R','R:kakiwake_uke:level=gedan'),K(0,'R','R:uchi_uke','L:gedan_barai'),K(0,'L','L:uchi_uke','R:gedan_barai'),K(180,'R','R:age_uke'),JUMP(180,'kokutsu','R','R:empi',h=0.36,kiai=True),K(0,'R','R:shuto_uke'),K(0,'L','L:shuto_uke')]
@kata('wankan','med')
def _():return [N(45,'L','L:kakiwake_uke'),N(0,'R','R:kakiwake_uke'),HS(0,'L:guard','R:guard',support='L'),Z(0,'R','L:shuto_uke'),IP('R:zuki'),IP('L:gyaku_zuki'),N(90,'L','L:gedan_barai','R:guard'),Z(0,'R','R:nukite','L:shuto_uke'),
 IP('R:zuki'),IP('L:gyaku_zuki'),N(180,'L','L:gedan_barai','R:guard'),Z(0,'R','R:nukite','L:shuto_uke'),IP('R:zuki'),IP('L:gyaku_zuki'),B(-180,'R:tettsui'),KICK('mae_geri','L'),Z(0,'L','L:zuki'),
 KICK('mae_geri','R'),Z(0,'R','R:zuki'),KICK('mae_geri','L'),Z(0,'L','L:zuki'),F(0,'R','L:yama_zuki',kiai=True)]
@kata('jiin','med')
def _():return [Z(0,'L','L:uchi_uke','R:gedan_barai'),K(90,'L','R:jodan_haishu_uke','L:gedan_barai'),K(-180,'R','L:jodan_haishu_uke','R:gedan_barai'),Z(180,'L','L:age_uke'),Z(0,'R','R:oi_zuki'),
 Z(-180,'R','R:age_uke'),Z(0,'L','L:oi_zuki'),Z(45,'L','L:gedan_barai'),B(0,'R:shuto_uchi'),B(0,'L:shuto_uchi'),B(0,'R:shuto_uchi',kiai=True),Z(-45,'L','L:kakiwake_uke'),KICK('mae_geri','R'),
 Z(0,'R','R:oi_zuki'),IP('L:gyaku_zuki'),Z(0,'L','L:uchi_uke','R:gedan_barai'),Z(90,'R','R:kakiwake_uke'),KICK('mae_geri','L'),Z(0,'L','L:oi_zuki'),IP('R:gyaku_zuki'),Z(0,'R','R:uchi_uke','L:gedan_barai'),
 B(-90,'R:tettsui'),B(180,'L:tettsui'),B(-180,'R:tettsui'),B(135,'L:tate_shuto_uke'),Z(0,'L','R:gyaku_zuki'),IP('L:zuki'),KICK('mae_geri','R'),Z(0,'R','R:gyaku_zuki'),
 Z(0,'R','R:uchi_uke','L:gedan_barai'),B(180,'L:uchi_uke','R:gedan_barai'),IP('L:gedan_barai'),IP('L:uchi_uke','R:uchi_uke'),B(0,'L:age_zuki','R:zuki',kiai=True)]
# --------- own-knowledge approximations (source gives no move list) ---------
@kata('jitte','low')
def _():return [K(0,'R','R:jodan_haishu_uke','L:jodan_haishu_uke'),IP('R:uchi_uke','L:uchi_uke'),IP('L:zuki'),IP('R:gyaku_zuki'),M(-360,'kiba','L',['R:gedan_barai']),M(90,'moto','R',['R:juji_uke:level=jodan']),
 IP('R:juji_uke:level=gedan'),Z(180,'L','L:gedan_juji_uke'),Z(0,'R','R:gedan_juji_uke'),K(180,'R','R:gedan_barai','L:gedan_barai'),K(0,'L','L:gedan_barai','R:gedan_barai'),Z(0,'R','R:kakiwake_uke'),B(90,'L:shuto_uke'),
 HA(0,'L:guard','R:guard'),K(90,'L','L:uchi_uke','R:gedan_barai'),K(0,'R','R:uchi_uke','L:gedan_barai'),K(-180,'L','L:uchi_uke','R:gedan_barai'),B(0,'L:uchi_uke','R:uchi_uke'),HA(0,'L:morote_uke'),
 Z(0,'R','R:morote_uke'),Z(0,'L','L:morote_uke'),Z(0,'R','R:gyaku_zuki'),Z(0,'L','L:oi_zuki',kiai=True)]
@kata('kanku_sho','low')
def _():return [HA(0,'L:guard'),K(90,'L','L:jodan_haishu_uke'),HA(0,'L:tate_shuto_uke'),IP('R:zuki'),IP('R:uchi_uke'),IP('L:zuki'),IP('L:uchi_uke'),Z(0,'R','R:uchi_uke','L:gedan_barai',kiai=True),
 K(0,'L','L:shuto_uke'),K(0,'R','R:shuto_uke'),Z(0,'L','R:nukite','L:osae_uke'),Z(90,'L','L:shuto_uchi'),KICK('mae_geri','R'),K(90,'R','R:uchi_uke','L:gedan_barai'),Z(-90,'L','R:nukite','L:nagashi_uke'),
 RE(0,'L','L:gedan_barai'),KICK('yoko_keage','L'),IP('L:uraken'),Z(0,'L','R:mae_empi'),KICK('yoko_keage','R'),Z(0,'R','L:mae_empi'),K(180,'L','L:shuto_uke'),K(45,'R','R:shuto_uke'),K(135,'R','R:shuto_uke'),
 K(-90,'L','L:shuto_uke'),Z(0,'L','L:shuto_uchi'),KICK('mae_geri','R'),Z(0,'R','R:oi_zuki'),IP('L:gyaku_zuki'),Z(180,'L','L:uchi_uke'),IP('R:gyaku_zuki'),Z(0,'R','R:uchi_uke'),IP('L:gyaku_zuki'),
 JUMP(-360,'zenkutsu','R','R:uraken',h=0.36),Z(0,'L','L:gedan_barai'),Z(0,'R','R:age_uke'),B(90,'L:tettsui'),KICK('mikazuki','R'),JUMP(180,'kokutsu','L','L:shuto_uke',h=0.40),
 K(0,'R','R:shuto_uke'),K(0,'L','L:shuto_uke'),Z(0,'R','R:oi_zuki'),IP('L:gyaku_zuki'),Z(180,'L','L:uchi_uke'),IP('R:gyaku_zuki',kiai=True)]
@kata('bassai_sho','low')
def _():return [KS(0,'R','R:morote_uke'),Z(90,'L','L:uchi_uke'),IP('R:uchi_uke'),Z(-180,'R','L:soto_uke'),IP('R:uchi_uke'),K(0,'L','L:morote_uke'),HS(0,'L:tate_shuto_uke',support='R'),
 IP('R:zuki'),IP('L:zuki'),K(90,'R','R:shuto_uke'),K(0,'L','L:shuto_uke'),IP('R:gyaku_zuki'),KICK('yoko_fumikomi','R'),K(180,'L','L:morote_uke'),Z(0,'R','R:morote_uke'),IP('L:age_uke'),
 Z(-90,'R','L:yama_zuki'),Z(0,'L','R:yama_zuki',kiai=True),K(90,'L','L:shuto_uke','R:gedan_barai'),K(0,'R','R:uchi_uke','L:gedan_barai'),Z(0,'L','L:oi_zuki'),Z(180,'R','R:sukui_uke'),Z(0,'L','L:sukui_uke'),
 B(0,'R:gedan_barai'),K(0,'R','R:shuto_uke'),K(0,'L','L:shuto_uke'),B(0,'R:mae_empi',kiai=True)]
@kata('chinte','low')
def _():return [HS(0,'L:guard','R:guard'),N(0,'L','L:guard','R:guard'),IP('R:teisho'),N(90,'R','L:teisho'),HS(0,'L:guard','R:guard'),Z(0,'L','R:teisho','L:osae_uke'),K(0,'R','R:shuto_uke'),
 Z(0,'L','L:tate_zuki'),Z(0,'R','R:tate_zuki'),SA(0,'L','L:teisho','R:teisho'),SA(0,'R','R:teisho','L:teisho'),Z(90,'L','L:gedan_barai'),IP('R:age_zuki'),KICK('mae_geri','R'),Z(0,'R','R:hasami'),
 B(90,'L:shuto_uke'),B(0,'R:yoko_empi'),Z(-90,'R','R:uraken'),IP('L:zuki'),IP('R:gyaku_zuki'),HS(0,'L:guard','R:guard'),Z(180,'L','L:shuto_uke'),Z(0,'R','R:nukite','L:osae_uke'),
 K(180,'R','R:gedan_barai'),K(0,'L','L:age_uke'),B(-90,'R:mae_empi','L:haishu_uke'),IP('L:tate_zuki',kiai=True),Z(90,'L','R:hasami'),Z(0,'R','L:hasami'),IP('R:zuki'),Z(0,'L','L:gedan_barai'),IP('R:gyaku_zuki',kiai=True)]
@kata('sochin','low')
def _():return [F(0,'L','L:morote_uke'),F(90,'R','R:gedan_barai','L:age_uke'),F(0,'L','L:gedan_barai','R:age_uke'),IP('L:oi_zuki'),F(-90,'R','R:uchi_uke','L:gedan_barai'),F(0,'L','L:uchi_uke','R:gedan_barai'),
 F(0,'R','R:nukite','L:osae_uke'),Z(90,'L','L:gedan_barai'),Z(0,'R','R:mae_empi'),F(180,'L','L:tate_shuto_uke'),F(0,'R','R:tate_shuto_uke'),F(0,'L','L:tate_shuto_uke'),IP('R:gyaku_zuki'),
 KICK('mae_geri','R'),Z(0,'R','R:oi_zuki'),IP('L:gyaku_zuki'),F(90,'L','L:gedan_barai','R:age_uke'),IP('R:oi_zuki'),F(180,'R','R:gedan_barai','L:age_uke'),F(0,'L','L:uchi_uke','R:gedan_barai'),
 F(0,'R','R:uchi_uke','L:gedan_barai'),B(90,'L:gedan_barai'),B(0,'R:gedan_barai'),Z(-90,'R','R:yoko_empi'),Z(0,'L','L:mae_empi'),F(-90,'R','R:age_uke','L:gedan_barai'),F(0,'L','L:age_uke','R:gedan_barai',kiai=True),
 KICK('mikazuki','R'),Z(0,'R','R:oi_zuki'),IP('L:gyaku_zuki'),KICK('mae_geri','L'),Z(0,'L','L:oi_zuki'),IP('R:gyaku_zuki'),F(180,'R','R:uchi_uke','L:gedan_barai'),F(0,'L','L:uchi_uke','R:gedan_barai'),
 F(0,'R','R:morote_uke'),F(0,'L','L:morote_uke'),Z(0,'R','R:oi_zuki'),IP('L:gyaku_zuki'),F(0,'L','L:morote_uke',kiai=True)]
@kata('nijushiho','low')
def _():return [HS(0,'L:guard','R:guard'),SA(0,'L','L:mae_empi','R:hikite'),IP('R:teisho'),SA(0,'R','R:haishu_uke'),IP('L:teisho','R:teisho'),HS(0,'L:guard','R:guard'),SA(45,'L','L:haishu_uke'),IP('R:teisho'),
 SA(-90,'R','R:uchi_uke'),IP('L:teisho'),KICK('yoko_kekomi','L'),Z(0,'L','L:teisho','R:teisho'),Z(90,'R','R:uraken'),IP('L:gyaku_zuki'),Z(0,'L','L:oi_zuki',kiai=True),Z(-180,'R','R:gedan_barai','L:age_uke'),
 K(0,'L','L:shuto_uke'),K(0,'R','R:shuto_uke'),Z(0,'L','L:teisho','R:teisho'),KICK('yoko_kekomi','R',kiai=True),Z(0,'R','R:teisho','L:teisho'),SA(90,'L','L:haishu_uke'),SA(0,'R','R:haishu_uke'),
 IP('L:teisho','R:teisho'),HS(180,'L:guard','R:guard'),N(0,'L','L:guard','R:guard'),Z(0,'R','R:gedan_barai'),IP('L:gyaku_zuki'),K(-90,'R','R:uchi_uke','L:gedan_barai'),IP('L:teisho'),
 Z(0,'L','L:oi_zuki'),IP('R:gyaku_zuki'),B(0,'R:teisho','L:teisho'),HS(0,'L:guard','R:guard')]
@kata('gojushiho_sho','low')
def _():return [N(0,'L','L:haishu_uke','R:haishu_uke'),Z(0,'R','R:haishu_uke','L:osae_uke'),IP('R:nukite'),IP('R:nukite'),IP('R:nukite'),N(90,'L','L:haishu_uke'),Z(0,'R','R:shuto_uke'),
 IP('L:gedan_zuki'),N(180,'R','R:haishu_uke'),Z(0,'L','L:shuto_uke'),IP('R:gedan_zuki'),K(-90,'R','R:shuto_uke','L:osae_uke'),Z(0,'L','L:uchi_uke'),IP('R:gyaku_zuki'),
 Z(90,'R','R:soto_uke'),KICK('mae_geri','L'),Z(0,'L','L:oi_zuki'),F(-90,'R','R:tate_shuto_uke'),F(0,'L','L:tate_shuto_uke'),Z(180,'R','R:age_uke'),Z(0,'L','L:age_uke'),Z(0,'R','R:age_uke',kiai=True),
 N(-90,'R','R:haishu_uke'),IP('L:nukite'),IP('L:nukite'),IP('L:nukite'),Z(0,'L','L:gedan_barai'),B(90,'R:yoko_empi'),B(0,'L:yoko_empi'),KICK('mikazuki','R'),Z(0,'R','R:oi_zuki'),
 N(180,'L','L:haishu_uke'),Z(0,'R','R:nukite','L:osae_uke'),K(90,'L','L:shuto_uke'),K(0,'R','R:shuto_uke'),K(0,'L','L:shuto_uke'),Z(0,'L','L:gedan_zuki'),IP('R:gyaku_zuki'),
 Z(-90,'R','R:uchi_uke'),Z(0,'L','L:uchi_uke'),F(180,'R','R:tate_shuto_uke'),Z(0,'L','L:oi_zuki',kiai=True),HS(0,'L:guard','R:guard')]
@kata('gojushiho_dai','low')
def _():return [N(0,'L','L:haishu_uke','R:haishu_uke'),Z(0,'R','R:haishu_uke','L:osae_uke'),IP('R:nukite'),IP('R:nukite'),IP('R:nukite'),Z(90,'L','L:gedan_barai'),IP('R:gyaku_zuki'),
 N(-180,'R','R:haishu_uke'),Z(0,'L','L:shuto_uke'),IP('R:gedan_zuki'),K(90,'R','R:shuto_uke','L:osae_uke'),K(0,'L','L:shuto_uke'),Z(0,'R','R:nukite','L:osae_uke'),N(180,'L','L:haishu_uke'),
 Z(0,'R','R:age_uke'),Z(0,'L','L:age_uke'),Z(0,'R','R:age_uke',kiai=True),F(-90,'L','L:tate_shuto_uke'),F(0,'R','R:tate_shuto_uke'),KICK('mikazuki','R'),Z(0,'R','R:oi_zuki'),IP('L:gyaku_zuki'),
 B(90,'L:gedan_barai'),B(0,'R:gedan_barai'),Z(180,'L','L:shuto_uke','R:shuto_uke'),K(0,'R','R:morote_uke'),Z(0,'L','L:soto_uke'),Z(0,'R','R:soto_uke'),N(90,'L','L:haishu_uke'),IP('R:nukite'),
 IP('R:nukite'),IP('R:nukite'),Z(0,'L','L:gedan_barai'),IP('R:gyaku_zuki'),KICK('mae_geri','R'),Z(0,'R','R:oi_zuki'),IP('L:gyaku_zuki'),Z(-90,'R','R:uchi_uke'),Z(0,'L','L:uchi_uke'),
 K(180,'R','R:uchi_uke','L:gedan_barai'),K(0,'L','L:uchi_uke','R:gedan_barai'),Z(0,'R','R:hasami'),B(-90,'R:yoko_empi'),B(0,'L:yoko_empi'),Z(180,'L','L:gedan_barai'),Z(0,'R','R:age_uke'),
 F(90,'R','R:tate_shuto_uke'),F(0,'L','L:tate_shuto_uke'),Z(0,'R','R:oi_zuki'),IP('L:gyaku_zuki'),Z(0,'L','L:age_uke'),Z(0,'R','R:age_uke',kiai=True),Z(180,'L','L:oi_zuki'),HS(0,'L:guard','R:guard')]
