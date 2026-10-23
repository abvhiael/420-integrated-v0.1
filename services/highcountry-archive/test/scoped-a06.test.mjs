import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {buildScopedA06Manifest,immediatePaths,deferredPaths,founderPath,resolveOriginalSixteenArt} from '../src/scoped-a06.mjs';
test('fixed complete inventory and distinct deferred paths',()=>{
 assert.equal(immediatePaths.length,157);assert.equal(deferredPaths.length,64);
 assert.equal(new Set([...immediatePaths,...deferredPaths]).size,221);
 assert.equal(founderPath(14,'archive-front'),'assets/highcountry/original-sixteen/hc-f14-archive-front.png');
 assert.ok(!immediatePaths.some(p=>p.includes('archive-front')));
});
test('missing images are reported, never fabricated or counted qualified',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hc-a06-'));
 try{
  const manifest=await buildScopedA06Manifest(root);
  assert.deepEqual(manifest.totals,{full:221,immediate:157,deferred:64,available:0,missing:157,invalid:0});
  assert.equal(manifest.qualification.fullA06Qualified,false);
  assert.equal(manifest.policy.archiveEditionEntitlementsRetained,true);
  assert.equal(resolveOriginalSixteenArt(manifest,founderPath(1,'seed-front')),null);
  assert.equal(resolveOriginalSixteenArt(manifest,founderPath(1,'archive-front')),null);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('verified present PNG is resolved while invalid and deferred remain unavailable',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hc-a06-'));
 try{
  const png=founderPath(1,'seed-front'),bad=founderPath(2,'seed-front');
  await mkdir(dirname(join(root,png)),{recursive:true});
  const bytes=Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(bytes);bytes.write('IHDR',12);bytes.writeUInt32BE(1024,16);bytes.writeUInt32BE(1024,20);
  await writeFile(join(root,png),bytes);await writeFile(join(root,bad),'not a png');
  const manifest=await buildScopedA06Manifest(root);
  assert.equal(manifest.totals.available,1);assert.equal(manifest.totals.invalid,1);
  assert.equal(resolveOriginalSixteenArt(manifest,png),'/'+png);
  assert.equal(resolveOriginalSixteenArt(manifest,bad),null);
  assert.equal(resolveOriginalSixteenArt(manifest,founderPath(1,'archive-back')),null);
 }finally{await rm(root,{recursive:true,force:true});}
});
