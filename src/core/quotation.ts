import {duration,money,calculatePriceRange,displayMass,displayTime,approximate} from './pricing';
import type {Config,Estimate,Price,Settings} from './types';
// Customer-facing line prices allocate the SELLING total, not undisclosed
// manufacturing costs. The last positive line absorbs cent rounding.
export function customerBreakdown(p:Price):Array<[string,number]>{
 const components:[string,number][]=[
  ['Printing material',p.material],
  ['Machine operation & electricity',p.machine+p.electricity],
  ['Production & handling',p.labour],
  ['Design & customisation',p.design],
  ['Packaging & finishing',p.packaging+p.finishing],
  ['Other production services',p.overhead+p.failure+p.fees]
 ];
 const active=components.filter(([,v])=>v>0);
 if(!active.length)return [['Custom 3D printing service',p.total]];
 const base=active.reduce((sum,[,v])=>sum+v,0);
 const cents=Math.round(p.total*100);
 let assigned=0;
 return active.map(([label,v],i)=>{
  const allocated=i===active.length-1?cents-assigned:Math.round(cents*v/base);
  assigned+=allocated;
  return [label,allocated/100];
 });
}
export function quotationLines(name:string,c:Config,e:Estimate,p:Price,s:Settings,internal:boolean){
 const range=calculatePriceRange(e,c,s);
 const priceLabel=range?.high?`SGD ${Math.ceil(range.low.total)}–${Math.ceil(range.high.total)} (operator planning range)`:approximate(e)?`approximately SGD ${Math.round(p.total)}`:`SGD ${p.total.toFixed(2)}`;
 const lines=['CREATED3D','Made With Purpose.','',internal?'INTERNAL COST QUOTATION':'CUSTOMER QUOTATION',new Intl.DateTimeFormat('en-SG',{dateStyle:'long',timeZone:'Asia/Singapore'}).format(new Date()),'',`Product: ${name||'Custom 3D print'}`,`Quantity: ${c.quantity}`];
 if(internal){
  lines.push(`Printer: Bambu Lab ${c.printer} | Nozzle: ${c.nozzle} mm | Material: ${c.material}`,`Estimate: ${e.classification}`,`Print duration (order): ${displayTime(p,e,range)} | Filament (order): ${displayMass(p,e,range)}`,`Batches: ${p.batches} | Capacity: ${c.unitsPerBatch} item(s) per batch`,e.scope);
 }else{
  lines.push(`Material: ${c.material}`);
 }
 lines.push('',`ORDER TOTAL: ${priceLabel}`,`Per item: SGD ${p.unit.toFixed(2)}`);
 if(internal){
  lines.push('','INTERNAL COST BREAKDOWN',...Object.entries({Material:p.material,'Machine operation':p.machine,Electricity:p.electricity,'Hands-on labour':p.labour,'Design (once)':p.design,Packaging:p.packaging,Finishing:p.finishing,'Overhead (once)':p.overhead,'Failure reserve':p.failure,'Total manufacturing':p.manufacturing,'Payment fees':p.fees,'Estimated profit':p.profit}).map(([k,v])=>`${k}: SGD ${v.toFixed(2)}`),`Net margin: ${p.actualMargin.toFixed(1)}%`,`Electricity tariff: SGD ${s.electricity}/kWh | Average power: ${s.powerWatts[c.printer]} W`);
  lines.push('','ASSUMPTIONS',...e.notes);
  if(!s.powerWatts[c.printer])lines.push('Average printer power is not set; electricity is excluded.');
  if(!s.setupMinutes&&!s.unitMinutes&&!s.batchMinutes)lines.push('Hands-on labour time is not set; labour is excluded.');
 }else{
  if(range?.high)lines.push(`Indicative breakdown at SGD ${p.total.toFixed(2)} (within the planning range)`);
  lines.push('','PRICE BREAKDOWN',...customerBreakdown(p).map(([label,value])=>`${label}: SGD ${value.toFixed(2)}`));
 }
 lines.push('','Price is subject to final design and print confirmation.','All amounts are in SGD. Tax and shipping are excluded unless included explicitly.');
 return lines;
}
export function quotationText(name:string,c:Config,e:Estimate,p:Price,s:Settings,internal:boolean){return quotationLines(name,c,e,p,s,internal).join('\n');}
export async function downloadPDF(name:string,c:Config,e:Estimate,p:Price,s:Settings,internal:boolean){
 const {jsPDF}=await import('jspdf');const pdf=new jsPDF({unit:'mm',format:'a4',compress:true});
 // Raster text uses installed browser fonts, preserving names and symbols beyond PDF core fonts.
 const canvas=document.createElement('canvas');canvas.width=1260;canvas.height=1782;const ctx=canvas.getContext('2d');if(!ctx)throw Error('PDF rendering is unavailable.');
 const rows=quotationLines(name,c,e,p,s,internal);let y=82,page=0;
 const begin=()=>{ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#6657d9';ctx.fillRect(0,0,canvas.width,14);y=82;};
 const flush=()=>{if(page++)pdf.addPage();pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,210,297,undefined,'FAST');};begin();
 rows.forEach((row,index)=>{const large=index===0||row.startsWith('ORDER TOTAL');ctx.font=`${large?'700 36':'400 23'}px Arial, sans-serif`;const chars=Array.from(row),wrapped:string[]=[];let line='';for(const char of chars){if(ctx.measureText(line+char).width>1096){wrapped.push(line);line=char;}else line+=char;}wrapped.push(line);for(const text of wrapped){if(y>1670){flush();begin();ctx.font=`${large?'700 36':'400 23'}px Arial, sans-serif`;}ctx.fillStyle=large?'#12213e':'#46516a';ctx.fillText(text,82,y);y+=large?54:35;}});flush();return {blob:pdf.output('blob'),filename:`Created3D-${internal?'internal':'quote'}-${(name||'print').replace(/[^a-z0-9-]/gi,'-').slice(0,45)}.pdf`};
}
