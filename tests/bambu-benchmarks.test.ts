import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {analyseFile} from '../src/core/files';
import {geometryEstimate,calculatePrice} from '../src/core/pricing';
import {parseGcodeStatistics} from '../src/core/gcode-statistics';
import {defaults,defaultConfig} from '../src/core/types';
import reference from './reference-bambu/references.json';
import baseline from './reference-bambu/baseline-errors.json';
const percent=(estimate:number,actual:number)=>(estimate-actual)/actual*100;
describe('actual Bambu Studio 02.08.02.61 X2D reference regressions',()=>{
 for(const r of reference.cases){
  it(`${r.name}: reports raw geometry error against actual native slice totals`,()=>{
   const bytes=readFileSync(r.model);expect(createHash('sha256').update(bytes).digest('hex')).toBe(r.modelSHA256);
   const a=analyseFile(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),r.model),c={...defaultConfig,...r.config} as typeof defaultConfig,s=structuredClone(defaults);s.density.PLA=r.filamentDensity;
   const e=geometryEstimate(a,c,s),expected=baseline.find(b=>b.name===r.name)!;
   expect(a.watertight).toBe(true);expect(e.classification).toBe('Geometry estimate');expect(e.incomplete).toBe(true);
   // This freezes observed error, not an invented accuracy promise. Improvements require a reviewed new baseline/report.
   expect(percent(e.grams,r.referenceGrams)).toBeCloseTo(expected.materialErrorPercent,5);
   expect(percent(e.hours*3600,r.referenceSeconds)).toBeCloseTo(expected.timeErrorPercent,5);
   if(r.name==='supported')expect(r.featureSeconds).toHaveProperty('Support');
   if(r.name==='three-colour')expect(r.filamentChanges).toBeGreaterThan(0);
  });
  it(`${r.name}: original slicer summaries retain total time, waste and used channels`,()=>{
   const header=readFileSync(`tests/reference-bambu/${r.name}.gcode-header.txt`,'utf8');const p=parseGcodeStatistics(header,1,'actual native output')!;
   expect(Math.abs(p.grams-r.referenceGrams)).toBeLessThanOrEqual(.01*r.config.colours);
   expect(Math.abs(p.hours*3600-r.referenceSeconds)).toBeLessThanOrEqual(1);
   expect(p.colours).toBe(r.config.colours);
   const e={grams:p.grams,modelGrams:p.grams,supportGrams:0,purgeGrams:0,hours:p.hours,classification:'Slicer-derived' as const,basis:'batch' as const,notes:p.notes??[],scope:'Original complete plate'};
   const price=calculatePrice(e,{...defaultConfig,...r.config,purgeGrams:100,changeMinutes:100,preparationMinutes:100} as typeof defaultConfig,structuredClone(defaults));
   expect(price.grams).toBe(p.grams);expect(price.hours).toBe(p.hours); // No duplicated allowances.
  });
 }
});
