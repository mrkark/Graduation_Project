"""Sampling a Timeline into frames + biomechanical audit metrics."""
from tl import *
from scipy.spatial import ConvexHull
import matplotlib.path as mpath
def sample(tl,fps=FPS,T=None):
    r=get_rig();T=T if T is not None else tl.T;n=int(round(T*fps))+1;fr=[]
    for i in range(n):
        t=min(i/fps,T);P=tl.P(t);q,tr,info=r.solve(P);fr.append(dict(t=t,P=P,q=q,tr=tr,info=info))
    return fr
def swing_twist(q,axis):
    axis=np.asarray(axis,float);v=q[:3];p=axis*np.dot(v,axis);tw=np.array([*p,q[3]]);n=np.linalg.norm(tw)
    if n<1e-9:return 0.0
    tw/=n;ang=2*np.arctan2(np.dot(tw[:3],axis),tw[3]);ang=(ang+np.pi)%(2*np.pi)-np.pi
    sw=qmul(q,np.array([-tw[0],-tw[1],-tw[2],tw[3]]));return ang/D2R
def ang_of(q):
    return 2*np.arccos(np.clip(abs(q[3]),0,1))/D2R
SEGM={'Head':0.08,'Chest':0.22,'Spine':0.12,'Hips':0.14,'UpperLeg.L':0.10,'UpperLeg.R':0.10,'LowerLeg.L':0.045,'LowerLeg.R':0.045,'UpperArm.L':0.028,'UpperArm.R':0.028,'LowerArm.L':0.022,'LowerArm.R':0.022}
def com(sk,W):
    tot=0;c=np.zeros(3)
    for n,m in SEGM.items():
        i=sk.idx[n];p=W[i][:3,3]
        ch=[j for j in range(sk.nj) if sk.parent[j]==i]
        # segment centre ~ midpoint of joint and its main child
        if n=='Head':pc=p+np.array([0,0.1,0])
        else:
            main={'Hips':'Spine','Spine':'Chest','Chest':'Neck','UpperLeg.L':'LowerLeg.L','UpperLeg.R':'LowerLeg.R','LowerLeg.L':'Foot.L','LowerLeg.R':'Foot.R','UpperArm.L':'LowerArm.L','UpperArm.R':'LowerArm.R','LowerArm.L':'Hand.L','LowerArm.R':'Hand.R'}[n]
            pc=0.5*(p+W[sk.idx[main]][:3,3])
        c+=m*pc;tot+=m
    c+=0.055*(W[sk.idx['Foot.L']][:3,3]+W[sk.idx['Foot.R']][:3,3]);tot+=0.11
    return c/tot
def contact_points(sk,W,mode,side):
    """world heel / ball / toe-tip contact points of a foot from FK"""
    r=get_rig();i=sk.idx['Foot.'+side];Wf=W[i];R=Wf[:3,:3];R0=r.R0[i]
    loc=lambda off:R0.T@off
    pts={}
    for nm,off in (('heel',HEEL_OFF),('ball',BALL_OFF),('toe',TOE_OFF)):
        pts[nm]=Wf[:3,3]+R@loc(off)   # NB: R0 is rest foot rot; offsets are given for yaw=0 flat pose
    return pts
