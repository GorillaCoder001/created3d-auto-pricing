import type {Plate} from './types';
export function parseDuration(text:string):number|undefined{
 const value=text.trim();if(!value||!/^(?:\d+(?:\.\d+)?\s*[dhms]\s*)+$/.test(value))return;
 let seconds=0;for(const m of value.matchAll(/(\d+(?:\.\d+)?)\s*([dhms])/g))seconds+=Number(m[1])*({d:86400,h:3600,m:60,s:1}[m[2]]??0);
 return seconds>0&&seconds<=31536000?seconds:undefined;
}
export function parseGcodeStatistics(text:string,id:number,source:string):Plate|undefined{
 if(!/BambuStudio[\s_-]*\d/i.test(text))return;
 const time=text.match(/;\s*total estimated time\s*[:=]\s*([^;\r\n]+)/i);
 const seconds=time?parseDuration(time[1]):undefined;
 const weight=text.match(/^;\s*total filament (?:weight|used)\s*\[g\]\s*[:=]\s*([^\r\n]+)/im);
 if(!seconds||!weight)return;
 const parts=weight[1].trim().split(',').map(n=>n.trim());
 if(parts.length>16||parts.some(n=>!/^\d+(?:\.\d+)?$/.test(n)))return;
 const filamentGrams=parts.map(Number),grams=filamentGrams.reduce((a,b)=>a+b,0);
 if(grams<=0||grams>100000)return;
 const changes=text.match(/^;\s*(?:total )?filament changes\s*[:=]\s*(\d+)\s*$/im);
 return {id,grams,hours:seconds/3600,colours:filamentGrams.filter(n=>n>0).length,filamentGrams,source,changes:changes?Number(changes[1]):undefined,notes:['Original Bambu G-code total estimated time is used, including preparation. Model-only printing time is not substituted.','Total recorded filament weight is summed once across used filament channels. No support, purge, tower or machine preparation allowance is added again.']};
}
