import {analyseFile} from '../core/files';
self.onmessage=(event:MessageEvent<{buffer:ArrayBuffer;name:string}>)=>{try{const analysis=analyseFile(event.data.buffer,event.data.name);self.postMessage({ok:true,analysis},{transfer:[analysis.positions.buffer]});}catch(e){self.postMessage({ok:false,error:e instanceof Error?e.message:'Unable to analyse this file.'});}};
