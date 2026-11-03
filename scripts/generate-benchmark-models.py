"""Generate original, deterministic benchmark geometry; no downloaded model assets."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'tests/reference-bambu/models'
def box(x,y,z,offset=0):
 v=[(offset,0,0),(x+offset,0,0),(x+offset,y,0),(offset,y,0),(offset,0,z),(x+offset,0,z),(x+offset,y,z),(offset,y,z)]
 f=[(0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),(1,2,6),(1,6,5),(2,3,7),(2,7,6),(3,0,4),(3,4,7)]
 return [[v[i] for i in t] for t in f]
def write(name,triangles):
 rows=['solid benchmark']
 for t in triangles:rows.extend(['facet normal 0 0 0','outer loop',*['vertex '+' '.join(map(str,v)) for v in t],'endloop','endfacet'])
 rows+=['endsolid benchmark'];(ROOT/name).write_text('\n'.join(rows)+'\n')
def cantilever():
 # CCW X/Z polygon, extruded 12 mm along Y; 24 mm overhanging horizontal arm.
 p=[(0,0),(8,0),(8,24),(32,24),(32,32),(0,32)]
 triangles2=[(0,1,2),(0,2,5),(2,3,4),(2,4,5)]
 v=[(x,y,z) for y in [0,12] for x,z in p];out=[]
 for t in triangles2:out+=[[v[i] for i in t],[v[i+6] for i in reversed(t)]]
 for i in range(6):
  j=(i+1)%6;out+=[[v[i],v[i+6],v[j+6]],[v[i],v[j+6],v[j]]]
 return out
if __name__=='__main__':
 ROOT.mkdir(parents=True,exist_ok=True)
 write('single-colour.stl',box(20,20,20));write('supported.stl',cantilever())
 write('colour-a.stl',box(10,10,10));write('colour-b.stl',box(10,10,10,12))
 write('multicolour.stl',box(10,10,10)+box(10,10,10,12))
 write('colour-c.stl',box(10,10,10,24));write('three-colour.stl',box(10,10,10)+box(10,10,10,12)+box(10,10,10,24))
 print(ROOT)
