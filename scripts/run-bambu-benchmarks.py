"""Run a genuine installed Bambu Studio CLI; never synthesize reference statistics.
Usage: python3 scripts/run-bambu-benchmarks.py --binary /path/bin/bambu-studio --resources /path/resources
The caller supplies runtime library paths if using an extracted Linux AppImage.
"""
import argparse,json,pathlib,subprocess,hashlib,re,datetime
ROOT=pathlib.Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--binary',required=True);a.add_argument('--resources',required=True);a.add_argument('--output',default=str(ROOT/'.benchmark-output'));args=a.parse_args()
binary=pathlib.Path(args.binary).resolve();resources=pathlib.Path(args.resources).resolve();out=pathlib.Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
subprocess.run(['python3',str(ROOT/'scripts/generate-benchmark-models.py')],check=True)
version_output=subprocess.run([str(binary),'--help'],capture_output=True,text=True,check=True,cwd=out).stdout
version=re.search(r'BambuStudio-([\d.]+)',version_output).group(1)
index={}
for path in (resources/'profiles/BBL').rglob('*.json'):
 try:
  data=json.loads(path.read_text())
  if data.get('name'):index[data['name']]=(path,data)
 except (ValueError,OSError):pass
def resolve(name,seen=()):
 if name in seen:raise ValueError('Cyclic profile')
 path,data=index[name];result=resolve(data['inherits'],seen+(name,)) if data.get('inherits') else {}
 for inc in data.get('include',[]):result.update(resolve(inc,seen+(name,)))
 result.update(data);result.pop('inherits',None);result.pop('include',None);return result
machine=resolve('Bambu Lab X2D 0.4 nozzle');process=resolve('0.20mm Standard @BBL X2D');filament=resolve('Bambu PLA Basic @BBL X2D 0.4 nozzle')
models=ROOT/'tests/reference-bambu/models';destination=ROOT/'tests/reference-bambu';records=[]
for name in ['single-colour','supported','multicolour','three-colour']:
 job=out/name;job.mkdir(exist_ok=True);proc={**process,'enable_support':'1' if name=='supported' else '0'}
 # These are actual slicer settings, not values inferred by the geometry estimator.
 for filename,data in [('machine.json',machine),('process.json',proc),('filament.json',filament)]: (job/filename).write_text(json.dumps(data,indent=2))
 files=[models/'colour-a.stl',models/'colour-b.stl',models/'colour-c.stl'] if name=='three-colour' else [models/'colour-a.stl',models/'colour-b.stl'] if name=='multicolour' else [models/(name+'.stl')]
 filament_files=[str(job/'filament.json')]
 if len(files)>1:
  filament_files=[]
  for i,colour in enumerate(['#800080','#FFFFFF','#FAD500'][:len(files)],1):
   f={**filament,'name':f'Benchmark PLA colour {i}','filament_colour':[colour],'filament_settings_id':[f'Benchmark PLA colour {i}']};target=job/f'filament-{i}.json';target.write_text(json.dumps(f));filament_files.append(str(target))
 command=[str(binary),'--debug','2','--datadir',str(out/'user-data'),'--load-settings',str(job/'machine.json')+';'+str(job/'process.json'),'--load-filaments',';'.join(filament_files),'--orient','0','--arrange','1','--allow-multicolor-oneplate','--slice','0','--skip-useless-pick','--export-3mf',name+'-sliced.3mf','--outputdir',str(job)]
 if len(files)>1:command+=['--load-filament-ids',','.join(str(i+1) for i in range(len(files)))]
 command+=list(map(str,files));completed=subprocess.run(command,capture_output=True,text=True,cwd=out);(job/'run.log').write_text(completed.stdout+'\n'+completed.stderr)
 result=json.loads((job/'result.json').read_text())
 if completed.returncode or result.get('return_code')!=0:raise RuntimeError(f'{name}: slicer failed; inspect {job}/run.log')
 plate=result['sliced_plates'][0];gcode=(job/'plate_1.gcode').read_text();header=gcode.split('; HEADER_BLOCK_END')[0]+'; HEADER_BLOCK_END\n';(destination/(name+'.gcode-header.txt')).write_text(header)
 grams=sum(f['total_used_g'] for f in plate['filaments']);seconds=plate['total_predication']
 record={'name':name,'studioVersion':version,'generatedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'model':str((models/(name+'.stl')).relative_to(ROOT)),'modelSHA256':hashlib.sha256((models/(name+'.stl')).read_bytes()).hexdigest(),'referenceGrams':grams,'referenceSeconds':seconds,'filamentChanges':plate['filament_change_times'],'featureSeconds':plate['feature_type_times'],'source':'Actual native Bambu Studio CLI result.json and generated G-code','config':{'printer':'X2D','nozzle':0.4,'material':'PLA','quality':'Standard','layer':float(proc['layer_height']),'infill':float(proc['sparse_infill_density'].rstrip('%')),'walls':int(proc['wall_loops']),'topLayers':int(proc['top_shell_layers']),'bottomLayers':int(proc['bottom_shell_layers']),'supports':name=='supported','colours':len(files),'dual':len(files)>1},'filamentDensity':float(filament['filament_density'][0]),'warnings':[line for line in (completed.stdout+completed.stderr).splitlines() if '[error]' in line or '[warning]' in line]}
 records.append(record);(destination/'references.json').write_text(json.dumps({'kind':'actual-bambu-studio-cli','cases':records},indent=2)+'\n');print(name,round(grams,3),'g',round(seconds),'s',record['filamentChanges'],'changes',flush=True)
(destination/'references.json').write_text(json.dumps({'kind':'actual-bambu-studio-cli','cases':records},indent=2)+'\n')
