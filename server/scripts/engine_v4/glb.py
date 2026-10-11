import json,struct,numpy as np
def load(p):
    d=open(p,'rb').read()
    _,_,L=struct.unpack('<III',d[:12]);off=12;js=bn=None
    while off<L:
        cl,ct=struct.unpack('<II',d[off:off+8]);c=d[off+8:off+8+cl];off+=8+cl
        if ct==0x4E4F534A: js=json.loads(c)
        elif ct==0x004E4942: bn=c
    return js,bn
CT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def acc(js,bn,i):
    a=js['accessors'][i];bv=js['bufferViews'][a['bufferView']]
    dt=np.dtype(CT[a['componentType']]);n=NC[a['type']]
    off=bv.get('byteOffset',0)+a.get('byteOffset',0)
    st=bv.get('byteStride',dt.itemsize*n)
    if st==dt.itemsize*n:
        arr=np.frombuffer(bn,dt,a['count']*n,off).reshape(a['count'],n)
    else:
        arr=np.stack([np.frombuffer(bn,dt,n,off+k*st) for k in range(a['count'])])
    return arr.copy()
