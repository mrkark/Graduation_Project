"""Pose solver: high-level body parameters -> local joint quaternions (analytic IK, foot planting)."""
import numpy as np
from skel import *
D2R=np.pi/180
def Rx(a):c,s=np.cos(a),np.sin(a);return np.array([[1,0,0],[0,c,-s],[0,s,c]])
def Ry(a):c,s=np.cos(a),np.sin(a);return np.array([[c,0,s],[0,1,0],[-s,0,c]])
def Rz(a):c,s=np.cos(a),np.sin(a);return np.array([[c,-s,0],[s,c,0],[0,0,1]])
def unit(v):
    v=np.asarray(v,float);n=np.linalg.norm(v);return v/n if n>1e-9 else v
def axis_angle_R(ax,ang):
    ax=unit(ax);K=np.array([[0,-ax[2],ax[1]],[ax[2],0,-ax[0]],[-ax[1],ax[0],0]]);return np.eye(3)+np.sin(ang)*K+(1-np.cos(ang))*K@K
def signed_angle(a,b,axis):
    a=unit(a);b=unit(b);return np.arctan2(np.dot(np.cross(a,b),unit(axis)),np.dot(a,b))
def ypr(y=0,p=0,r=0): return Ry(y)@Rx(p)@Rz(r)
def frame_YZ(Y,Z):
    Y=unit(Y);Z=unit(Z-np.dot(Z,Y)*Y);X=np.cross(Y,Z);return np.stack([X,Y,Z],1)
def frame_YX(Y,X):
    Y=unit(Y);X=unit(X-np.dot(X,Y)*Y);Z=np.cross(X,Y);return np.stack([X,Y,Z],1)

FOOT_ANKLE_Y=0.078
HEEL_OFF=np.array([0,-0.078,-0.075])      # heel contact point relative to ankle (flat foot, yaw 0)
BALL_OFF=np.array([0,-0.078,0.082])        # ball-of-foot contact point
TOE_OFF=np.array([0,-0.075,0.165])        # toe tip contact

