import sys,json,time,numpy as np
from kata_defs2 import *
from sample import sample
import glbio,cloth_phys as cp
from qsmooth import adaptive_smooth,maxrot
from tl import get_rig
r=get_rig();sk=r.sk;Hi=sk.idx['Hips'];B=cp.build_bones(sk)
z=np.load('final_weights.npz');cw=np.load('cloth_weights.npz');weights={0:(z['J0'],z['W0']),1:(z['J1'],z['W1']),2:(cw['J2'],cw['W2']),3:(cw['J3'],cw['W3'])}
VARIANT='JKA-style Shotokan, source outlines themartialway.com.au + own knowledge; see kata_data/*.json conf'
def export_clip(name,tl,extras,path,anim_only=False):
    fr=sample(tl,60);Q=np.stack([f['q'] for f in fr]);Tr=np.stack([f['tr'] for f in fr]);Ht=Tr[:,Hi]
    m0,n0=maxrot(Q);Qs,fx=adaptive_smooth(Q);m1,n1=maxrot(Qs)
    # smoothed quats must replace the ones used for the cloth sim
    cq=cp.simulate(sk,B,Qs,Tr,60)
    ex=dict(loop=False,fps=60,rootMotion={'hipsDelta':[round(float(x),4) for x in (Ht[-1]-Ht[0])],'rootTranslation':0},clothBones=len(B),smoothing={'maxDegPerFrameBefore':round(m0,1),'after':round(m1,1),'jointsFixed':int(fx)});ex.update(extras)
    sz=glbio.write(path,weights,[dict(name=name,fps=60,q=Qs,hips_t=Ht,cq=cq,extras=ex)],cloth=B,anim_only=anim_only)
    return sz,(m0,n0,m1,n1)
def run_kata(nm):
    d=KATA[nm];mv=d['fn']();seq,ev=build_kata(nm,mv,start_stance=d['start'])
    ex=dict(kata=nm,confidence=d['conf'],variant=VARIANT,moves=[dict(n=e[0],tech=e[1],form=e[2],t0=e[3],t1=e[4],kiai=bool(e[5])) for e in ev],kiaiMoves=[e[0] for e in ev if e[5]])
    sz,st=export_clip(nm,seq.tl,ex,f'out4/kata_{nm}.glb')
    export_clip(nm,seq.tl,ex,f'out4/anim_only/kata_{nm}.glb',anim_only=True)
    json.dump(dict(kata=nm,confidence=d['conf'],moves=mv,events=ex['moves'],duration=seq.t),open(f'kata_data/{nm}.json','w'),default=lambda o:o.tolist() if hasattr(o,'tolist') else str(o),indent=0)
    print(nm,'ok',round(seq.t,1),'s',sz//1024,'KB rot before/after',st,flush=True)
if __name__=='__main__':
    for n in sys.argv[1:]:
        t=time.time();run_kata(n);print('  took',round(time.time()-t),'s',flush=True)