def audit(tl,fr,fps=FPS,verbose=True):
    sk=get_rig().sk;r=get_rig();res={}
    Ws=[sk.fk(f['q'],f['tr'])[0] for f in fr]
    # --- foot lock
    slide={'L':0,'R':0};planted_frames={'L':0,'R':0};minToe=1e9
    for i in range(1,len(fr)):
        for sd in 'LR':
            a=fr[i-1]['P']['foot'][sd];b=fr[i]['P']['foot'][sd]
            if a['mode']=='air' or b['mode']=='air':continue
            planted_frames[sd]+=1
            ca=contact_points(sk,Ws[i-1],a['mode'],sd);cb=contact_points(sk,Ws[i],b['mode'],sd)
            keys={'flat':['heel','ball'],'heel':['heel'],'ball':['ball'],'toe':['toe']}[b['mode']] if a['mode']==b['mode'] else ['ball']
            if a['mode']!=b['mode'] and {'flat','ball','heel'}>={a['mode'],b['mode']}:keys=['ball'] if 'ball' in (a['mode'],b['mode']) else ['heel']
            d=max(np.linalg.norm((cb[k]-ca[k])[[0,2]]) for k in keys)
            if a['mode']==b['mode']=='flat' and a['p']==b['p'] and a['yaw']==b['yaw']:pass
            slide[sd]=max(slide[sd],d*fps)
    res['max_slide_speed_m_s']={k:round(v,4) for k,v in slide.items()}
    # --- floor
    pen=0;floatf=0;
    M=Mesh(sk,0)
    footv=np.zeros(len(M.P),bool)
    for n in ['Foot.L','Foot.R','Toe.L','Toe.R']:footv|=((M.W*(M.J==sk.idx[n])).sum(1)>0.5)
    low_all=[];
    for i,f in enumerate(fr):
        X=M.skin(Ws[i]);y=X[:,1].min();low_all.append(y)
        for sd in 'LR':
            pass
    res['lowest_vertex_y']=(round(float(np.min(low_all)),4),round(float(np.max(low_all)),4))
    # planted-frame float: for frames where any foot is planted, lowest vertex must be ~0
    bad=0
    for i,f in enumerate(fr):
        if any(f['P']['foot'][sd]['mode']!='air' for sd in 'LR'):
            if low_all[i]>0.012:bad+=1
    res['frames_floating_while_planted']=bad;res['frames']=len(fr)
    # --- joint ranges
    knee=[];kneeoff=[];thigh_rot=[];hip_flex=[];pel_rel=[];chest_tw=[];elb=[];tw=[];headyaw=[]
    for f in fr:
        q=f['q']
        for sd in 'LR':
            qk=q[sk.idx['LowerLeg.'+sd]];fl=swing_twist(qk,[1,0,0]);knee.append(fl)
            kneeoff.append(np.sqrt(max(ang_of(qk)**2-fl**2,0)))
        for sd in 'LR':
            elb.append(f['info'][sd+'_flex']/D2R if sd+'_flex' in f['info'] else 0);tw.append(f['info'].get(sd+'_twist',0)/D2R)
    res['knee_flex_deg(min,max)']=(round(min(knee),1),round(max(knee),1));res['knee_off_axis_max']=round(max(kneeoff),1)
    res['elbow_flex_deg(min,max)']=(round(min(elb),1),round(max(elb),1));res['forearm_twist_max']=round(max(abs(x) for x in tw),1)
    # pelvis yaw relative to stance (mean of foot yaws)
    rel=[]
    for f in fr:
        P=f['P'];fy=[P['foot'][sd].get('yaw',0) for sd in 'LR']
        rel.append((((P['pelvis_ypr'][0]-np.mean(fy))+np.pi)%(2*np.pi)-np.pi)/D2R)
    res['pelvis_yaw_vs_mean_foot_deg(min,max)']=(round(min(rel),1),round(max(rel),1))
    res['chest_twist_vs_pelvis_deg_max']=round(max(abs(f['P']['chest_ypr'][0]) for f in fr)/D2R,1)
    # hip axial rotation proxy: knee-direction yaw relative to pelvis yaw (+ = external)
    tr_=[]
    for f in fr:
        P=f['P'];py=P['pelvis_ypr'][0]
        for sd in 'LR':
            fd=P['foot'][sd];ky=fd.get('yaw',0)+P.get('knee_bias',{}).get(sd,0)*D2R
            ext=(ky-py) if sd=='L' else (py-ky)
            tr_.append(((ext+np.pi)%(2*np.pi)-np.pi)/D2R)
    res['hip_external_rot_deg(min,max)']=(round(min(tr_),1),round(max(tr_),1))
    # --- balance
    out=0;worst=0;n=0
    for i,(f,Wm) in enumerate(zip(fr,Ws)):
        c=com(sk,Wm)[[0,2]];pts=[]
        for sd in 'LR':
            d=f['P']['foot'][sd]
            if d['mode']=='air':continue
            cp=contact_points(sk,Wm,d['mode'],sd)
            flatf=abs(d.get('pitch',0))<2*D2R
            ks=['heel','ball','toe'] if (flatf and d['mode'] in('ball','heel')) else {'heel':['heel'],'ball':['ball','toe'],'toe':['toe']}[d['mode']]
            for k in ks:pts.append(cp[k][[0,2]])
        if len(pts)<1:out+=1;continue
        pts=np.array(pts)
        if len(pts)>=3:
            try:
                h=ConvexHull(pts);path=mpath.Path(pts[h.vertices]);inside=path.contains_point(c)
                # distance to hull if outside
                dist=0 if inside else min(np.linalg.norm(c-p) for p in pts)
            except Exception:inside=True;dist=0
        else:
            dist=min(np.linalg.norm(c-p) for p in pts);inside=dist<0.05
        n+=1
        if not inside:out+=1;worst=max(worst,dist)
    res['com_outside_support_frames']=f'{out}/{len(fr)}';res['com_worst_dist_m']=round(float(worst),3)
    hy=[f['info']['pelvis_y'] for f in fr];res['pelvis_height_range']=(round(min(hy),3),round(max(hy),3))
    res['root_translation']=float(np.abs([f['tr'][sk.idx['Root']] - sk.rest_t[sk.idx['Root']] for f in fr]).max())
    res['overreach_frames']=sum(1 for f in fr if any('overreach' in k for k in f['info']))
    if verbose:
        for k,v in res.items():print(f'   {k}: {v}')
    return res
