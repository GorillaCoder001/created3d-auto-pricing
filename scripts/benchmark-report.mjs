import {mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
await mkdir('.openai',{recursive:true});
const output=resolve('.openai/benchmark-report.mjs');
await build({entryPoints:['scripts/benchmark-report.ts'],bundle:true,platform:'node',format:'esm',outfile:output});
await import(pathToFileURL(output).href);
