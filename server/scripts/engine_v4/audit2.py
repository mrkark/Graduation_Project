from glb import *
js,bn=load('../showcase/karateka_lowpoly.glb')
nodes=js['nodes']
print('scene roots',js['scenes'][0]['nodes'])
for i in (63,64,65,66,67,68): print(i,{k:v for k,v in nodes[i].items() if k not in('children',)})
def q2m(q):
    x,y,z,w=q
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def local(n):
    M=np.eye(4)
    M[:3,:3]=q2m(n.get('rotation',[0,0,0,1]))*np.array(n.get('scale',[1,1,1]))[None,:]
    M[:3,3]=n.get('translation',[0,0,0]);return M
par={}
for i,n in enumerate(nodes):
    for c in n.get('children',[]): par[c]=i
W={}
def world(i):
    if i in W:return W[i]
    W[i]=(world(par[i]) if i in par else np.eye(4))@local(nodes[i]);return W[i]
J=js['skins'][0]['joints']
ibm=acc(js,bn,js['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
err=0
for k,j in enumerate(J):
    e=np.abs(world(j)@ibm[k]-np.eye(4)).max();err=max(err,e)
print('max |W*IBM-I|',err)
for nm in ['Root','Hips','Spine','Chest','Head','Shoulder.L','UpperArm.L','LowerArm.L','Hand.L','Index1.L','UpperLeg.L','LowerLeg.L','Foot.L','Toe.L','Toe3.L','UpperLeg.R','Foot.R']:
    j=[x for x in J if nodes[x]['name']==nm][0]
    M=world(j);print(nm,np.round(M[:3,3],3),'Y->',np.round(M[:3,1],2),'X->',np.round(M[:3,0],2),'Z->',np.round(M[:3,2],2))
