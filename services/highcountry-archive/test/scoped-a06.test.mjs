import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
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

test('uploaded verified Archive Edition art is available but not a reward prerequisite',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hc-a06-'));
 try{
  const archive=founderPath(1,'archive-front');
  await mkdir(dirname(join(root,archive)),{recursive:true});
  const bytes=Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(bytes);
  bytes.write('IHDR',12);bytes.writeUInt32BE(1024,16);bytes.writeUInt32BE(1024,20);
  await writeFile(join(root,archive),bytes);
  const manifest=await buildScopedA06Manifest(root);
  assert.equal(manifest.availableDeferred,1);
  assert.equal(resolveOriginalSixteenArt(manifest,archive),'/'+archive);
  assert.equal(manifest.qualification.fullA06Qualified,false);
  assert.equal(manifest.policy.entitlementsIndependentOfArtwork,true);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('all 16 uploaded founder assets retain exact byte identity across corrected filenames and audited SHA-256',async()=>{
 const repository=fileURLToPath(new URL('../../../',import.meta.url));
 const manifest=await buildScopedA06Manifest(repository);
 assert.equal(manifest.totals.invalid,0);
 assert.equal(manifest.totals.missing,0);
 assert.equal(manifest.availableDeferred,32);
 for(let i=1;i<=16;i++){
  const stem='assets/highcountry/original-sixteen/hc-f'+String(i).padStart(2,'0')+'-';
  for(const kind of ['front','back','key-art','archive-front','archive-back','fragment-01','fragment-02','fragment-03','fragment-04','final-revelation','founders-front','founders-back','seal']){
   const legacy=await readFile(join(repository,stem+kind+'.png.png'));
   const normalized=await readFile(join(repository,stem+kind+'.png'));
   assert.equal(createHash('sha256').update(legacy).digest('hex'),createHash('sha256').update(normalized).digest('hex'));
   assert.equal(normalized.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
   assert.ok(normalized.readUInt32BE(16)>0&&normalized.readUInt32BE(20)>0);
  }
  for(const [legacy,canonical] of [['front','seed-front'],['back','seed-back'],['key-art','archive-key-art']]){
   const a=await readFile(join(repository,stem+legacy+'.png.png'));
   const b=await readFile(join(repository,stem+canonical+'.png'));
   assert.equal(createHash('sha256').update(a).digest('hex'),createHash('sha256').update(b).digest('hex'));
  }
  for(const kind of ['archive-front','archive-back']){
   const path=stem+kind+'.png';
   const record=manifest.deferred.find(x=>x.path===path);
   assert.equal(record.status,'available');
   const bytes=await readFile(join(repository,path));
   assert.equal(record.sha256,createHash('sha256').update(bytes).digest('hex'));
  }
 }
});
