import {defaults,materials,printerIds,type Config,type Settings,type Estimate,type Price,type Analysis} from './types';
import {calibrationKey} from './printers';
export function validNumber(n:unknown,max=1e7):n is number{return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;}
export function validateSettings(input:unknown):Settings{
 if(!input||typeof input!=='object')throw Error('Invalid settings file.');
 const s=input as Settings;
 if(s.version!==1)throw Error('Unsupported settings version.');
 for(const key of Object.keys(defaults) as (keyof Settings)[]){if(['materialPrices','machineRates','powerWatts','density','calibrations','version'].includes(key))continue;if(!validNumber(s[key]))throw Error('Invalid setting: '+key);}
 for(const [key,ids] of [['materialPrices',materials],['density',materials],['machineRates',printerIds],['powerWatts',printerIds]] as const){if(!s[key]||typeof s[key]!=='object')throw Error('Missing '+key);for(const id of ids){const n=(s[key] as Record<string,number>)[id];if(!validNumber(n)||key==='density'&&(n<=0||n>10))throw Error('Invalid '+key+': '+id);}}
 if(s.margin+s.feePercent>=100)throw Error('Profit margin plus percentage fees must be below 100%.');
 if(s.failurePercent>=100)throw Error('Failure allowance must be below 100%.');
 if(s.effectiveFlow<=0||s.effectiveFlow>100)throw Error('Effective flow must be between 0 and 100 mm³/s.');
 if(!s.calibrations||typeof s.calibrations!=='object'||Object.keys(s.calibrations).length>1000)throw Error('Invalid calibration records.');
 for(const [key,v] of Object.entries(s.calibrations)){if(key.length>200||!v||!validNumber(v.grams,100)||v.grams<=0||!validNumber(v.time,100)||v.time<=0||typeof v.date!=='string'||v.date.length>80)throw Error('Invalid calibration record.');}
 return structuredClone(s);
}
export function validateConfig(c:Config){
 if(!printerIds.includes(c.printer)||!materials.includes(c.material)||![0.2,0.4,0.6,0.8].includes(c.nozzle))throw Error('Unsupported printer, material or nozzle.');
 for(const [key,max] of [['quantity',10000],['unitsPerBatch',10000],['colours',16],['walls',20]] as const)if(!Number.isInteger(c[key])||c[key]<1||c[key]>max)throw Error('Invalid '+key+'.');
 for(const [key,min,max] of [['layer',0.05,c.nozzle*0.8],['infill',0,100],['scale',0.01,1000],['supportPercent',0,300],['purgeGrams',0,100000],['changeMinutes',0,100000]] as const)if(!validNumber(c[key],max)||c[key]<min)throw Error('Invalid '+key+'.');
}
export function geometryEstimate(a:Analysis,c:Config,s:Settings):Estimate{
 validateConfig(c);
 if(!a.watertight||a.volume<=0)throw Error('Geometry is open, non-manifold or inconsistently oriented. Enter manual grams and hours, or upload a sliced 3MF.');
 const scale=c.scale/100,volume=a.volume*scale**3,area=a.area*scale**2;
 // Surface-shell proxy, not a layer-by-layer slice. Top/bottom allowance is deliberately approximate.
 const shellThickness=c.walls*c.nozzle*1.05;
 const shell=Math.min(volume,area*shellThickness*0.5+Math.min(c.layer*8,a.dimensions[2]*scale)*a.dimensions[0]*a.dimensions[1]*scale**2*0.35);
 const extruded=shell+(volume-shell)*c.infill/100;
 const calibration=s.calibrations[calibrationKey(c)];
 const modelGrams=extruded/1000*s.density[c.material]*(calibration?.grams??1);
 const supportGrams=c.supports?modelGrams*c.supportPercent/100:0;
 const purgeGrams=c.purgeGrams;
 const layerFactor=0.2/c.layer,nozzleFactor=Math.min(2.5,(c.nozzle/0.4)**1.5);
 const flow=s.effectiveFlow*nozzleFactor/Math.sqrt(layerFactor);
 const hours=((modelGrams+supportGrams)/s.density[c.material]*1000/flow/3600)*(calibration?.time??1)+c.changeMinutes/60;
 const notes=['Geometry proxy only; no toolpaths are generated. Orientation is the uploaded Z axis.','Shell, top/bottom and support volumes are approximations. Hidden cavities, thin walls and intersections can distort the result.',`Density ${s.density[c.material]} g/cm³ and effective flow ${s.effectiveFlow} mm³/s are editable assumptions.`,c.supports?`Support allowance: ${c.supportPercent}% of model mass.`:'Supports are excluded.'];
 if(c.colours>1||c.dual)notes.push(`Purge / prime tower: ${purgeGrams} g per batch; tool / AMS changes: ${c.changeMinutes} min per batch. Colour count cannot determine these. Zero values exclude them.`);
 if(calibration)notes.push('Calibration from '+calibration.date+'; it is a reference factor, not a guarantee for different geometry.');
 return {modelGrams,supportGrams,purgeGrams,grams:modelGrams+supportGrams+purgeGrams,hours,classification:calibration?'Calibrated estimate':'Preliminary estimate',notes,scope:'One model; purge and change overhead shared per batch'};
}
export function calculatePrice(e:Estimate,c:Config,s:Settings):Price{
 validateSettings(s);validateConfig(c);
 if(!Number.isInteger(c.quantity)||c.quantity<1||c.quantity>10000)throw Error('Quantity must be 1–10,000.');
 if(!Number.isInteger(c.unitsPerBatch)||c.unitsPerBatch<1||c.unitsPerBatch>10000)throw Error('Batch capacity must be 1–10,000.');
 if(!validNumber(e.grams,1e6)||!validNumber(e.hours,100000)||e.grams<=0||e.hours<=0)throw Error('Enter positive filament grams and printing hours.');
 const batchScope=e.classification==='Slicer-derived'||e.scope==='One complete batch';
 const batches=Math.ceil(c.quantity/c.unitsPerBatch);
 // For a sliced/manual batch, repeat the entire slice; a partial final batch is charged in full.
 const grams=batchScope?e.grams*batches:(e.modelGrams+e.supportGrams)*c.quantity+e.purgeGrams*batches;
 const geometryScope=e.scope.startsWith('One model');
 const hours=batchScope?e.hours*batches:geometryScope?(e.hours-c.changeMinutes/60)*c.quantity+c.changeMinutes/60*batches:e.hours*c.quantity;
 const material=grams/1000*s.materialPrices[c.material],machine=hours*s.machineRates[c.printer],electricity=s.powerWatts[c.printer]/1000*hours*s.electricity;
 const labour=(s.setupMinutes+s.unitMinutes*c.quantity+s.batchMinutes*batches)/60*s.labourRate;
 const packaging=s.packaging*c.quantity,finishing=s.finishing*c.quantity;
 // Failure reserve applies only to repeatable printing costs, not design/setup/packaging.
 const failure=(material+machine+electricity+s.batchMinutes*batches/60*s.labourRate)*s.failurePercent/100;
 const manufacturing=material+machine+electricity+labour+s.design+packaging+finishing+s.overhead+failure;
 const target=(manufacturing+s.feeFixed)/(1-s.margin/100-s.feePercent/100);
 const total=Math.ceil(Math.max(target,s.minimum)*100-1e-8)/100;
 const fees=s.feeFixed+total*s.feePercent/100,profit=total-manufacturing-fees;
 if(!Number.isFinite(total)||total>1e10)throw Error('Result is outside the supported quotation range.');
 return {material,machine,electricity,labour,design:s.design,packaging,finishing,overhead:s.overhead,failure,manufacturing,fees,profit,actualMargin:profit/total*100,total,unit:total/c.quantity,batches,hours,grams};
}
export const money=(n:number)=>new Intl.NumberFormat('en-SG',{style:'currency',currency:'SGD',currencyDisplay:'narrowSymbol'}).format(n);
export function duration(hours:number){const mins=Math.max(1,Math.round(hours*60));return `${Math.floor(mins/60)}h ${mins%60}m`;}
