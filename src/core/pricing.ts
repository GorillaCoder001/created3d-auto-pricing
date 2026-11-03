import {defaults,materials,printerIds,type Config,type Settings,type Estimate,type Price,type Analysis} from './types';
import {estimateGeometry} from './estimation';
export function validNumber(n:unknown,max=1e7):n is number{return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;}
export function validateSettings(input:unknown):Settings{
 if(!input||typeof input!=='object')throw Error('Invalid settings file.');
 const s=input as Settings;
 if(s.version!==1)throw Error('Unsupported settings version.');
 for(const key of Object.keys(defaults) as (keyof Settings)[]){if(['materialPrices','machineRates','powerWatts','density','calibrations','version'].includes(key))continue;if(!validNumber(s[key]))throw Error('Invalid setting: '+key);}
 for(const [key,ids] of [['materialPrices',materials],['density',materials],['machineRates',printerIds],['powerWatts',printerIds]] as const){if(!s[key]||typeof s[key]!=='object')throw Error('Missing '+key);for(const id of ids){const n=(s[key] as Record<string,number>)[id];if(!validNumber(n)||key==='density'&&(n<=0||n>10))throw Error('Invalid '+key+': '+id);}}
 for(const record of Object.values(s.calibrations??{})){if(record.algorithm!==undefined&&record.algorithm!=='surface-v2'||record.reference!==undefined&&(typeof record.reference!=='string'||record.reference.length>500)||record.signature!==undefined&&(typeof record.signature!=='string'||record.signature.length>2000))throw Error('Invalid calibration provenance.');}
 if(s.margin+s.feePercent>=100)throw Error('Profit margin plus percentage fees must be below 100%.');
 if(s.failurePercent>=100)throw Error('Failure allowance must be below 100%.');
 if(s.effectiveFlow<=0||s.effectiveFlow>100)throw Error('Effective flow must be between 0 and 100 mm³/s.');
 if(!s.calibrations||typeof s.calibrations!=='object'||Object.keys(s.calibrations).length>1000)throw Error('Invalid calibration records.');
 for(const [key,v] of Object.entries(s.calibrations)){if(key.length>200||!v||!validNumber(v.grams,100)||v.grams<=0||!validNumber(v.time,100)||v.time<=0||typeof v.date!=='string'||v.date.length>80)throw Error('Invalid calibration record.');}
 return structuredClone(s);
}
export function validateConfig(c:Config){
 if(!printerIds.includes(c.printer)||!materials.includes(c.material)||![0.2,0.4,0.6,0.8].includes(c.nozzle))throw Error('Unsupported printer, material or nozzle.');
 for(const [key,max] of [['quantity',10000],['unitsPerBatch',10000],['walls',20]] as const)if(!Number.isInteger(c[key])||c[key]<1||c[key]>max)throw Error('Invalid '+key+'.');
 if(!Number.isInteger(c.topLayers)||!Number.isInteger(c.bottomLayers)||c.topLayers<0||c.bottomLayers<0||c.topLayers>100||c.bottomLayers>100)throw Error('Invalid top/bottom layers.');
 if(!Number.isInteger(c.colours)||c.colours<0||c.colours>16)throw Error('Colours must be 0 (unknown) through 16.');
 for(const [key,max] of [['density',10],['supportGrams',100000],['brimGrams',100000],['preparationMinutes',100000],['travelMinutes',100000],['accelerationMinutes',100000],['coolingMinutes',100000],['printSpeed',1000],['amsSeconds',3600],['toolSeconds',3600],['amsChanges',1e6],['toolChanges',1e6]] as const)if(!validNumber(c[key],max))throw Error('Invalid '+key+'.');
 if(!Number.isInteger(c.amsChanges)||!Number.isInteger(c.toolChanges)||!['manual','counts'].includes(c.changeMode)||!validNumber(c.lineWidth,3)||c.lineWidth<c.layer)throw Error('Invalid line width or change assumptions.');
 for(const [key,min,max] of [['layer',0.05,c.nozzle*0.8],['infill',0,100],['scale',0.01,1000],['supportPercent',0,300],['purgeGrams',0,100000],['changeMinutes',0,100000]] as const)if(!validNumber(c[key],max)||c[key]<min)throw Error('Invalid '+key+'.');
}
export function geometryEstimate(a:Analysis,c:Config,s:Settings):Estimate{validateConfig(c);return estimateGeometry(a,c,s);}
export function calculatePrice(e:Estimate,c:Config,s:Settings):Price{
 validateSettings(s);
 if(!printerIds.includes(c.printer)||!materials.includes(c.material))throw Error('Unsupported costing profile.');
 if(!Number.isInteger(c.quantity)||c.quantity<1||c.quantity>10000)throw Error('Quantity must be 1–10,000.');
 if(!Number.isInteger(c.unitsPerBatch)||c.unitsPerBatch<1||c.unitsPerBatch>10000)throw Error('Batch capacity must be 1–10,000.');
 if(!validNumber(e.grams,1e6)||!validNumber(e.hours,100000)||e.grams<=0||e.hours<=0)throw Error('Enter positive filament grams and printing hours.');
 const batchScope=e.basis==='batch'||e.classification==='Slicer-derived'||e.scope==='One complete batch';
 const batches=Math.ceil(c.quantity/c.unitsPerBatch);
 // For a sliced/manual batch, repeat the entire slice; a partial final batch is charged in full.
 const batchGrams=e.batchGrams??e.purgeGrams;
 const grams=batchScope?e.grams*batches:(e.grams-batchGrams)*c.quantity+batchGrams*batches;
 const geometryScope=e.basis==='geometry'||e.scope.startsWith('One model');
 const batchHours=e.batchHours??c.changeMinutes/60;
 const hours=batchScope?e.hours*batches:geometryScope?(e.hours-batchHours)*c.quantity+batchHours*batches:e.hours*c.quantity;
 const material=grams/1000*s.materialPrices[c.material],machine=hours*s.machineRates[c.printer],electricity=s.powerWatts[c.printer]/1000*hours*s.electricity;
 const labour=(s.setupMinutes+s.unitMinutes*c.quantity+s.batchMinutes*batches)/60*s.labourRate;
 const packaging=s.packaging*c.quantity,finishing=s.finishing*c.quantity;
 // Failure reserve applies only to repeatable printing costs, not design/setup/packaging.
 const failure=(material+machine+electricity+s.batchMinutes*batches/60*s.labourRate)*s.failurePercent/100;
 const manufacturing=material+machine+electricity+labour+s.design+packaging+finishing+s.overhead+failure;
 const target=(manufacturing+s.feeFixed)/(1-s.margin/100-s.feePercent/100);
 const total=Math.ceil(Math.max(target,s.minimum)*100-1e-8)/100;
 const fees=s.feeFixed+total*s.feePercent/100,profit=total-manufacturing-fees;
 if(!Number.isFinite(total)||hours<=0||grams<=0||total>1e10)throw Error('Result is outside the supported quotation range.');
 return {material,machine,electricity,labour,design:s.design,packaging,finishing,overhead:s.overhead,failure,manufacturing,fees,profit,actualMargin:profit/total*100,total,unit:total/c.quantity,batches,hours,grams};
}
export const money=(n:number)=>new Intl.NumberFormat('en-SG',{style:'currency',currency:'SGD',currencyDisplay:'narrowSymbol'}).format(n);
export function duration(hours:number){const mins=Math.max(1,Math.round(hours*60));return `${Math.floor(mins/60)}h ${mins%60}m`;}

