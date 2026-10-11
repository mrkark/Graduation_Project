from skel import *
sk=Skel();js=sk.js;N=js['nodes']
meshes=[Mesh(sk,i) for i in range(4)]
# read animations
def read_anim(a):
    ch={}
    for c in a['channels']:
        smp=a['samplers'][c['sampler']];tn=c['target']['node'];path=c['target']['path']
        if tn not in sk.J:continue
        ch[(sk.J.index(tn),path)]=(acc(js,sk.bn,smp['input']).ravel(),acc(js,sk.bn,smp['output']))
    return ch
def sample(ch,t):
    q=sk.rest_q.copy();tr=sk.rest_t.copy()
    for (j,p),(ts,v) in ch.items():
        i=np.searchsorted(ts,t);
        if i<=0:val=v[0]
        elif i>=len(ts):val=v[-1]
        else:
            f=(t-ts[i-1])/(ts[i]-ts[i-1]);val=v[i-1]*(1-f)+v[i]*f
        if p=='rotation':q[j]=val/np.linalg.norm(val)
        elif p=='translation':tr[j]=val
    return q,tr
if __name__=='__main__':
    A={a['name']:a for a in js['animations']}
    print({k:(round(float(acc(js,sk.bn,A[k]['samplers'][0]['input']).max()),2),len(A[k]['channels'])) for k in list(A)[:6]})
    legm=meshes[0]
    for name in ['zenkutsu_dachi_left','kokutsu_dachi_left','gyaku_zuki_right','mae_geri_left','turn_left','heian_shodan_preview']:
        ch=read_anim(A[name]);T=max(ts[-1] for ts,_ in ch.values())
        rows=[]
        for t in np.linspace(0,T,9):
            q,tr=sample(ch,t);W,_=sk.fk(q,tr)
            fl=sk.pos(W,'Foot.L');fr=sk.pos(W,'Foot.R');tl=sk.pos(W,'Toe.L');tr_=sk.pos(W,'Toe.R')
            rows.append((round(t,2),fl.round(2).tolist(),fr.round(2).tolist(),round(min(tl[1],tr_[1]),3),sk.pos(W,'Hips').round(2).tolist()))
        print('\n',name,'T=',round(T,2));[print('  ',r) for r in rows]
