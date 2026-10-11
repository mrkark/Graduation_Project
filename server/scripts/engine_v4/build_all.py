import numpy as np,json,sys
from library import *
from sample import sample
from report import rep
import glb,glbio,view
view.setup()
def lib_misc():
    out={}
    S0=S_shiz()
    for nm,(lk,ch) in {'forward':(0,0),'left':(40,15),'right':(-40,-15)}.items():
        S1=copy.deepcopy(S0);S1['look']=lk*D2R;S1['chest']=(ch*D2R,0.0,0.0)
        tl=Timeline(f'body_alignment_{nm}');tl.key(0,S0);tl.key(0.1,copy.deepcopy(S0));tl.key(0.7,S1,ease={'all':e_io,'look':e_io});tl.key(1.2,copy.deepcopy(S1));out[f'body_alignment_{nm}']=tl
    seq,ev=build_heian();out['heian_shodan_preview']=clip_from(seq,'heian_shodan_preview');out['_events']=ev
    return out
ALL={}
for f in (lib_stances,lib_transitions,lib_footwork,lib_turns,lib_arms_and_techniques,lib_kicks,lib_misc,lib_kiba_soto):ALL.update(f())
EV=ALL.pop('_events')
names=[a['name'] for a in glb.load('../showcase/karateka_lowpoly.glb')[0]['animations']]
assert set(names)<=set(ALL),(set(names)-set(ALL))
NEW=[k for k in ALL if k not in names];names=names+NEW
if __name__=='__main__':
    rep({k:ALL[k] for k in names if k.startswith('body_')},True)
    sk=view.setup()[0] if False else None
    from rig import *
    from tl import get_rig
    r=get_rig();sk=r.sk;Hi=sk.idx['Hips']
    clips=[]
    for n in names:
        tl=ALL[n];fr=sample(tl,60)
        Q=np.stack([f['q'] for f in fr]);Ht=np.stack([f['tr'][Hi] for f in fr])
        ex={'loop':bool(getattr(tl,'loop',False)),'fps':60,'rootMotion':{'hipsDelta':[round(float(x),4) for x in (Ht[-1]-Ht[0])],'rootTranslation':0}}
        if n=='heian_shodan_preview':ex['markers']=[{'move':m,'name':nm,'t':t} for m,nm,t in EV]; ex['kiai']=[{'move':9},{'move':17}]
        clips.append(dict(name=n,fps=60,q=Q,hips_t=Ht,extras=ex))
    z=np.load('final_weights.npz');weights={i:(z[f'J{i}'],z[f'W{i}']) for i in range(4)}
    sz=glbio.write('karateka_shotokan_v2.glb',weights,clips);print('written',sz,len(clips))
