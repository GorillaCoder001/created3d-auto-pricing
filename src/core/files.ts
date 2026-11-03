import {unzipSync,strFromU8} from 'fflate';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {parseGcodeStatistics} from './gcode-statistics';
import type {Analysis,Config,Plate} from './types';
export const MAX_FILE=80*1024*1024, MAX_TRIANGLES=400000;
const arr=(v:any):any[]=>v==null?[]:Array.isArray(v)?v:[v];
const xmlParser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',removeNSPrefix:true,processEntities:false,parseAttributeValue:false});
function xml(text:string){if(text.length>80*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(text)||XMLValidator.validate(text)!==true)throw Error('Invalid or unsupported XML.');return xmlParser.parse(text);}
function finite(n:unknown){const v=Number(n);if(!Number.isFinite(v)||Math.abs(v)>1e7)throw Error('Invalid mesh coordinate.');return v;}
export function parseSTL(buffer:ArrayBuffer):Float32Array{
 const v=new DataView(buffer);let count=buffer.byteLength>=84?v.getUint32(80,true):0;
 if(count>0&&84+count*50<=buffer.byteLength&&buffer.byteLength-(84+count*50)<1024){
  if(count>MAX_TRIANGLES)throw Error(`Too many triangles. Limit: ${MAX_TRIANGLES.toLocaleString()}.`);
  const p=new Float32Array(count*9);for(let i=0;i<count;i++)for(let j=0;j<9;j++)p[i*9+j]=finite(v.getFloat32(84+i*50+12+j*4,true));return p;
 }
 const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
 if(!/^\s*solid\b/i.test(text)||!/(?:endfacet)\b/i.test(text))throw Error('Invalid binary or ASCII STL.');
 const values:number[]=[];const re=/\bvertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/gi;let match;
 while((match=re.exec(text))){if(values.length>=MAX_TRIANGLES*9)throw Error('Too many STL triangles.');values.push(finite(match[1]),finite(match[2]),finite(match[3]));}
 if(values.length<9||values.length%9!==0)throw Error('Incomplete STL triangles.');return new Float32Array(values);
}
export interface ZipEntry {name:string;size:number;compressed:number;}
export function inspectZip(buffer:ArrayBuffer):ZipEntry[]{
 const v=new DataView(buffer);let eocd=-1;
 for(let p=buffer.byteLength-22;p>=Math.max(0,buffer.byteLength-65557);p--)if(v.getUint32(p,true)===0x06054b50){eocd=p;break;}
 if(eocd<0||v.getUint16(eocd+4,true)!==0||v.getUint16(eocd+6,true)!==0)throw Error('Invalid or multi-disk 3MF archive.');
 const count=v.getUint16(eocd+10,true),centralSize=v.getUint32(eocd+12,true);let p=v.getUint32(eocd+16,true);
 if(count>2000||count===65535||centralSize===0xffffffff||p+centralSize>eocd)throw Error('Archive directory is too large or unsupported ZIP64.');
 const result:ZipEntry[]=[];let total=0;const names=new Set<string>();
 for(let i=0;i<count;i++){
  if(p+46>eocd||v.getUint32(p,true)!==0x02014b50)throw Error('Invalid archive directory.');
  const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),compressed=v.getUint32(p+20,true),size=v.getUint32(p+24,true),length=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true);
  if(p+46+length+extra+comment>eocd)throw Error('Truncated archive directory.');
  const name=strFromU8(new Uint8Array(buffer,p+46,length));
  if(flags&1||![0,8].includes(method)||name.includes('\\')||name.split('/').includes('..')||name.startsWith('/')||names.has(name.toLowerCase()))throw Error('Unsafe, encrypted or duplicate archive entry.');
  total+=size;if(size>100*1024*1024||total>220*1024*1024||size>2*1024*1024&&size/Math.max(1,compressed)>500)throw Error('Archive exceeds decompression limits.');
  names.add(name.toLowerCase());result.push({name,size,compressed});p+=46+length+extra+comment;
 }
 return result;
}
export function parseSliceInfo(text:string,entries:ZipEntry[]):Plate[]{
 const data=xml(text);const plates:Plate[]=[];
 for(const p of arr(data.config?.plate)){
  const fields=Object.fromEntries(arr(p.metadata).map(m=>[m.key,m.value]));
  const id=Number(fields.index),seconds=Number(fields.prediction);let grams=Number(fields.weight);
  const filaments=arr(p.filament);if(!Number.isFinite(grams))grams=filaments.reduce((sum,f)=>sum+Number(f.used_g??f.used_weight??NaN),0);
  const gcode=entries.find(e=>new RegExp(`(?:^|/)plate_${id}\\.gcode$`,'i').test(e.name)&&e.size>0);
  if(!Number.isInteger(id)||id<1||plates.some(v=>v.id===id)||!Number.isFinite(seconds)||seconds<=0||seconds>31536000||!Number.isFinite(grams)||grams<=0||grams>100000)continue;
  const tools=new Set(arr(p.nozzle).map(n=>Number(n.extruder_id)).filter(n=>Number.isInteger(n)&&n>0)).size||undefined;
  const used=filaments.filter(f=>Number(f.used_g??f.used_weight)>0);
  plates.push({id,grams,hours:seconds/3600,colours:used.length,tools,metadataOnly:!gcode,source:'Bambu slice_info.config'+(gcode?' + '+gcode.name:' (stored metadata only)'),notes:[!gcode?'No matching G-code is stored. These are original saved slice totals; confirm they still match the model and settings.':'Matching G-code entry is present. Numeric metadata totals are used without adding waste or preparation twice.']});
 }
 return plates;
}
function modelPath(base:string,path:string){const parts=(path.startsWith('/')?path:base.slice(0,base.lastIndexOf('/')+1)+path).split('/');const out:string[]=[];for(const p of parts){if(p==='..'){if(!out.length)throw Error('Unsafe component path.');out.pop();}else if(p&&p!=='.')out.push(p);}return out.join('/');}
const identity=[1,0,0,0,1,0,0,0,1,0,0,0];
function transform(value?:string){if(!value)return identity;const n=value.trim().split(/\s+/).map(finite);if(n.length!==12)throw Error('Invalid 3MF transform.');return n;}
function point(m:number[],x:number,y:number,z:number){return [m[0]*x+m[3]*y+m[6]*z+m[9],m[1]*x+m[4]*y+m[7]*z+m[10],m[2]*x+m[5]*y+m[8]*z+m[11]];}
export function parse3MF(buffer:ArrayBuffer){
 const entries=inspectZip(buffer),warnings:string[]=[];
 const files=unzipSync(new Uint8Array(buffer),{filter:e=>/\.model$|slice_info\.config$|(?:project|model)_settings\.config$|^_rels\/\.rels$/i.test(e.name)});
 let plates:Plate[]=[];const info=Object.entries(files).find(([n])=>/slice_info\.config$/i.test(n));
 if(info){try{plates=parseSliceInfo(strFromU8(info[1]),entries);}catch{warnings.push('Slice summary could not be validated; geometry/manual mode remains available.');}}
 const sliced=entries.some(e=>/\.gcode$/i.test(e.name));

 const sliceNotes:string[]=[];
 for(const entry of entries.filter(e=>/plate_\d+\.gcode$/i.test(e.name))){
  if(entry.size>32*1024*1024){sliceNotes.push(`${entry.name}: G-code summary scan skipped above 32 MB; stored metadata is used if available.`);continue;}
  const bytes=unzipSync(new Uint8Array(buffer),{filter:e=>e.name===entry.name})[entry.name];
  const text=strFromU8(bytes.subarray(0,Math.min(bytes.length,128*1024)))+'\n'+strFromU8(bytes.subarray(Math.max(128*1024,bytes.length-128*1024)));
  const id=Number(entry.name.match(/plate_(\d+)\.gcode$/i)![1]),header=parseGcodeStatistics(text,id,entry.name+' summary');
  if(!header)continue;
  const existing=plates.find(p=>p.id===id);
  const weightRounding=.005*((header.filamentGrams?.length??header.colours)+1)+1e-6;
  if(existing&&(Math.abs(existing.grams-header.grams)>weightRounding||Math.abs(existing.hours-header.hours)*3600>1)){
   plates=plates.filter(p=>p.id!==id);sliceNotes.push(`Plate ${id}: conflicting G-code and slice metadata totals. No automatic statistics selected; verify the original slice and enter manual totals.`);continue;
  }
  if(existing){header.tools=existing.tools;header.grams=existing.grams;header.source+=' + validated slice metadata total';}
  plates=plates.filter(p=>p.id!==id);plates.push(header);
 }
 if(!plates.length)sliceNotes.push(sliced?'No usable complete Bambu filament/time summary found. Geometry/manual mode is required.':'No complete saved slice statistics found. A .3mf extension does not imply the model was sliced.');
 else sliceNotes.push(...plates.map(p=>`Plate ${p.id}: ${p.source}.`));
 let project:Analysis['project']={colourEvidence:[]};
 const colourEvidence=project.colourEvidence!;const assigned=new Set<string>();let painted=false,geometryBlocked:string|undefined;
 const settings=Object.entries(files).find(([n])=>/project_settings\.config$/i.test(n));
 if(settings){try{
  const p=JSON.parse(strFromU8(settings[1])),first=(v:any)=>Array.isArray(v)?v[0]:v;
  const number=(v:any)=>{const n=Number(String(first(v)??'').replace('%',''));return Number.isFinite(n)&&String(first(v)??'')!==''?n:undefined;};
  const imported:Partial<Config>={};
  for(const [field,key] of Object.entries({layer:'layer_height',infill:'sparse_infill_density',walls:'wall_loops',topLayers:'top_shell_layers',bottomLayers:'bottom_shell_layers',lineWidth:'line_width'})){const n=number(p[key]);if(n!==undefined)(imported as any)[field]=n;}
  const densities=arr(p.filament_density).map(Number).filter(n=>Number.isFinite(n)&&n>0&&n<=10);if(densities.length&&new Set(densities).size===1)imported.density=densities[0];
  if(imported.lineWidth===0)delete imported.lineWidth;
  if(p.enable_support!==undefined)imported.supports=['1','true'].includes(String(first(p.enable_support)));
  const palette=arr(p.filament_colour??p.filament_color);const configuredColours=palette.length;
  if(configuredColours)colourEvidence.push(`${configuredColours} configured filament slot(s); this alone does not establish which slots are used.`);
  project={...project,printer:String(first(p.printer_model??p.printer_settings_id)??''),nozzle:number(p.nozzle_diameter),material:String(first(p.filament_type)??''),configuredColours,settings:imported};
 }catch{warnings.push('Project settings could not be read.');}}
 const modelSettings=Object.entries(files).find(([n])=>/model_settings\.config$/i.test(n));
 if(modelSettings){try{
  const data=xml(strFromU8(modelSettings[1]));
  for(const object of arr(data.config?.object))for(const part of [object,...arr(object.part)]){
   if(part.subtype&&part.subtype!=='normal_part')geometryBlocked='This project contains negative volumes, modifiers or nonstandard parts. Their boolean/process effects are not supported; use saved slice statistics or manual totals.';
   for(const m of arr(part.metadata))if(['extruder','wall_filament','sparse_infill_filament','solid_infill_filament','support_filament','support_interface_filament'].includes(m.key)&&Number(m.value)>0)assigned.add(String(m.value));
  }
 }catch{warnings.push('Part settings could not be read; per-part colours and process settings remain unknown.');}}
 try{
 const parsed=new Map<string,any>();for(const [name,data] of Object.entries(files))if(/\.model$/i.test(name)){const text=strFromU8(data);if(/(?:paint_color|mmu_segmentation)=["'][^"']*[1-9a-f][^"']*["']/i.test(text))painted=true;parsed.set(name,xml(text).model);}
 const usedCount=Math.max(0,...plates.map(p=>p.colours));
 const firstTools=plates[0]?.tools;if(firstTools)project.settings={...project.settings,dual:firstTools>1};
 if(usedCount>0){project.colours=usedCount;colourEvidence.push(`Saved slice records ${usedCount} used filament channel(s).`);}
 else if(!painted&&assigned.size>0){project.colours=assigned.size;colourEvidence.push(`${assigned.size} distinct assigned extruder/filament IDs found in part settings; painted subregions may add more.`);}
 if(painted){project.painted=true;colourEvidence.push('Painted colour segmentation is present. Its encoded palette is not reconstructed in the preview; exact used-colour count may be unknown.');}
 if(!project.colours)colourEvidence.push('Used-colour count is unknown. One display colour in the preview is not evidence of one filament.');
 warnings.push(...colourEvidence,...sliceNotes);
 if(parsed.size>100)throw Error('Too many 3MF model files.');
 let root='3D/3dmodel.model';const rel=files['_rels/.rels'];if(rel){const data=xml(strFromU8(rel));const start=arr(data.Relationships?.Relationship).find(r=>String(r.Type).endsWith('/3dmodel'));if(start)root=modelPath('',start.Target);}
 if(!parsed.has(root))root=[...parsed.keys()][0];
 const rootModel=parsed.get(root);if(!rootModel){if(plates.length)return {positions:new Float32Array(),parts:0,warnings:[...warnings,'This sliced archive has no model geometry; dimensions and mesh checks are unavailable.'],plates,sliced,project,sliceNotes,geometryBlocked};throw Error('No 3MF geometry or validated slice statistics found. Use manual estimates.');}
 const units:Record<string,number>={micron:0.001,millimeter:1,centimeter:10,inch:25.4,foot:304.8,meter:1000};
 const scale=units[rootModel.unit??'millimeter'];if(!scale)throw Error('Unsupported 3MF unit.');
 const output:number[]=[];let parts=0,instances=0;
 function emit(path:string,id:string,chain:number[][],seen:Set<string>){
  if(chain.length>24||++instances>4000)throw Error('3MF component nesting or instance limit exceeded.');
  const key=path+'#'+id;if(seen.has(key))throw Error('Circular 3MF component.');const next=new Set(seen).add(key);
  const model=parsed.get(path);if(!model)throw Error('Missing external 3MF component.');
  if((units[model.unit??'millimeter']??NaN)!==scale)throw Error('Mixed-unit component files are not supported.');
  const object=arr(model.resources?.object).find(o=>String(o.id)===String(id));if(!object)throw Error('Missing 3MF object.');
  if(object.mesh){
   if(object.type&&object.type!=='model')return;
   const vertices=arr(object.mesh.vertices?.vertex),triangles=arr(object.mesh.triangles?.triangle);parts++;
   if(output.length+triangles.length*9>MAX_TRIANGLES*9)throw Error('Too many mesh triangles.');
   for(const t of triangles)for(const index of [t.v1,t.v2,t.v3]){const i=Number(index);if(!Number.isInteger(i)||i<0||i>=vertices.length)throw Error('Invalid 3MF triangle index.');const v=vertices[i];let p=[finite(v.x),finite(v.y),finite(v.z)];for(const m of chain)p=point(m,p[0],p[1],p[2]);output.push(...p.map(n=>finite(n*scale)));}
  }else for(const component of arr(object.components?.component))emit(component.path?modelPath(path,component.path):path,component.objectid,[transform(component.transform),...chain],next);
 }
 const build=arr(rootModel.build?.item).filter(item=>item.printable!=='0');
 if(!build.length)throw Error('No printable build items in 3MF.');
 for(const item of build)emit(item.path?modelPath(root,item.path):root,item.objectid,[transform(item.transform)],new Set());
 warnings.push('Project geometry includes printable build items across all plates. Bounds are project-wide; select each sliced plate separately.','Modifiers, negative volumes, per-part process overrides and painted regions are not applied to geometry estimates.');
 return {positions:new Float32Array(output),parts,warnings,plates,sliced,project,sliceNotes,geometryBlocked};
 }catch(error){if(plates.length)return {positions:new Float32Array(),parts:0,warnings:[...warnings,`Geometry preview unavailable: ${error instanceof Error?error.message:'Unsupported geometry'}`],plates,sliced,project,sliceNotes,geometryBlocked};throw error;}
}
export function analysePositions(positions:Float32Array):Omit<Analysis,'plates'|'sliced'|'parts'>{
 if(!positions.length||positions.length%9)throw Error('No complete mesh triangles found.');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],vertexIds=new Map<string,number>();
 const edges=new Map<string,{count:number;direction:number;face:number}>(),parent:number[]=[],faceVolumes:number[]=[];
 let area=0,degenerate=0,sideArea=0,topProjectedArea=0,bottomProjectedArea=0,overhangArea=0;
 const find=(n:number):number=>{while(parent[n]!==n){parent[n]=parent[parent[n]];n=parent[n];}return n;};
 const join=(a:number,b:number)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
 for(let i=0;i<positions.length;i+=9){
  const face=i/9;parent.push(face);const ids:number[]=[];
  for(let j=0;j<9;j+=3){const coords=[];for(let k=0;k<3;k++){const n=finite(positions[i+j+k]);min[k]=Math.min(min[k],n);max[k]=Math.max(max[k],n);coords.push(Math.round(n*1e5));}const key=coords.join(',');if(!vertexIds.has(key))vertexIds.set(key,vertexIds.size);ids.push(vertexIds.get(key)!);}
  const [ax,ay,az,bx,by,bz,cx,cy,cz]=positions.subarray(i,i+9);const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
  const triangleArea=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)/2;area+=triangleArea;if(triangleArea<1e-9)degenerate++;
  faceVolumes.push((ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6);
  for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=Math.min(a,b)+':'+Math.max(a,b),old=edges.get(key),direction=a<b?1:-1;if(old){old.count++;old.direction+=direction;join(face,old.face);}else edges.set(key,{count:1,direction,face});}
 }
 for(let i=0;i<positions.length;i+=9){const [ax,ay,az,bx,by,bz,cx,cy,cz]=positions.subarray(i,i+9),ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;sideArea+=Math.hypot(nx,ny)/2;if(nz>0)topProjectedArea+=nz/2;else bottomProjectedArea-=nz/2;if(nz< -Math.SQRT1_2*Math.hypot(nx,ny,nz)&&Math.max(az,bz,cz)>min[2]+0.01)overhangArea+=Math.hypot(nx,ny,nz)/2;}
 let openEdges=0,nonManifold=0,inconsistent=0;for(const e of edges.values()){if(e.count===1)openEdges++;else if(e.count!==2)nonManifold++;else if(e.direction!==0)inconsistent++;}
 const volumes=new Map<number,number>();faceVolumes.forEach((v,i)=>{const root=find(i);volumes.set(root,(volumes.get(root)??0)+v);});const volume=[...volumes.values()].reduce((s,v)=>s+Math.abs(v),0);
 const warnings:string[]=[];if(openEdges||nonManifold||inconsistent||degenerate)warnings.push('Mesh needs review: open edges, degeneracies, winding or non-manifold geometry detected. Use manual or slicer statistics.');
 warnings.push('Topology check does not detect self-intersections, nested solids or intersecting parts. STL units are assumed to be millimetres.');
 return {positions,dimensions:max.map((n,i)=>n-min[i]) as [number,number,number],volume,area,sideArea,topProjectedArea,bottomProjectedArea,overhangArea,triangles:positions.length/9,openEdges,nonManifold,inconsistent,degenerate,watertight:!openEdges&&!nonManifold&&!inconsistent&&!degenerate&&volume>0,warnings};
}
export function analyseFile(buffer:ArrayBuffer,name:string):Analysis{
 if(buffer.byteLength>MAX_FILE)throw Error('File exceeds 80 MB.');
 if(/\.stl$/i.test(name))return {...analysePositions(parseSTL(buffer)),parts:1,plates:[],sliced:false};
 if(/\.3mf$/i.test(name)){const p=parse3MF(buffer),a=p.positions.length?analysePositions(p.positions):{positions:p.positions,dimensions:[0,0,0] as [number,number,number],volume:0,area:0,triangles:0,openEdges:0,nonManifold:0,inconsistent:0,degenerate:0,watertight:false,warnings:[]};return {...a,...p,warnings:[...p.warnings,...a.warnings]};}
 throw Error('Unsupported model format.');
}
export function sampleCoaster():Float32Array{
 const p:number[]=[],segments=64,r=40,z=4;
 const triangle=(...v:number[])=>p.push(...v);
 for(let i=0;i<segments;i++){const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments,ax=r*Math.cos(a),ay=r*Math.sin(a),bx=r*Math.cos(b),by=r*Math.sin(b);triangle(0,0,z,ax,ay,z,bx,by,z);triangle(0,0,0,bx,by,0,ax,ay,0);triangle(ax,ay,0,bx,by,0,bx,by,z);triangle(ax,ay,0,bx,by,z,ax,ay,z);}
 return new Float32Array(p);
}
