import type {Analysis,Calibration,Config,Estimate,PlanningRange,Settings} from './types';
import {calibrationKey} from './printers';
export const emptyRange:PlanningRange={gramsLow:0,gramsHigh:0,hoursLow:0,hoursHigh:0};
export function calibrationSignature(c:Config,s:Settings){return JSON.stringify([c.layer,c.infill,c.walls,c.lineWidth,c.topLayers,c.bottomLayers,c.supports,c.supportPercent,c.supportGrams,c.brimGrams,c.dual,c.colours,c.scale,c.preparationMinutes,c.purgeGrams,c.changeMode,c.changeMinutes,c.amsChanges,c.amsSeconds,c.toolChanges,c.toolSeconds,(c.density||s.density[c.material]),s.effectiveFlow,c.printSpeed,c.travelMinutes,c.accelerationMinutes,c.coolingMinutes]);}
export function activeCalibration(c:Config,s:Settings):Calibration|undefined{
 const record=s.calibrations[calibrationKey(c)];
 return record?.algorithm==='surface-v2'&&record.signature===calibrationSignature(c,s)?record:undefined;
}
export function batchChangeMinutes(c:Config){
 if(c.changeMode==='manual')return c.changeMinutes;
 if(c.amsChanges>0&&c.amsSeconds<=0)throw Error('Enter measured seconds per AMS change.');
 if(c.toolChanges>0&&c.toolSeconds<=0)throw Error('Enter measured seconds per nozzle/tool change.');
 return (c.amsChanges*c.amsSeconds+c.toolChanges*c.toolSeconds)/60;
}
export function estimateGeometry(a:Analysis,c:Config,s:Settings):Estimate{
 if(!a.watertight||a.volume<=0||a.geometryBlocked){
  // Recovery estimate for valid-looking but unsliceable geometry. Never assume
  // face winding or modifier parts describe printable solid volume.
  const dims=a.dimensions.map(n=>n*c.scale/100);
  if(dims.some(n=>!Number.isFinite(n)||n<=0||n>2000)||!a.triangles)throw Error('Geometry has no usable positive dimensions. Supply a repaired model or saved slice.');
  const envelope=dims[0]*dims[1]*dims[2]; // mm³, orientation-dependent
  const isFlat=Math.min(...dims)/Math.max(...dims)<0.09;
  const occupied=isFlat?0.72:0.24;
  const fraction=isFlat?0.58:0.25;
  const density=c.density||s.density[c.material];
  const modelGrams=Math.max(0.5,envelope*occupied*fraction*density/1000);
  const supportGrams=c.supports?(c.supportGrams>0?c.supportGrams:modelGrams*c.supportPercent/100):0;
  const grams=modelGrams+supportGrams+c.brimGrams+c.purgeGrams;
  const flowHours=(grams/density*1000)/s.effectiveFlow/3600;
  const knownDelay=(c.travelMinutes+c.accelerationMinutes+c.coolingMinutes+c.preparationMinutes+batchChangeMinutes(c))/60;
  const hours=Math.max(0.25,flowHours*1.5+knownDelay);
  const batchHours=(c.preparationMinutes+batchChangeMinutes(c))/60+c.purgeGrams/density*1000/s.effectiveFlow/3600;
  const reason=a.geometryBlocked?'3MF contains modifiers/negative or nonstandard parts whose subtraction and process rules were NOT applied.':'Mesh contains open boundaries, inconsistent winding or non-manifold edges. True solid volume is unreliable.';
  return {modelGrams,supportGrams,purgeGrams:c.purgeGrams,grams,hours,classification:'Preliminary estimate',basis:'geometry',scope:'One model · approximate envelope fallback',batchGrams:c.purgeGrams,batchHours,incomplete:true,range:{gramsLow:Math.max(0.1,grams*0.35),gramsHigh:grams*3,hoursLow:Math.max(0.1,hours*0.4),hoursHigh:hours*3.5,complete:true},notes:[
    'LOW CONFIDENCE · envelope-based fallback, NOT slicing or a verified material measurement.',
    reason,
    `Using the model bounds ${dims.map(n=>n.toFixed(1)).join(' × ')} mm, an illustrative ${(occupied*100).toFixed(0)}% occupied envelope and ${(fraction*100).toFixed(0)}% printable fraction. These values are assumptions, not inferred shell thickness.`,
    'The displayed range is a wide what-if scenario, NOT a guaranteed accuracy or statistical confidence range. Topology, negative volumes, hollows, per-part slicing and colours may change actual grams and hours dramatically.',
    'Support, brim, purge and switching need slicer confirmation. Do not issue a customer quote from this fallback; use a repaired model or Bambu Studio slice.'
  ]};
 }

 const scale=c.scale/100,volume=a.volume*scale**3;
 if(a.sideArea===undefined||a.topProjectedArea===undefined||a.bottomProjectedArea===undefined)throw Error('Re-upload this model to update its geometry analysis.');
 // First-order inward shell volumes. These are orientation-aware surface integrals, not offsets/toolpaths.
 const side=a.sideArea*scale**2,top=a.topProjectedArea*scale**2,bottom=a.bottomProjectedArea*scale**2;
 const wallCandidate=side*c.walls*c.lineWidth,skinCandidate=(top*c.topLayers+bottom*c.bottomLayers)*c.layer;
 // Wall/skin overlaps are unknown. Cap combined solid volume at the enclosed model volume.
 const wallsMm3=Math.min(volume,wallCandidate),skinsMm3=Math.min(volume-wallsMm3,skinCandidate);
 const infillMm3=Math.max(0,volume-wallsMm3-skinsMm3)*c.infill/100;
 const modelVolume=wallsMm3+skinsMm3+infillMm3,density=c.density||s.density[c.material];
 const rawModelGrams=modelVolume/1000*density;
 const rawSupport=c.supports?(c.supportGrams>0?0:rawModelGrams*c.supportPercent/100):0;
 const calibration=activeCalibration(c,s),measured=!!calibration?.reference?.trim();
 const factor=calibration?.grams??1,timeFactor=calibration?.time??1;
 const modelGrams=rawModelGrams*factor;
 const supportGrams=c.supports?(c.supportGrams>0?c.supportGrams:rawSupport*factor):0;
 const knownItemGrams=c.brimGrams+(c.supports?c.supportGrams:0);
 // Flow is only one constraint. A known average depositing speed supplies an independent path-time constraint.
 const beadArea=c.layer*(c.lineWidth-c.layer*(1-Math.PI/4));
 const depositedVolume=modelVolume+rawSupport/density*1000;
 const flowHours=depositedVolume/s.effectiveFlow/3600;
 const pathHours=c.printSpeed>0?depositedVolume/beadArea/c.printSpeed/3600:0;
 const rawHours=Math.max(flowHours,pathHours);
 const knownItemHours=(c.travelMinutes+c.accelerationMinutes+c.coolingMinutes)/60;
 // Known extra material must also take deposition time, separately from calibrated geometry.
 const knownDeposition=knownItemGrams/density*1000/Math.min(s.effectiveFlow,c.printSpeed>0?beadArea*c.printSpeed:Infinity)/3600;
 const batchMinutes=c.preparationMinutes+batchChangeMinutes(c);
 const batchHours=batchMinutes/60+c.purgeGrams/density*1000/Math.min(s.effectiveFlow,c.printSpeed>0?beadArea*c.printSpeed:Infinity)/3600;
 const hours=rawHours*timeFactor+knownItemHours+knownDeposition+batchHours;
 const notes=[
  'Geometry estimate, not slicing. Walls use side-surface area × wall loops × line width; top/bottom skins use oriented projected areas × layer count × layer height. Infill applies only to the remaining interior.',
  'Thin features, shell overlaps, cavities, self-intersections, infill patterns and local solid infill are not resolved. The shell sum is capped at enclosed volume; this is not a certified bound.',
  `Top / bottom layers: ${c.topLayers} / ${c.bottomLayers}; line width ${c.lineWidth} mm. Density ${density} g/cm³ is an editable assumption.`,
  c.supports?(c.supportGrams>0?`Support/interface material entered: ${c.supportGrams} g per item.`:`Supports use an assumed ${c.supportPercent}% mass allowance. No support or interface toolpaths are generated.`):'Supports and interfaces are excluded; inspect overhangs in Bambu Studio.',
  `Brim/skirt/raft allowance entered: ${c.brimGrams} g per item. No automatic brim, raft or skirt is generated.`,
  `Uncalibrated deposition component: ${(rawHours*60).toFixed(0)} min. Effective flow ${s.effectiveFlow} mm³/s${c.printSpeed>0?` and average depositing speed ${c.printSpeed} mm/s`:' only supplies an ideal deposition component, not a complete duration'}. Mesh triangle count never predicts time.`,
  `Additional travel / acceleration / cooling delays: ${c.travelMinutes} / ${c.accelerationMinutes} / ${c.coolingMinutes} min per item. Preparation: ${c.preparationMinutes} min per batch. Zero values exclude those costs; no path-level dynamics or cooling simulation is performed.`,
  `Purge and prime tower: ${c.purgeGrams} g per batch. Deposition time for this entered waste is included once. Tool / AMS overhead: ${batchChangeMinutes(c).toFixed(1)} min per batch (${c.changeMode==='counts'?'counts × measured seconds':'manual total'}). Do not include purge-extrusion time again in change overhead.`,
  c.colours===0?'Colour count is unknown. The monochrome preview does not imply a single-colour print.':`Colour/filament count: ${c.colours}. Counts alone do not determine purge grams, layer changes or tool changes.`,
 ];
 if((a.overhangArea??0)>0)notes.push(`Downward-facing surface candidates: ${Math.round(a.overhangArea!*scale**2)} mm². This flags possible overhangs, not generated supports.`);
 if(a.project?.colourEvidence?.length)notes.push(...a.project.colourEvidence);
 if(calibration)notes.push(measured?`Bambu Studio reference calibration: ${calibration.reference}, recorded ${calibration.date}. Material ×${factor.toFixed(3)} and time ×${timeFactor.toFixed(3)} apply independently for this matching profile. A different geometry can still have a different error.`:'Custom factors are assumptions; no Bambu Studio reference is recorded, so this is not labelled calibrated.');
 else notes.push('No matching surface-v2 calibration. Earlier algorithm factors are retained in settings but are not reused.');
 if(!c.overheadsReviewed)notes.push('Time budget is incomplete until overheads are reviewed or an operator planning range is entered. No numeric accuracy claim or default uncertainty multiplier is applied.');
 return {modelGrams,supportGrams,purgeGrams:c.purgeGrams,grams:modelGrams+supportGrams+c.brimGrams+c.purgeGrams,hours,classification:measured?'Calibrated estimate':'Geometry estimate',scope:'One model; preparation and purge/change overhead shared per batch',basis:'geometry',batchGrams:c.purgeGrams,batchHours,incomplete:!measured&&!c.overheadsReviewed,notes,components:{wallsMm3,skinsMm3,infillMm3,rawGrams:rawModelGrams+rawSupport,rawHours,knownGrams:knownItemGrams+c.purgeGrams,knownHours:knownItemHours+knownDeposition+batchHours}};
}
export function createCalibration(a:Analysis,c:Config,s:Settings,grams:number,hours:number,reference:string):Calibration{
 if(c.colours===0)throw Error('Confirm the actual colour/filament count before recording a measured calibration.');
 if(!reference.trim())throw Error('Name the actual Bambu Studio reference and version.');
 const base=estimateGeometry(a,c,{...s,calibrations:{}}),v=base.components!;
 const material=(grams-v.knownGrams)/v.rawGrams,time=(hours-v.knownHours)/v.rawHours;
 if(!Number.isFinite(material)||!Number.isFinite(time)||material<=0||time<=0||material>100||time>100)throw Error('Reference totals must exceed explicit allowances and produce positive factors below 100.');
 return {grams:material,time,date:new Date().toISOString().slice(0,10),algorithm:'surface-v2',reference:reference.trim(),signature:calibrationSignature(c,s)};
}
export function applyPlanningRange(e:Estimate,input:PlanningRange):Estimate{
 const values=Object.values(input);if(values.some(v=>!Number.isFinite(v)||v<0||v>1e6))throw Error('Planning range values must be finite and non-negative.');
 const gramsLow=input.gramsLow||e.grams,hoursLow=input.hoursLow||e.hours;
 const gramsHigh=input.gramsHigh||undefined,hoursHigh=input.hoursHigh||undefined;
 if(gramsHigh!==undefined&&gramsHigh<gramsLow||hoursHigh!==undefined&&hoursHigh<hoursLow)throw Error('Range upper values must be at least the lower values.');
 if(e.basis==='geometry'&&(gramsLow<(e.batchGrams??0)||hoursLow<(e.batchHours??0)))throw Error('Planning range cannot be below the explicit batch waste or time allowance.');
 const complete=gramsHigh!==undefined&&hoursHigh!==undefined;
 const range={gramsLow,gramsHigh,hoursLow,hoursHigh,complete};
 const edited=values.some(v=>v>0);
 return {...e,grams:complete?(gramsLow+gramsHigh)/2:gramsLow,hours:complete?(hoursLow+hoursHigh)/2:hoursLow,range,notes:[...e.notes,edited?'Operator-entered planning range, not a confidence interval. The cost breakdown uses the range midpoint when both upper values are supplied.':'No finite upper range was invented. Enter low/high grams and hours after reviewing the job; displayed values are approximate.']};
}
