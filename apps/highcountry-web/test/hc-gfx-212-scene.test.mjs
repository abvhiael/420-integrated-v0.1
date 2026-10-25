import test from 'node:test';import assert from 'node:assert/strict';
import {cultivationSceneArt,CULTIVATION_REGIONS,CULTIVATION_ENVIRONMENTS,CULTIVATION_SCENE_BASE} from '../src/cultivation-art.js';
test('the approved nine scenes are statically mapped with distinct safe URLs',()=>{
 const paths=new Set();
 for(const region of CULTIVATION_REGIONS)for(const environment of CULTIVATION_ENVIRONMENTS){
  const scene=cultivationSceneArt(region,environment);
  assert.equal(scene.src,CULTIVATION_SCENE_BASE+'hc-env-'+region+'-'+environment+'-background.png');
  assert.match(scene.alt,/cultivation setting/);
  paths.add(scene.src);
 }
 assert.equal(paths.size,9);
 for(const invalid of ['../','',null,'unexpected'])assert.throws(()=>cultivationSceneArt(invalid,'indoor'),/unknown-cultivation-scene/);
 assert.throws(()=>cultivationSceneArt('red-mesa','../../secret'),/unknown-cultivation-scene/);
});
