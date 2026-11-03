import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RotateCcw,Maximize2} from 'lucide-react';
import FallbackPreview from './FallbackPreview';
export default function Preview({positions}:{positions:Float32Array}){
 const host=useRef<HTMLDivElement>(null),reset=useRef<()=>void>(()=>{}),[error,setError]=useState('');
 useEffect(()=>{
  const el=host.current!;let renderer:THREE.WebGLRenderer;try{const canvas=document.createElement('canvas');const context=canvas.getContext('webgl2',{antialias:true,alpha:true});if(!context){setError('WebGL unavailable');return;}renderer=new THREE.WebGLRenderer({canvas,context,antialias:true,alpha:true});}catch{setError('3D preview is unavailable on this device. Analysis and pricing still work.');return;}
  setError('');renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0xf4f6fa,1);renderer.outputColorSpace=THREE.SRGBColorSpace;el.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();const box=geometry.boundingBox!,centre=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  geometry.translate(-centre.x,-centre.y,-box.min.z);
  const material=new THREE.MeshStandardMaterial({color:0x8a7be1,roughness:0.36,metalness:0.13,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
  scene.add(new THREE.AmbientLight(0xffffff,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-100,-150,200);scene.add(light);const rim=new THREE.DirectionalLight(0x9cefff,2);rim.position.set(100,100,100);scene.add(rim);
  const extent=Math.max(size.x,size.y,size.z,1),grid=new THREE.GridHelper(extent*2.8,24,0xd5dbe7,0xe6eaf2);grid.rotation.x=Math.PI/2;grid.position.z=-0.2;scene.add(grid);
  const camera=new THREE.PerspectiveCamera(38,1,extent/1000,extent*100);camera.up.set(0,0,1);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=extent*0.1;controls.maxDistance=extent*12;
  const fit=()=>{const aspect=Math.max(el.clientWidth/el.clientHeight,0.4),distance=extent*1.9/Math.min(1,aspect);camera.position.set(distance,-distance,distance*0.85);controls.target.set(0,0,size.z*0.42);controls.update();};reset.current=fit;
  const resize=new ResizeObserver(()=>{renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();});resize.observe(el);fit();let frame=0;
  function animate(){frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}animate();
  return()=>{cancelAnimationFrame(frame);resize.disconnect();controls.dispose();geometry.dispose();material.dispose();grid.geometry.dispose();(grid.material as THREE.Material).dispose();renderer.dispose();renderer.domElement.remove();};
 },[positions]);
 if(error)return <FallbackPreview positions={positions}/>;
 return <div className="model-preview"><div ref={host} className="canvas-host" aria-label="Interactive 3D model preview"/>{error?<p className="preview-error">{error}</p>:<><div className="preview-label"><span className="live-dot"/> SOLID VIEW</div><div className="preview-controls"><button title="Reset camera" aria-label="Reset camera" onClick={()=>reset.current()}><Maximize2 size={16}/></button><button title="Rotate or drag model to inspect" aria-label="Reset model view" onClick={()=>reset.current()}><RotateCcw size={16}/></button></div><span className="preview-help">Drag to orbit · Scroll to zoom</span></>}</div>;
}