export function calculatePriceRange(e:Estimate,c:Config,s:Settings){
 if(!e.range)return undefined;
 const bound=(grams:number,hours:number)=>calculatePrice({...e,grams,hours,range:undefined},c,s);
 const low=bound(e.range.gramsLow,e.range.hoursLow);
 const high=e.range.complete?bound(e.range.gramsHigh!,e.range.hoursHigh!):undefined;
 return {low,high};
}
export function approximate(e:Estimate|null){return !!e&&(!!e.range?.gramsHigh||!!e.range?.hoursHigh||e.classification!=='Slicer-derived'&&e.classification!=='Manual estimate');}
export function displayMass(p:Price,e:Estimate,r?:ReturnType<typeof calculatePriceRange>){
 if(r?.high)return `${Math.floor(r.low.grams)}–${Math.ceil(r.high.grams)} g`;
 return approximate(e)?`~${Math.max(1,Math.round(p.grams))} g`:`${p.grams.toFixed(1)} g`;
}
export function roughDuration(hours:number){const min=hours*60;return min<5?'<5 min':duration(Math.round(min/5)*5/60);}
export function displayTime(p:Price,e:Estimate,r?:ReturnType<typeof calculatePriceRange>){
 if(r?.high)return `${roughDuration(r.low.hours)}–${roughDuration(r.high.hours)}`;
 return approximate(e)?`~${roughDuration(p.hours)}`:duration(p.hours);
}
