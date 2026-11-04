import {describe,it,expect} from 'vitest';
import {defaultConfig,defaults} from '../src/core/types';
import {nameHint,sizePreset,productPhotoEstimate,normalizeRecognition,candidates} from '../src/core/product-recognition';
describe('photo product identification and category-dependent costing',()=>{
 it('recognizes the three customer examples from filename hints',()=>{
  expect(nameHint('waffle_charm.png').kind).toBe('Charm / keychain');
  expect(nameHint('Coffee.png').kind).toBe('Cup / mug');
  expect(nameHint('gregar.jpeg').kind).toBe('Figurine / toy');
  expect(nameHint('unrelated.png').kind).toBe('Other / unknown');
 });
 it('does not invent a price for an unidentified product',()=>{
  expect(()=>productPhotoEstimate('Other / unknown',[100,100,100],'Medium',defaultConfig,defaults,null)).toThrow(/category/);
 });
 it('uses materially different estimated weight and time for distinct products',()=>{
  const charm=productPhotoEstimate('Charm / keychain',sizePreset('Charm / keychain'),'Medium',defaultConfig,defaults,null);
  const cup=productPhotoEstimate('Cup / mug',sizePreset('Cup / mug'),'Medium',defaultConfig,defaults,null);
  const figurine=productPhotoEstimate('Figurine / toy',sizePreset('Figurine / toy'),'Medium',defaultConfig,defaults,null);
  expect(charm.grams).toBeLessThan(cup.grams);
  expect(cup.grams).toBeLessThan(figurine.grams);
  expect(charm.hours).toBeLessThan(figurine.hours);
 });
 it('keeps physical scale tied to the supplied dimensions',()=>{
  const a=productPhotoEstimate('Charm / keychain',[50,10,50],'Medium',defaultConfig,defaults,null);
  const b=productPhotoEstimate('Charm / keychain',[100,20,100],'Medium',defaultConfig,defaults,null);
  expect(b.grams/a.grams).toBeCloseTo(8);
 });
 it('refuses ambiguous AI category matches and allows definitive matches',()=>{
  const equally=candidates.map(([label])=>({label,score:.1}));
  expect(normalizeRecognition(equally).kind).toBe('Other / unknown');
  const strong=candidates.map(([label],i)=>({label,score:i===0?.66:.01}));
  expect(normalizeRecognition(strong).kind).toBe('Charm / keychain');
 });
});
