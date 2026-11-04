/** Product-aware photo assumptions. These are provisional archetypes, NOT image dimensions. */
export type ProductKind='Charm / keychain'|'Cup / mug'|'Figurine / toy'|'Bookmark / flat item'|'Phone stand'|'Bottle / vase'|'Other / unknown';
export type Recognition={kind:ProductKind;source:'vision'|'filename'|'manual'|'unknown';confidence?:number;detail:string};
export const kinds:ProductKind[]=['Charm / keychain','Cup / mug','Figurine / toy','Bookmark / flat item','Phone stand','Bottle / vase','Other / unknown'];
export function nameHint(name:string):Recognition{
 const n=name.toLowerCase().replace(/[_-]+/g,' ');
 const patterns:[RegExp,ProductKind][]=[
  [/charm|keychain|keyring|waffle|pendant|magnet|earring/,'Charm / keychain'],
  [/coffee|cup|mug|espresso|teacup/,'Cup / mug'],
  [/gengar|gregar|pokemon|figurine|figure|statue|toy|gorilla|santa/,'Figurine / toy'],
  [/bookmark|book mark|coaster|placard|nameplate|flat/,'Bookmark / flat item'],
  [/phone stand|smartphone holder|phone holder|device cradle/,'Phone stand'],
  [/bottle|vase|planter|flower pot/,'Bottle / vase']
 ];
 const kind=patterns.find(([re])=>re.test(n))?.[1]??'Other / unknown';
 return {kind,source:kind==='Other / unknown'?'unknown':'filename',detail:kind==='Other / unknown'?'No product type recognized. Choose the category before quoting.':'Category suggested from the filename, not visually verified.'};
}
export function sizePreset(kind:ProductKind):[number,number,number]{
 switch(kind){
  case 'Charm / keychain':return [50,10,50];
  case 'Cup / mug':return [110,90,100];
  case 'Figurine / toy':return [110,95,120];
  case 'Bookmark / flat item':return [40,3,135];
  case 'Phone stand':return [105,110,95];
  case 'Bottle / vase':return [100,100,180];
  default:return [100,100,100];
 }
}
export function normalizeRecognition(predictions:{label:string;score:number}[]):Recognition{
 const mapping:Record<ProductKind,string[]>={
  'Charm / keychain':['a small 3d printed decorative charm or keychain','a small miniature waffle food charm','a small pendant accessory'],
  'Cup / mug':['a coffee cup or ceramic mug with a handle','a cup filled with coffee'],
  'Figurine / toy':['a 3d printed cartoon monster figurine','a pokemon toy character statue','a collectible animal figurine'],
  'Bookmark / flat item':['a thin flat 3d printed bookmark','a flat decorative coaster'],
  'Phone stand':['a 3d printed smartphone holder stand','a phone desk stand'],
  'Bottle / vase':['a cylindrical water bottle','a decorative flower vase'],
  'Other / unknown':['an unrelated object','a photograph with no identifiable product']
 };
 const scores=kinds.map(kind=>({kind,score:Math.max(0,...(mapping[kind]??[]).map(label=>predictions.find(p=>p.label===label)?.score??0))}));
 scores.sort((a,b)=>b.score-a.score);
 const top=scores[0],second=scores[1];
 // CLIP scores are relative similarities, not calibrated correctness probabilities.
 if(!top||top.kind==='Other / unknown'||top.score<.19||top.score-second.score<.035)return {kind:'Other / unknown',source:'unknown',detail:'AI could not distinguish a product category reliably. Select one to continue.'};
 return {kind:top.kind,source:'vision',confidence:top.score,detail:'Suggested by on-device image classification. Please verify the category and dimensions.'};
}
export const candidates:[string,ProductKind][]=[
 ['a small 3d printed decorative charm or keychain','Charm / keychain'],
 ['a small miniature waffle food charm','Charm / keychain'],
 ['a small pendant accessory','Charm / keychain'],
 ['a coffee cup or ceramic mug with a handle','Cup / mug'],
 ['a cup filled with coffee','Cup / mug'],
 ['a 3d printed cartoon monster figurine','Figurine / toy'],
 ['a pokemon toy character statue','Figurine / toy'],
 ['a collectible animal figurine','Figurine / toy'],
 ['a thin flat 3d printed bookmark','Bookmark / flat item'],
 ['a flat decorative coaster','Bookmark / flat item'],
 ['a 3d printed smartphone holder stand','Phone stand'],
 ['a phone desk stand','Phone stand'],
 ['a cylindrical water bottle','Bottle / vase'],
 ['a decorative flower vase','Bottle / vase'],
 ['an unrelated object','Other / unknown'],
 ['a photograph with no identifiable product','Other / unknown']
];
let pipelinePromise:Promise<(image:string,labels:string[])=>Promise<{label:string;score:number}[]>>|null=null;
/** Downloads model artifacts only; inference reads the user's blob locally. No upload API. */
export async function classifyInBrowser(blobUrl:string):Promise<Recognition>{
 if(!pipelinePromise){
  pipelinePromise=(async()=>{
   const cdn='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';
   const mod=await import(/* @vite-ignore */ cdn) as {pipeline:(task:string,model:string,options?:object)=>Promise<unknown>};
   return await mod.pipeline('zero-shot-image-classification','Xenova/clip-vit-base-patch32',{dtype:'q8'}) as (image:string,labels:string[])=>Promise<{label:string;score:number}[]>;
  })().catch(e=>{pipelinePromise=null;throw e;});
 }
 const classifier=await pipelinePromise;
 const predictions=await classifier(blobUrl,candidates.map(([name])=>name));
 return normalizeRecognition(predictions);
}
