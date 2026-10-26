import test from 'node:test';import assert from 'node:assert/strict';
import {SCENE_CONTRACT_VERSION,SCENE_SIZE,TILE_CONTRACT,CONTAINER_FOOTPRINTS,footprintDimensions,CATEGORY_RULES,PROP_CATALOG,ENVIRONMENT_SLOTS,normalizePlacement,layoutProp,demoScene,placementStyle} from '../src/cultivation-scene-layout.js';
test('versioned coordinate contract and source-size independent anchors',()=>{
 assert.equal(SCENE_CONTRACT_VERSION,'hc-cultivation-scene/v1');assert.deepEqual(SCENE_SIZE,{width:1920,height:1080,grid:64});
 for(const [category,rule] of Object.entries(CATEGORY_RULES)){const p=normalizePlacement({id:'test',x:100,y:200,category});assert.equal(p.anchorX,.5);assert.equal(p.anchorY,1);assert.equal(p.depth,rule.depth);}
});
test('different object classes retain meaningful size differences',()=>{
 const bed=layoutProp('raised-bed',500,700),pot=layoutProp('fabric-pot',500,700),ladder=layoutProp('ladder',500,700);
 assert.ok(bed.width>pot.width*2);assert.ok(ladder.height>pot.height);
 assert.equal(bed.zIndex,pot.zIndex-10000);
 assert.match(ladder.src,/^\/assets\/cultivation\/props\/tools-equipment\//);
});
test('all nine region/environment scenes have bounded normalized placements',()=>{
 for(const region of ['emerald-coast','golden-prairie','red-mesa'])for(const environment of Object.keys(ENVIRONMENT_SLOTS)){
  const objects=demoScene(environment);assert.equal(objects.length,3,region);
  for(const obj of objects){assert.ok(obj.x>=0&&obj.x<=1920);assert.ok(obj.y>=0&&obj.y<=1080);
   const css=placementStyle(obj);assert.match(css.left,/%$/);assert.match(css.top,/%$/);assert.match(css.width,/%$/);}
 }
});
test('untrusted placement and filenames fail closed',()=>{
 for(const v of [NaN,Infinity,-2,3000,'2'])assert.throws(()=>normalizePlacement({id:'x',x:v,y:200,category:'raisedBed'}),/invalid-scene-coordinate/);
 assert.throws(()=>normalizePlacement({id:'x',x:100,y:200,category:'../../escape'}),/invalid-scene-category/);
 for(const v of [0,2,NaN])assert.throws(()=>layoutProp('raised-bed',100,200,v),/invalid-scene-scale/);
 assert.throws(()=>layoutProp('../evil',100,200),/unknown-scene-prop/);
 assert.throws(()=>demoScene('../bad'),/unknown-scene-environment/);
});

test('approved tile footprint standards are exact and independent of sprite artwork',()=>{
 assert.deepEqual(TILE_CONTRACT,{width:64,depth:64,isometricHeight:32});
 assert.deepEqual(footprintDimensions('standardPot'),{columns:1,rows:1,width:64,depth:64});
 assert.deepEqual(footprintDimensions('fabricPot'),{columns:1,rows:1,width:64,depth:64});
 assert.deepEqual(footprintDimensions('raisedBed'),{columns:2,rows:1,width:128,depth:64});
 assert.deepEqual(footprintDimensions('largePlanter'),{columns:2,rows:2,width:128,depth:128});
 assert.deepEqual(layoutProp('raised-bed',500,700).footprint,footprintDimensions('raisedBed'));
 assert.deepEqual(layoutProp('fabric-pot',500,700).footprint,footprintDimensions('fabricPot'));
 assert.throws(()=>footprintDimensions('../bad'),/unknown-tile-footprint/);
});
