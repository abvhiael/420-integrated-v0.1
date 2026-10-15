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
