import test from 'node:test';import assert from 'node:assert/strict';
import {CULTIVATION_STAGE_ART,CULTIVATION_SUPPORT_ART,cultivationStageArt,CULTIVATION_ART_BASE} from '../src/cultivation-art.js';
import {STAGES} from '../src/guest.js';
test('all five canonical playable stages have explicit distinct art and safe fallback',()=>{
 assert.deepEqual(Object.keys(CULTIVATION_STAGE_ART),STAGES);
 const names=new Set();
 for(const stage of STAGES){const art=cultivationStageArt(stage);
  assert.ok(art.src.startsWith(CULTIVATION_ART_BASE));assert.match(art.src,/\.png$/);
  assert.match(art.alt,/Illustrated/i);assert.match(art.fallback,/\.svg$/);names.add(art.src);
 }
 assert.equal(names.size,STAGES.length);
 assert.throws(()=>cultivationStageArt('../outside'),/unknown-cultivation-stage/);
});
test('all five supporting compositions have distinct untrusted-free static filenames',()=>{
 const names=Object.values(CULTIVATION_SUPPORT_ART);
 assert.equal(names.length,5);assert.equal(new Set(names).size,5);
 for(const name of names)assert.match(name,/^hc-[a-z-]+\.png$/);
});

import {stat,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const artDir=resolve(import.meta.dirname,'../public/assets/cultivation');
test('all ten approved uploaded images exist as real PNG files with expected nonempty data',async()=>{
 for(const filename of [...Object.values(CULTIVATION_STAGE_ART).map(x=>x.file),...Object.values(CULTIVATION_SUPPORT_ART)]){
  const path=resolve(artDir,filename);const info=await stat(path);
  assert.ok(info.size>100000,filename+' must be the uploaded image, not a placeholder');
  const data=await readFile(path);assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a',filename+' must be a valid PNG');
 }
});
