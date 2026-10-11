from library import *
def rep(L,show_all=False):
    bad={}
    for n,tl in L.items():
        fr=sample(tl);r=audit(tl,fr,verbose=False);flags=[]
        if max(r['max_slide_speed_m_s'].values())>0.02:flags.append(('slide',{k:round(float(v),3) for k,v in r['max_slide_speed_m_s'].items()}))
        if r['overreach_frames']:flags.append(('overreach',r['overreach_frames']))
        if r['com_outside_support_frames'].split('/')[0]!='0':flags.append(('com',r['com_outside_support_frames'],r['com_worst_dist_m']))
        if r['frames_floating_while_planted']:flags.append(('float',r['frames_floating_while_planted']))
        if r['knee_flex_deg(min,max)'][0]<0 or r['knee_flex_deg(min,max)'][1]>150:flags.append(('knee',r['knee_flex_deg(min,max)']))
        if r['elbow_flex_deg(min,max)'][1]>150:flags.append(('elbow',r['elbow_flex_deg(min,max)']))
        h=r['hip_external_rot_deg(min,max)']
        if h[0]<-35 or h[1]>50:flags.append(('hiprot',h))
        print(n,round(tl.T,2),flags or 'OK',('pelvis_y',r['pelvis_height_range']) if show_all else '')
        if flags:bad[n]=flags
    return bad
