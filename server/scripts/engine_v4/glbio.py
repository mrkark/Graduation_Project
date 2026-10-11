"""Write karateka GLB: repaired skin weights + new animation set (rotation channels, linear interpolation)."""
import json,struct,copy,numpy as np
from skel import *
def pad4(b):return b+b'\x00'*((4-len(b)%4)%4)
class Packer:
    def __init__(s):s.buf=bytearray();s.bvs=[];s.accs=[]
    def bv(s,data,target=None):
        off=len(s.buf);s.buf+=pad4(data) if False else data
        while len(s.buf)%4:s.buf+=b'\x00'
        d={'buffer':0,'byteOffset':off,'byteLength':len(data)}
        if target:d['target']=target
        s.bvs.append(d);return len(s.bvs)-1
    def acc(s,arr,ctype,typ,target=None,minmax=False,normalized=False):
        arr=np.ascontiguousarray(arr);dt=np.dtype(CT[ctype]);arr=arr.astype(dt)
        b=s.bv(arr.tobytes(),target)
        a={'bufferView':b,'componentType':ctype,'count':int(arr.shape[0]),'type':typ}
        if minmax:
            a['min']=[float(x) for x in np.atleast_1d(arr.min(0))];a['max']=[float(x) for x in np.atleast_1d(arr.max(0))]
        if normalized:a['normalized']=True
        s.accs.append(a);return len(s.accs)-1
def fixq(Q):
    Q=Q.copy()
    for i in range(1,len(Q)):
        flip=(Q[i]*Q[i-1]).sum(-1)<0;Q[i][flip]*=-1
    return Q
def write(path,weights,clips,src=SRC,rest_eps=2e-5,cloth=None,anim_only=False):
    """weights: {mesh_index:(J,W)} ; clips: list of dict(name, fps, q:(F,nj,4), hips_t:(F,3), extras:dict)"""
    sk=Skel(src);js=copy.deepcopy(sk.js);bn=sk.bn
    P=Packer();new=copy.deepcopy(js)
    cl_nodes=[]
    if cloth:
        for b in cloth:
            ni=len(new['nodes']);new['nodes'].append({'name':b['name'],'translation':[float(x) for x in b['t_local']],'rotation':[0.0,0.0,0.0,1.0]})
            pn=new['nodes'][sk.J[b['parent']]];pn.setdefault('children',[]).append(ni)
            new['skins'][0]['joints'].append(ni);cl_nodes.append(ni)
    if anim_only:
        new['meshes']=[];new['skins']=[];
        for k in ('materials','textures','images','samplers'):new.pop(k,None)
        for nd in new['nodes']:nd.pop('mesh',None);nd.pop('skin',None)
    else:
        # meshes
        for mi,m in enumerate(js['meshes']):
            p=m['primitives'][0];at=p['attributes'];nat={}
            for name,ai in at.items():
                a=js['accessors'][ai];arr=acc(js,bn,ai)
                if name=='JOINTS_0' and mi in weights:arr=weights[mi][0]
                if name=='WEIGHTS_0' and mi in weights:arr=weights[mi][1]
                nat[name]=P.acc(arr,a['componentType'],a['type'],34962,minmax=(name=='POSITION'))
            ia=js['accessors'][p['indices']];idx=acc(js,bn,p['indices'])
            new['meshes'][mi]['primitives'][0]['attributes']=nat
            new['meshes'][mi]['primitives'][0]['indices']=P.acc(idx.ravel(),ia['componentType'],'SCALAR',34963)
        sj=js['skins'][0];ibm=acc(js,bn,sj['inverseBindMatrices'])
        if cloth:
            ex=[]
            for b in cloth:
                Wb=sk.rest_world[b['parent']].copy();T=np.eye(4);T[:3,3]=b['t_local'];Wb=Wb@T
                ex.append(np.linalg.inv(Wb).T)
            ibm=np.concatenate([ibm.reshape(-1,4,4),np.array(ex)],0)
        new['skins'][0]['inverseBindMatrices']=P.acc(ibm,5126,'MAT4')
        for im in new['images']:
            b=js['bufferViews'][im['bufferView']];raw=bytes(bn[b.get('byteOffset',0):b.get('byteOffset',0)+b['byteLength']])
            im['bufferView']=P.bv(raw)
    # animations
    anims=[]
    for c in clips:
        F=c['q'].shape[0];times=(np.arange(F)/c['fps']).astype(np.float32)
        tacc=P.acc(times,5126,'SCALAR',minmax=True);chans=[];samps=[]
        Q=c['q'];
        for j in range(sk.nj):
            qj=fixq(Q[:,j,:])
            node=sk.J[j]
            if j==sk.idx['Hips']:
                T=c['hips_t']
                oi=P.acc(T.astype(np.float32),5126,'VEC3');samps.append({'input':tacc,'output':oi,'interpolation':'LINEAR'})
                chans.append({'sampler':len(samps)-1,'target':{'node':node,'path':'translation'}})
            ref=sk.rest_q[j];ref=ref*np.sign((ref*qj[0]).sum()) if abs((qj-ref).max())>0 else ref
            if np.abs(qj-ref).max()<rest_eps:continue
            const=np.abs(qj-qj[0]).max()<rest_eps
            if const:
                tt=P.acc(np.array([0,times[-1]],np.float32),5126,'SCALAR',minmax=True);out=np.stack([qj[0],qj[0]])
                oi=P.acc(out.astype(np.float32),5126,'VEC4');samps.append({'input':tt,'output':oi,'interpolation':'LINEAR'})
            else:
                oi=P.acc(qj.astype(np.float32),5126,'VEC4');samps.append({'input':tacc,'output':oi,'interpolation':'LINEAR'})
            chans.append({'sampler':len(samps)-1,'target':{'node':node,'path':'rotation'}})
        if cloth and c.get('cq') is not None:
            for k,ni in enumerate(cl_nodes):
                qk=fixq(c['cq'][:,k,:]);oi=P.acc(qk.astype(np.float32),5126,'VEC4');samps.append({'input':tacc,'output':oi,'interpolation':'LINEAR'})
                chans.append({'sampler':len(samps)-1,'target':{'node':ni,'path':'rotation'}})
        an={'name':c['name'],'channels':chans,'samplers':samps}
        if c.get('extras'):an['extras']=c['extras']
        anims.append(an)
    new['animations']=anims;new['accessors']=P.accs;new['bufferViews']=P.bvs;new['buffers']=[{'byteLength':len(P.buf)}]
    new['asset']['generator']=js['asset'].get('generator','')+' + procedural Shotokan rebuild'
    j=json.dumps(new,separators=(',',':')).encode();j+=b' '*((4-len(j)%4)%4)
    binb=bytes(P.buf);binb+=b'\x00'*((4-len(binb)%4)%4)
    out=struct.pack('<III',0x46546C67,2,12+8+len(j)+8+len(binb))+struct.pack('<II',len(j),0x4E4F534A)+j+struct.pack('<II',len(binb),0x004E4942)+binb
    open(path,'wb').write(out);return len(out)
