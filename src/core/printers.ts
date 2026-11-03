import type {Config,PrinterId} from './types';
export interface PrinterProfile {size:[number,number,number];dualSize?:[number,number,number];excluded?:[number,number];note:string;source:string;}
const repo='https://github.com/bambulab/BambuStudio/tree/master/resources/profiles/BBL/machine';
export const printers:Record<PrinterId,PrinterProfile>={
 'X2D':{size:[256,256,260],dualSize:[235.5,256,256],note:'Main nozzle: 256 × 256 × 260 mm. Both nozzles: conservative intersection 235.5 × 256 × 256 mm. Same nozzle diameter on both hotends.',source:'https://blog.bambulab.com/two-extruders-one-purpose-what-is-x2d-direct-drive-extrusion-and-auxiliary-extrusion/'},
 'H2D':{size:[325,320,325],dualSize:[300,320,325],note:'Single nozzle: 325 × 320 × 325 mm. Both nozzles: 300 × 320 × 325 mm intersection, not the 350 mm union. Same nozzle diameter assumed.',source:'https://cdn1.bambulab.com/documentation/h2d/en/H2D_Laser_Full_Combo_20250305.pdf'},
 'X1 Carbon':{size:[256,256,256],excluded:[18,28],note:'18 × 28 mm cutter exclusion at the bed corner. Full-bed bounding boxes require arrangement in Bambu Studio.',source:repo},
 'P1S':{size:[256,256,256],excluded:[18,28],note:'18 × 28 mm cutter exclusion at the bed corner. Full-bed bounding boxes require arrangement in Bambu Studio.',source:repo},
 'P2S':{size:[256,256,256],note:'Bounding-box check only; wrapping and purge exclusions still need slicer verification.',source:repo},
 'A1':{size:[256,256,256],note:'Open-frame printer. ABS and ASA require controlled conditions; enclosure and material suitability are not certified here.',source:repo},
 'A1 mini':{size:[180,180,180],note:'Open-frame printer. ABS and ASA require controlled conditions; enclosure and material suitability are not certified here.',source:repo}
};
export function buildSize(c:Config){const p=printers[c.printer];return c.dual&&p.dualSize?p.dualSize:p.size;}
export function compatibility(dimensions:[number,number,number],c:Config){
 const size=buildSize(c),d=dimensions.map(n=>n*c.scale/100),p=printers[c.printer];
 if(![0.2,0.4,0.6,0.8].includes(c.nozzle))return {fits:false,message:'Unsupported nozzle diameter.'};
 if(c.dual&&!p.dualSize)return {fits:false,message:'This printer does not have two nozzles.'};
 if(d.some((n,i)=>n>size[i]+0.001))return {fits:false,message:'Exceeds build area in the current orientation. Resize or arrange in Bambu Studio.'};
 if(p.excluded&&!(d[0]<=size[0]-p.excluded[0]||d[1]<=size[1]-p.excluded[1]))return {fits:false,message:'Bounding box cannot clear the cutter exclusion. Verify mesh placement in Bambu Studio.'};
 return {fits:true,message:'Within nominal build area. Confirm placement, skirts, purge tower and clearances in Bambu Studio.'};
}
export const calibrationKey=(c:Config)=>['surface-v2',c.printer,c.material,c.nozzle,c.quality].join('|');
