/** Lightweight, local silhouette heuristic. It does not classify a product or infer true dimensions. */
export interface PhotoShape {
  status:'detected'|'uncertain';
  reason:string;
  widthRatio:number;
  heightRatio:number;
  fill:number;
  edgeDensity:number;
  longestMm:number;
}
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
function median(v:number[]){const a=[...v].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];}
/** Analyse only a downsampled image, bounding memory and CPU independently of source resolution. */
export function inspectPhotoPixels(data:Uint8ClampedArray,w:number,h:number):PhotoShape {
 const bad=(reason:string):PhotoShape=>({status:'uncertain',reason,widthRatio:1,heightRatio:1,fill:0,edgeDensity:0,longestMm:100});
 if(w<24||h<24||data.length!==w*h*4)return bad('Image could not be analysed.');
 const samples:[number,number,number][]=[];
 const add=(x:number,y:number)=>{const i=(y*w+x)*4;samples.push([data[i],data[i+1],data[i+2]]);};
 for(let y=0;y<h;y+=Math.max(1,Math.floor(h/16)))for(const x of [0,w-1])add(x,y);
 for(let x=0;x<w;x+=Math.max(1,Math.floor(w/16)))for(const y of [0,h-1])add(x,y);
 const bg=[0,1,2].map(k=>median(samples.map(v=>v[k])));
 const dist=(i:number)=>Math.hypot(data[i]-bg[0],data[i+1]-bg[1],data[i+2]-bg[2]);
 const deviations=samples.map(v=>Math.hypot(v[0]-bg[0],v[1]-bg[1],v[2]-bg[2]));
 const variance=median(deviations);
 // Reject busy scenery and objects touching most of the image boundary.
 if(variance>55)return bad('Background is too varied to identify a reliable silhouette.');
 const threshold=clamp(variance*2.8+27,38,105);
 const mask=new Uint8Array(w*h);
 let total=0,border=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=y*w+x,i=p*4;
  if(data[i+3]<100||dist(i)<threshold)continue;
  mask[p]=1;total++;
  if(x===0||x===w-1||y===0||y===h-1)border++;
 }
 if(total<w*h*.008||total>w*h*.80)return bad('Object/background separation is unreliable.');
 // Connected components suppress tiny highlights and text elsewhere in the photo.
 const visited=new Uint8Array(w*h),queue=new Int32Array(w*h);
 let best=0,box:[number,number,number,number]=[0,0,0,0];
 for(let p=0;p<w*h;p++)if(mask[p]&&!visited[p]){
  let head=0,tail=1,count=0,minX=w,minY=h,maxX=0,maxY=0;
  queue[0]=p;visited[p]=1;
  while(head<tail){const q=queue[head++],x=q%w,y=Math.floor(q/w);count++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
   for(const n of [x>0?q-1:-1,x<w-1?q+1:-1,y>0?q-w:-1,y<h-1?q+w:-1])if(n>=0&&mask[n]&&!visited[n]){visited[n]=1;queue[tail++]=n;}
  }
  if(count>best){best=count;box=[minX,minY,maxX,maxY];}
 }
 if(best<Math.max(25,total*.4))return bad('Foreground is fragmented or contains multiple unrelated objects.');
 const [x0,y0,x1,y1]=box,bw=x1-x0+1,bh=y1-y0+1;
 if(x0<=1||y0<=1||x1>=w-2||y1>=h-2||border>total*.03)return bad('Product appears cropped by the photograph.');
 if(bw<5||bh<5)return bad('Object silhouette is too small.');
 const fill=clamp(best/(bw*bh),.08,1),widthRatio=bw/Math.max(bw,bh),heightRatio=bh/Math.max(bw,bh);
 // A coarse foreground boundary measure; not a 3D complexity predictor.
 let boundary=0;
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const p=y*w+x;if(mask[p]&&(x===0||x===w-1||y===0||y===h-1||!mask[p-1]||!mask[p+1]||!mask[p-w]||!mask[p+w]))boundary++;}
 return {status:'detected',reason:'Foreground silhouette identified. Physical scale and depth remain assumptions.',widthRatio,heightRatio,fill,edgeDensity:clamp(boundary/best,0,1),longestMm:100};
}
/** Real image processing occurs in browser memory. No networking or model downloads. */
export function inspectPhoto(image:HTMLImageElement):PhotoShape {
 const limit=192,ratio=Math.min(1,limit/Math.max(image.naturalWidth,image.naturalHeight));
 const width=Math.max(24,Math.round(image.naturalWidth*ratio)),height=Math.max(24,Math.round(image.naturalHeight*ratio));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Canvas not available.');
 ctx.drawImage(image,0,0,width,height);
 return inspectPhotoPixels(ctx.getImageData(0,0,width,height).data,width,height);
}
export function proposedPhotoDimensions(shape:PhotoShape,product:string):[number,number,number]{
 const main=shape.longestMm;
 const w=Math.max(12,Math.round(main*shape.widthRatio)),h=Math.max(3,Math.round(main*shape.heightRatio));
 const depth=product==='Flat product / coaster'?4:product==='Functional part'?Math.max(12,Math.round(Math.min(w,h)*.5)):Math.max(12,Math.round(w*.75));
 return [w,depth,h];
}