class Rig:
    def __init__(s,sk=None):
        s.sk=sk or Skel();k=s.sk;s.idx=k.idx
        # rest world rotations (3x3)
        s.R0=np.zeros((k.nj,3,3))
        for i in range(k.nj):s.R0[i]=k.rest_world[i][:3,:3]/np.linalg.norm(k.rest_world[i][:3,:3],axis=0,keepdims=True)
        s.L_thigh=np.linalg.norm(k.rest_t[s.idx['LowerLeg.L']]);s.L_shin=np.linalg.norm(k.rest_t[s.idx['Foot.L']])
        s.L_up=np.linalg.norm(k.rest_t[s.idx['LowerArm.L']]);s.L_fore=np.linalg.norm(k.rest_t[s.idx['Hand.L']])
        s.hip_x=0.105
        # finger flexion sign: fingers must curl toward the palm (palm = world -Y in the T-pose rest)
        s.fing_sign={}
        for side in 'LR':
            for nm in ['Index','Middle','Ring','Pinky']:
                for j in (1,2,3):
                    R=s.R0[s.idx[f'{nm}{j}.{side}']];s.fing_sign[(nm,j,side)]=1.0 if R[:,2]@np.array([0,-1,0])>0 else -1.0
            for j in (1,2,3):
                R=s.R0[s.idx[f'Thumb{j}.{side}']];s.fing_sign[('Thumb',j,side)]=1.0 if R[:,2]@np.array([0,-1,0])>0 else -1.0
        s.palm_local={side:s.R0[s.idx['Hand.'+side]].T@np.array([0,-1,0]) for side in 'LR'}
        s.clav_sign={}
        for side in 'LR':
            R=s.R0[s.idx['Shoulder.'+side]]
            s.clav_sign[side]=(1.0 if R[:,2]@np.array([0,1,0])>0 else -1.0, -1.0 if R[:,0]@np.array([0,0,1])>0 else 1.0)

    # ---------- foot descriptors -------------
    def foot_resolve(s,d):
        """d: dict(mode='flat'|'heel'|'ball'|'toe'|'air', p=(x,z) or xyz, yaw, pitch(+toe up), roll). returns ankle xyz, R_foot, R_toe_world_target"""
        yaw=d.get('yaw',0);pitch=d.get('pitch',0);roll=d.get('roll',0);mode=d.get('mode','flat')
        Rf=Ry(yaw)@Rx(-pitch)@Rz(roll)
        R_foot=Rf@s.R0[s.idx['Foot.L']]
        if mode=='flat':
            a=np.array([d['p'][0],FOOT_ANKLE_Y,d['p'][1]]);R_foot=Ry(yaw)@s.R0[s.idx['Foot.L']]
        elif mode in('heel','ball','toe'):
            off={'heel':HEEL_OFF,'ball':BALL_OFF,'toe':TOE_OFF}[mode]
            # anchor sits on the floor (y=0.0 sole level) at xz = p
            anchor=np.array([d['p'][0],0.0,d['p'][1]]);a=anchor-Rf@off
        else:
            a=np.asarray(d['p'],float)
        return a,R_foot,Ry(yaw)

    def _arm(s,side,S,Wt,ad,Rsh,info):
        I=s.idx;u=Wt-S;d=np.linalg.norm(u);Lmax=s.L_up+s.L_fore
        if d>Lmax*0.999:info[side+'_arm_overreach']=d-Lmax*0.999;Wt=S+u/d*Lmax*0.999;u=Wt-S;d=np.linalg.norm(u)
        u/=d
        pole=np.asarray(ad['pole'],float);pp_=pole-np.dot(pole,u)*u
        if np.linalg.norm(pp_)<1e-6:pp_=np.array([0,-1.0,0])-u[1]*u
        pp_=unit(pp_)
        a=(s.L_up**2-s.L_fore**2+d**2)/(2*d);h=np.sqrt(max(s.L_up**2-a**2,0));E=S+a*u+h*pp_
        hs=1.0 if side=='L' else -1.0
        Yu=unit(E-S);Yf=unit(Wt-E);Zu=hs*unit(np.cross(Yu,pp_))
        Ru=frame_YZ(Yu,Zu);Rf=frame_YZ(Yf,Zu)
        flex=np.arccos(np.clip(np.dot(Yu,Yf),-1,1))
        phi=0.0
        if 'palm' in ad:
            pl=s.palm_local[side];pw=Rf@pl;tgt=np.asarray(ad['palm'],float)
            tg=tgt-np.dot(tgt,Yf)*Yf;pwp=pw-np.dot(pw,Yf)*Yf
            if np.linalg.norm(tg)>1e-6 and np.linalg.norm(pwp)>1e-6:phi=signed_angle(pwp,tg,Yf)
            phi=float(np.clip(phi,-112*D2R,112*D2R))
        share=ad.get('twist_fore',0.5)
        Rf_t=axis_angle_R(Yf,phi*share)@Rf
        wf=ad.get('wrist_flex',0)*D2R;wd=ad.get('wrist_dev',0)*D2R
        return dict(q_up=m2q(Rsh.T@Ru),q_fore=m2q(Ru.T@Rf_t),q_hand=m2q(Ry(phi*(1-share))@Rx(wf)@Rz(wd)),E=E,Yf=Yf,phi=phi,Wt=Wt,flex=flex)
    # ---------- main solve ------------------
    def solve(s,P):
        k=s.sk;I=s.idx;q=k.rest_q.copy();t=k.rest_t.copy()
        # --- pelvis
        py,pp,pr=P.get('pelvis_ypr',(0,0,0));Rh=ypr(py,pp,pr);Hpos=np.asarray(P['pelvis'],float).copy()
        if P.get('auto_h',True):
            Lmax_=(s.L_thigh+s.L_shin)*0.992;ymax=1e9
            for sd in 'LR':
                A_,_,_=s.foot_resolve(P['foot'][sd]);ho=Rh@np.array([0.105 if sd=='L' else -0.105,0,0])
                dh2=(A_[0]-(Hpos[0]+ho[0]))**2+(A_[2]-(Hpos[2]+ho[2]))**2
                if dh2<Lmax_**2:ymax=min(ymax,A_[1]+np.sqrt(Lmax_**2-dh2)-ho[1])
            if Hpos[1]>ymax:Hpos[1]=ymax
        q[I['Hips']]=m2q(Rh);t[I['Hips']]=Hpos
        # --- spine chain (relative to pelvis)
        cy,cp,cr=P.get('chest_ypr',(0,0,0))
        fr={'Spine':0.28,'Spine1':0.34,'Chest':0.38}
        for n,f in fr.items():q[I[n]]=m2q(ypr(cy*f,cp*f,cr*f))
        # shoulders (clavicle)
        for side in 'LR':
            el,pr_=P.get('clav',{}).get(side,(0,0));se,sp=s.clav_sign[side]
            q[I['Shoulder.'+side]]=qmul(k.rest_q[I['Shoulder.'+side]],m2q(Rx(se*el)@Rz(sp*pr_)))
        W,_=k.fk(q,t)
        R=lambda n:W[I[n]][:3,:3]/np.linalg.norm(W[I[n]][:3,:3],axis=0,keepdims=True)
        # --- head
        ch=R('Chest');hy,hp,hr=P.get('head_ypr',(0,0,0))
        if 'look_yaw' in P:
            # head yaw so that world yaw = look_yaw (clamped relative to chest)
            fwd=ch@np.array([0,0,1]);cyaw=np.arctan2(fwd[0],fwd[2]);hy=np.clip(P['look_yaw']-cyaw,-75*D2R,75*D2R)
        q[I['Neck']]=m2q(ypr(hy*0.4,hp*0.4,hr*0.4));q[I['Head']]=m2q(ypr(hy*0.6,hp*0.6,hr*0.6))
        # --- legs
        info={'pelvis_y':Hpos[1]}
        for side in 'LR':
            fd=P['foot'][side];A,Rfoot,Ryaw=s.foot_resolve(fd)
            H=W[I['UpperLeg.'+side]][:3,3]
            u=A-H;d=np.linalg.norm(u);Lmax=s.L_thigh+s.L_shin
            if d>Lmax*0.9995:info[side+'_overreach']=d-Lmax*0.9995;A=H+u/d*Lmax*0.9995;u=A-H;d=np.linalg.norm(u)
            u/=d
            # knee pole (world): horizontal direction of knee yaw (foot yaw + bias) with optional explicit pole
            if 'knee_pole' in fd:pole=np.asarray(fd['knee_pole'],float)
            else:
                ky=fd.get('yaw',0)+P.get('knee_bias',{}).get(side,0)*D2R
                pole=np.array([np.sin(ky),0.0,np.cos(ky)])
            pp_=pole-np.dot(pole,u)*u
            if np.linalg.norm(pp_)<1e-6:pp_=np.array([0,0,1.0])-u[2]*u
            pp_=unit(pp_)
            a=(s.L_thigh**2-s.L_shin**2+d**2)/(2*d);h=np.sqrt(max(s.L_thigh**2-a**2,0))
            K=H+a*u+h*pp_
            Yt=unit(K-H);Xt=unit(np.cross(pp_,Yt));Zt=np.cross(Xt,Yt);Rt=np.stack([Xt,Yt,Zt],1)
            Ys=unit(A-K);Zs=np.cross(Xt,Ys);Rs=np.stack([Xt,Ys,Zs],1)
            Rpar=R('Hips')
            q[I['UpperLeg.'+side]]=m2q(Rpar.T@Rt);q[I['LowerLeg.'+side]]=m2q(Rt.T@Rs);q[I['Foot.'+side]]=m2q(Rs.T@Rfoot)
            # toe: keep forefoot flat on the floor (world target) when ball/toe anchored, else rest-relative
            if fd.get('mode','flat') in('ball','toe'):
                Rtoe_w=Ryaw@s.R0[I['Toe.'+side]]
                rel=Rfoot.T@Rtoe_w
                # limit dorsiflexion to 70deg
                q[I['Toe.'+side]]=m2q(rel)
            info[side+'_knee']=K;info[side+'_ankle']=A
        # --- arms
        W,_=k.fk(q,t)
        for side in 'LR':
            ad=P.get('arm',{}).get(side)
            if ad is None:continue
            S=W[I['UpperArm.'+side]][:3,3];Rsh=W[I['Shoulder.'+side]][:3,:3]/np.linalg.norm(W[I['Shoulder.'+side]][:3,:3],axis=0,keepdims=True)
            if callable(ad):
                chf=R('Chest')@np.array([0,0,1.0])
                So=W[I['UpperArm.'+('R' if side=='L' else 'L')]][:3,3]
                ctx=dict(aim_yaw=P.get('aim_yaw',0.0),S=S,So=So,Hpos=Hpos,Rh=Rh,pelvis_yaw=py,chest_yaw=np.arctan2(chf[0],chf[2]),Rchest=R('Chest'),side=side,info=info,
                         ankle={sd:info[sd+'_ankle'] for sd in 'LR'},knee={sd:info[sd+'_knee'] for sd in 'LR'})
                ad=ad(ctx)
            res=None
            if 'fist_pt' in ad:
                F=np.asarray(ad['fist_pt'],float);ax=unit(ad.get('axis',F-S));off=ad.get('knuckle',0.088)
                for _ in range(4):
                    res=s._arm(side,S,F-off*ax,ad,Rsh,info);ax=res['Yf']
            else:
                res=s._arm(side,S,np.asarray(ad['wrist'],float),ad,Rsh,info)
            q[I['UpperArm.'+side]]=res['q_up'];q[I['LowerArm.'+side]]=res['q_fore'];q[I['Hand.'+side]]=res['q_hand']
            info[side+'_elbow']=res['E'];info[side+'_twist']=res['phi'];info[side+'_wrist']=res['Wt'];info[side+'_Yf']=res['Yf'];info[side+'_flex']=res['flex']
        # --- fists
        for side in 'LR':
            f=P.get('fist',{}).get(side,0.0);th=P.get('thumb',{}).get(side,f)
            if f is None:continue
            for nm,(a1,a2,a3) in {'Index':(82,98,62),'Middle':(85,100,62),'Ring':(88,100,62),'Pinky':(90,98,60)}.items():
                for j,aa in zip((1,2,3),(a1,a2,a3)):
                    q[I[f'{nm}{j}.{side}']]=qmul(k.rest_q[I[f'{nm}{j}.{side}']],axq([1,0,0],s.fing_sign[(nm,j,side)]*aa*f*D2R))
            # thumb: fold across index/middle middle phalanges
            for j,aa in zip((1,2,3),(25,40,30)):
                q[I[f'Thumb{j}.{side}']]=qmul(k.rest_q[I[f'Thumb{j}.{side}']],axq([1,0,0],s.fing_sign[('Thumb',j,side)]*aa*th*D2R))
        return q,t,info
