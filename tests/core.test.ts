import {describe,it,expect} from 'vitest';
import {analyseFile,analysePositions,inspectZip,parseSTL,parse3MF,parseSliceInfo,sampleCoaster} from '../src/core/files';
import {calculatePrice,geometryEstimate,validateSettings,validateConfig} from '../src/core/pricing';
import {compatibility,buildSize,calibrationKey} from '../src/core/printers';
import {defaults,defaultConfig,type Estimate,type Analysis} from '../src/core/types';
import {createCalibration} from '../src/core/estimation';
import {quotationText,customerBreakdown} from '../src/core/quotation';
import {archive,asciiSTL,binarySTL,tetraPositions,threeMF,meshXML,modelXML,sliceXML} from './fixtures';
const manual:Estimate={grams:100,modelGrams:100,supportGrams:0,purgeGrams:0,hours:2,classification:'Manual estimate',scope:'One item · manual totals',notes:[]};
const settings=()=>structuredClone(defaults),config=()=>({...defaultConfig});
describe('transparent SGD pricing',()=>{
 it('uses the confirmed defaults',()=>{expect(defaults.electricity).toBe(.31);expect(defaults.margin).toBe(35);expect(defaults.minimum).toBe(5);});
 it('calculates material, machine, electricity and margin, not markup',()=>{const s=settings();s.powerWatts.X2D=200;const p=calculatePrice(manual,config(),s);expect(p.material).toBe(2.5);expect(p.machine).toBe(3);expect(p.electricity).toBeCloseTo(.124);expect(p.total).toBe(8.66);expect(p.actualMargin).toBeGreaterThanOrEqual(35);});
 it('sets unconfirmed power and hands-on time to zero',()=>{const p=calculatePrice(manual,config(),settings());expect(p.electricity).toBe(0);expect(p.labour).toBe(0);});
 it('prices a Bambu Studio manual result using grams and hours plus minutes',()=>{
  const grams=38.33,hours=2+15/60;
  const p=calculatePrice({...manual,grams,modelGrams:grams,hours},config(),settings());
  expect(p.grams).toBe(38.33);
  expect(p.hours).toBe(2.25);
  expect(p.material).toBeCloseTo(38.33/1000*25);
  expect(p.machine).toBeCloseTo(2.25*1.5);
  expect(p.total).toBe(6.67);
 });
 it('enforces a S$5 order minimum',()=>expect(calculatePrice({...manual,grams:1,modelGrams:1,hours:.01},config(),settings()).total).toBe(5));
 it('solves percentage and fixed payment fees inside the margin equation',()=>{const s=settings();s.feeFixed=.5;s.feePercent=3;const p=calculatePrice(manual,config(),s);expect(p.total).toBe(9.68);expect(p.fees).toBeCloseTo(.7904);expect(p.actualMargin).toBeGreaterThanOrEqual(35);});
 it('charges design, overhead and setup once for multiple items',()=>{const s=settings();Object.assign(s,{design:10,overhead:2,setupMinutes:20,unitMinutes:2,batchMinutes:3,packaging:1});const p=calculatePrice(manual,{...config(),quantity:5,unitsPerBatch:2},s);expect(p.design).toBe(10);expect(p.overhead).toBe(2);expect(p.packaging).toBe(5);expect(p.labour).toBeCloseTo(9.75);expect(p.hours).toBe(10);expect(p.batches).toBe(3);});
 it('repeats complete sliced plates, including a partial final batch',()=>{const e={...manual,classification:'Slicer-derived' as const};const p=calculatePrice(e,{...config(),quantity:5,unitsPerBatch:2},settings());expect(p.grams).toBe(300);expect(p.hours).toBe(6);});
 it('shares geometry purge and change overhead per batch without reducing per-item mass',()=>{const e={...manual,grams:110,purgeGrams:10,hours:2.5,scope:'One model; purge and change overhead shared per batch'};const p=calculatePrice(e,{...config(),quantity:5,unitsPerBatch:2,changeMinutes:30},settings());expect(p.grams).toBe(530);expect(p.hours).toBe(11.5);});
 it('does not apply geometry change overhead again to manual values',()=>{const p=calculatePrice(manual,{...config(),quantity:5,unitsPerBatch:2,changeMinutes:30},settings());expect(p.hours).toBe(10);});
 it('adds failure reserve only to repeatable printing costs',()=>{const s=settings();Object.assign(s,{design:100,packaging:50,setupMinutes:60,failurePercent:10});const p=calculatePrice(manual,config(),s);expect(p.failure).toBeCloseTo(.55);});
 it.each([100,101,Infinity,NaN,-1])('rejects invalid margin %s',margin=>{const s=settings();s.margin=margin;expect(()=>validateSettings(s)).toThrow();});
 it('rejects margin plus fees at 100%',()=>{const s=settings();s.margin=97;s.feePercent=3;expect(()=>validateSettings(s)).toThrow();});
 it.each([NaN,Infinity,-1,0])('rejects invalid print grams %s',grams=>expect(()=>calculatePrice({...manual,grams},config(),settings())).toThrow());
 it('rejects malformed imported costs',()=>{const s=settings();s.powerWatts.X2D=-1;expect(()=>validateSettings(s)).toThrow();expect(()=>validateSettings({version:1})).toThrow();});
 it('rejects fractional quantity and impossible layer height',()=>{expect(()=>validateConfig({...config(),quantity:1.5})).toThrow();expect(()=>validateConfig({...config(),layer:.5})).toThrow();});
});
describe('STL and topology',()=>{
 it('reads binary STL even when the header begins with solid',()=>expect([...parseSTL(binarySTL())]).toEqual([...tetraPositions]));
 it('reads ASCII STL',()=>expect([...parseSTL(asciiSTL())]).toEqual([...tetraPositions]));
 it('finds dimensions and volume of a closed tetrahedron',()=>{const a=analysePositions(tetraPositions);expect(a.dimensions).toEqual([10,10,10]);expect(a.volume).toBeCloseTo(1000/6);expect(a.watertight).toBe(true);});
 it('flags open geometry',()=>{const a=analysePositions(tetraPositions.slice(9));expect(a.openEdges).toBe(3);expect(a.watertight).toBe(false);});
 it('flags inconsistent winding',()=>{const p=tetraPositions.slice();for(let j=0;j<3;j++){const v=p[j+3];p[j+3]=p[j+6];p[j+6]=v;}expect(analysePositions(p).inconsistent).toBeGreaterThan(0);});
 it('flags degenerate geometry',()=>expect(analysePositions(new Float32Array(9)).degenerate).toBe(1));
 it('rejects nonfinite coordinates and unsupported files',()=>{const p=tetraPositions.slice();p[0]=NaN;expect(()=>analysePositions(p)).toThrow();expect(()=>analyseFile(new ArrayBuffer(0),'x.obj')).toThrow();});
 it('creates a real closed sample coaster',()=>{const a=analysePositions(sampleCoaster());expect(a.dimensions).toEqual([80,80,4]);expect(a.watertight).toBe(true);});
});
describe('3MF archives and Bambu statistics',()=>{
 it('does not invent statistics for an unsliced project',()=>{const a=analyseFile(threeMF(),'part.3mf');expect(a.plates).toEqual([]);expect(a.sliced).toBe(false);expect(a.dimensions).toEqual([10,10,10]);});
 it('reads geometry-free sliced archives without inventing a mesh',()=>{const a=analyseFile(archive({'Metadata/plate_1.gcode':';test','Metadata/slice_info.config':sliceXML}),'stats.3mf');expect(a.positions.length).toBe(0);expect(a.plates[0].grams).toBe(100);});
 it('extracts complete positive statistics with matching G-code',()=>{const a=analyseFile(threeMF(true),'part.3mf');expect(a.plates[0]).toMatchObject({grams:100,hours:2,id:1});expect(a.project?.printer).toBe('Bambu Lab X2D');});
 it('retains complete stored metadata while disclosing missing G-code',()=>{const p=parseSliceInfo(sliceXML,[])[0];expect(p.grams).toBe(100);expect(p.metadataOnly).toBe(true);expect(p.notes?.join(' ')).toContain('confirm');});
 it('ignores zero or invalid slice statistics',()=>expect(parseSliceInfo(sliceXML.replace('7200','NaN'),[{name:'Metadata/plate_1.gcode',size:1,compressed:1}])).toEqual([]));
 it('reads per-filament weights when a total weight is absent',()=>expect(parseSliceInfo(sliceXML.replace('<metadata key="weight" value="100"/>',''),[{name:'Metadata/plate_1.gcode',size:1,compressed:1}])[0].grams).toBe(100));
 it('applies build and external component transforms',()=>{const root='<model xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" unit="millimeter"><resources><object id="2"><components><component objectid="1" p:path="/3D/Objects/part.model" transform="2 0 0 0 2 0 0 0 2 10 0 0"/></components></object></resources><build><item objectid="2" transform="1 0 0 0 1 0 0 0 1 5 0 0"/></build></model>';const a=analyseFile(archive({'3D/3dmodel.model':root,'3D/Objects/part.model':modelXML}),'x.3mf');expect(a.dimensions).toEqual([20,20,20]);expect(Math.min(...a.positions.filter((_,i)=>i%3===0))).toBe(15);});
 it('rejects zip path traversal before extraction',()=>expect(()=>inspectZip(archive({'../bad.model':'bad'}))).toThrow());
 it('rejects XML entities',()=>expect(()=>parse3MF(archive({'3D/3dmodel.model':'<!DOCTYPE model [<!ENTITY test "bad">]>'+modelXML}))).toThrow());
 it('rejects circular object graphs',()=>{const model='<model><resources><object id="1"><components><component objectid="1"/></components></object></resources><build><item objectid="1"/></build></model>';expect(()=>parse3MF(archive({'3D/3dmodel.model':model}))).toThrow(/Circular/);});
 it('rejects invalid vertex references',()=>expect(()=>parse3MF(archive({'3D/3dmodel.model':modelXML.replace('v1="0"','v1="99"')}))).toThrow());
 it('handles inch units',()=>{const a=analyseFile(archive({'3D/3dmodel.model':modelXML.replace('millimeter','inch')}),'x.3mf');expect(a.dimensions[0]).toBeCloseTo(254);});
});
describe('printer profiles and estimates',()=>{
 it('uses X2D main and auxiliary intersection dimensions independently',()=>{expect(buildSize(config())).toEqual([256,256,260]);expect(buildSize({...config(),dual:true})).toEqual([235.5,256,256]);expect(compatibility([240,100,258],config()).fits).toBe(true);expect(compatibility([240,100,258],{...config(),dual:true}).fits).toBe(false);});
 it('uses H2D intersection, not the union for dual printing',()=>expect(buildSize({...config(),printer:'H2D',dual:true})).toEqual([300,320,325]));
 it('checks A1 mini and cutter-excluded printers',()=>{expect(compatibility([181,10,10],{...config(),printer:'A1 mini'}).fits).toBe(false);expect(compatibility([256,256,10],{...config(),printer:'P1S'}).fits).toBe(false);});
 it('keeps geometry estimates preliminary until explicitly calibrated',()=>{const a={...analysePositions(tetraPositions),parts:1,plates:[],sliced:false} as Analysis;const c=config(),s=settings();expect(geometryEstimate(a,c,s).classification).toBe('Geometry estimate');const base=geometryEstimate(a,c,s);s.calibrations[calibrationKey(c)]=createCalibration(a,c,s,base.grams*1.1,base.hours*1.2,'Synthetic unit reference, not real-world calibration');expect(geometryEstimate(a,c,s).classification).toBe('Calibrated estimate');});
 it('shows a low-confidence bounded range for invalid topology rather than blocking pricing',()=>{const a={...analysePositions(tetraPositions.slice(9)),parts:1,plates:[],sliced:false} as Analysis;const e=geometryEstimate(a,config(),settings());expect(e.classification).toBe('Preliminary estimate');expect(e.incomplete).toBe(true);expect(e.range?.complete).toBe(true);expect(e.range!.gramsHigh).toBeGreaterThan(e.range!.gramsLow);expect(calculatePrice(e,config(),settings()).total).toBeGreaterThan(0);});
 it('adds explicit multicolour support and purge allowances',()=>{const a={...analysePositions(tetraPositions),parts:1,plates:[],sliced:false} as Analysis;const e=geometryEstimate(a,{...config(),supports:true,supportPercent:20,colours:4,purgeGrams:10,changeMinutes:5},settings());expect(e.supportGrams).toBeCloseTo(e.modelGrams*.2);expect(e.purgeGrams).toBe(10);expect(e.notes.join(' ')).toContain('Counts alone');});
});
describe('quotation privacy',()=>{
 it('hides costs and margins from a customer quotation',()=>{const s=settings(),c=config(),p=calculatePrice(manual,c,s),customer=quotationText('Coaster',c,manual,p,s,false),internal=quotationText('Coaster',c,manual,p,s,true);expect(customer).toContain('CUSTOMER QUOTATION');expect(customer).toContain('SGD');expect(customer).toContain('PRICE BREAKDOWN');expect(customer).not.toContain('ASSUMPTIONS');expect(customer).not.toContain('Estimated profit');expect(customer).not.toContain('Net margin');expect(customer).not.toContain('Electricity tariff');expect(internal).toContain('ASSUMPTIONS');expect(internal).toContain('Estimated profit');expect(internal).toContain('Net margin');});
 it('customer breakdown adds up to the advertised order total without revealing net profit',()=>{
  const s=settings(),c=config();Object.assign(s,{design:10,setupMinutes:30,packaging:2,feeFixed:0.5});
  const p=calculatePrice(manual,c,s);const lines=customerBreakdown(p);
  expect(Math.round(lines.reduce((sum,[,v])=>sum+v,0)*100)).toBe(Math.round(p.total*100));
  const customer=quotationText('Custom print',c,manual,p,s,false);
  expect(customer).toContain('Production & handling');
  expect(customer).not.toContain('Total manufacturing');
  expect(customer).not.toContain('Failure reserve');
 });
 it('customer breakdown respects minimum-order pricing',()=>{
  const p=calculatePrice({...manual,grams:1,modelGrams:1,hours:0.01},config(),settings());
  expect(Math.round(customerBreakdown(p).reduce((sum,[,v])=>sum+v,0)*100)).toBe(500);
 });

});
