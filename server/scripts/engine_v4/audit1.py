from glb import *
js,bn=load('../showcase/karateka_lowpoly.glb')
nodes=js['nodes']
sk=js['skins'][0]
J=sk['joints']
par={}
for i,n in enumerate(nodes):
    for c in n.get('children',[]): par[c]=i
def depth(i):
    d=0
    while i in par: i=par[i];d+=1
    return d
for k,j in enumerate(J):
    n=nodes[j]
    print(k,j,n['name'],'d',depth(j),'p',nodes[par[j]]['name'] if j in par else None,'t',np.round(n.get('translation',[0,0,0]),3).tolist(),'r',np.round(n.get('rotation',[0,0,0,1]),3).tolist(),'s',n.get('scale'))
print([ (i,n['name'],n.get('mesh'),n.get('skin')) for i,n in enumerate(nodes) if 'mesh' in n or i not in J][:20])
