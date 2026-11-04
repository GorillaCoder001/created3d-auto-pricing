import {describe,it,expect} from 'vitest';
import {inspectPhotoPixels,proposedPhotoDimensions} from '../src/core/photo-analysis';
function raster(w:number,h:number,rect?:[number,number,number,number]) {
 const data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;const inProduct=rect&&x>=rect[0]&&x<=rect[2]&&y>=rect[1]&&y<=rect[3];const v=inProduct?30:234;data[i]=v;data[i+1]=v;data[i+2]=v;data[i+3]=255;}
 return data;
}
describe('local image silhouette recovery',()=>{
 it('returns uncertain rather than inventing geometry for empty photographs',()=>{
  const x=inspectPhotoPixels(raster(96,96),96,96);
  expect(x.status).toBe('uncertain');
 });
 it('distinguishes wide and tall isolated silhouettes',()=>{
  const wide=inspectPhotoPixels(raster(96,96,[12,38,83,57]),96,96);
  const tall=inspectPhotoPixels(raster(96,96,[38,12,57,83]),96,96);
  expect(wide.status).toBe('detected');
  expect(tall.status).toBe('detected');
  expect(wide.widthRatio).toBeGreaterThan(tall.widthRatio);
  expect(proposedPhotoDimensions(wide,'Figurine / decorative')).not.toEqual(proposedPhotoDimensions(tall,'Figurine / decorative'));
 });
 it('does not pretend a cropped product is measurable',()=>{
  expect(inspectPhotoPixels(raster(96,96,[0,22,61,73]),96,96).status).toBe('uncertain');
 });
 it('rejects invalid pixel buffers safely',()=>{
  expect(inspectPhotoPixels(new Uint8ClampedArray(0),96,96).status).toBe('uncertain');
 });
});
