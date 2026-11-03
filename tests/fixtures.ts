import {zipSync,strToU8} from 'fflate';
export const tetraVertices='0 0 0;10 0 0;0 10 0;0 0 10'.split(';').map(v=>v.split(' ').map(Number));
export const tetraTriangles=[[0,2,1],[0,1,3],[0,3,2],[1,2,3]];
export const tetraPositions=new Float32Array(tetraTriangles.flatMap(t=>t.flatMap(i=>tetraVertices[i])));
export function binarySTL(){const b=new ArrayBuffer(84+4*50),v=new DataView(b);new Uint8Array(b).set(new TextEncoder().encode('solid binary header'));v.setUint32(80,4,true);for(let i=0;i<4;i++)for(let j=0;j<9;j++)v.setFloat32(84+i*50+12+j*4,tetraPositions[i*9+j],true);return b;}
export function asciiSTL(){return new TextEncoder().encode('solid tetra\n'+tetraTriangles.map(t=>'facet normal 0 0 0\nouter loop\n'+t.map(i=>'vertex '+tetraVertices[i].join(' ')).join('\n')+'\nendloop\nendfacet').join('\n')+'\nendsolid tetra').buffer;}
export const meshXML=`<mesh><vertices>${tetraVertices.map(v=>`<vertex x="${v[0]}" y="${v[1]}" z="${v[2]}"/>`).join('')}</vertices><triangles>${tetraTriangles.map(t=>`<triangle v1="${t[0]}" v2="${t[1]}" v3="${t[2]}"/>`).join('')}</triangles></mesh>`;
export const modelXML=`<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model">${meshXML}</object></resources><build><item objectid="1"/></build></model>`;
export const sliceXML='<config><plate><metadata key="index" value="1"/><metadata key="prediction" value="7200"/><metadata key="weight" value="100"/><filament id="1" used_g="100"/></plate></config>';
export function archive(files:Record<string,string>){const z=zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)])));return z.buffer.slice(z.byteOffset,z.byteOffset+z.byteLength) as ArrayBuffer;}
export function threeMF(sliced=false){return archive({'3D/3dmodel.model':modelXML,'Metadata/project_settings.config':JSON.stringify({printer_model:'Bambu Lab X2D',nozzle_diameter:['0.4','0.4'],filament_type:['PLA']}),...(sliced?{'Metadata/plate_1.gcode':'; synthetic test fixture, not a printable job','Metadata/slice_info.config':sliceXML}:{})});}
