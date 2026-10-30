import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectTile,chunkOf,geometryPath,depthSort,validateOldTownScene,spriteFit} from '../src/old-town-scene.js';
const data=name=>JSON.parse(readFileSync(new URL('../../../deployments/highcountry/'+name,import.meta.url),'utf8'));
const scene={sites:data('old-town-site-registry.json'),assets:data('old-town-genesis-assets.json'),geo:data('old-town-geo-authority-status.json'),geometry:data('old-town-provisional-geometry.geojson'),anchors:data('old-town-render-anchors.v1.json')};
test('2:1 64x32 deterministic isometric projection and 16x16 chunk identity',()=>{
 assert.deepEqual(projectTile(10,0),[320,160]);assert.deepEqual(projectTile(0,10),[-320,160]);
 assert.deepEqual(projectTile(10,10),[0,320]);
 assert.deepEqual(chunkOf(15,15),[0,0]);assert.deepEqual(chunkOf(16,16),[1,1]);
 assert.deepEqual(chunkOf(-1,-1),[-1,-1]);
});
test('original provisional geometry retains road and water with closed polygon rings',()=>{
 assert.equal(scene.geometry.features.filter(f=>f.properties.layer==='block').length,24);
 const roads=scene.geometry.features.filter(f=>f.properties.layer==='public_road_polygon');
 assert.equal(roads.length,1);assert(geometryPath(roads[0].geometry).includes(' Z'));
 assert.equal(scene.geometry.properties.issuanceAuthorized,false);
});
test('all 20 source-traced Genesis lot anchors match canonical sites and sprites',()=>{
 const builds=validateOldTownScene(scene);
 assert.equal(builds.length,20);assert.equal(new Set(builds.map(x=>x.id)).size,20);
 assert(!builds.some(x=>x.id==='HL-05'));
 for(const b of builds){
  assert(b.asset.sha256.match(/^[0-9a-f]{64}$/));assert(b.asset.repoPath.endsWith('.png'));
  assert.equal(b.groundAnchorTiles[0],(b.site.rect[0]+b.site.rect[2])/2);
  assert.equal(b.groundAnchorTiles[1],b.site.rect[3]);
 }
 for(let i=1;i<builds.length;i++)assert(depthSort(builds[i-1],builds[i])<=0);
 assert.equal(builds.find(x=>x.id==='LM-04').site.status,'permanent_public');
 assert.notDeepEqual(builds.find(x=>x.id==='LM-05').groundAnchorTiles,builds.find(x=>x.id==='HL-03').groundAnchorTiles);
});
test('provisional authority and anchors fail closed on mutation',()=>{
 assert.throws(()=>validateOldTownScene({...scene,geo:{...scene.geo,issuanceAuthorized:true}}),/authority/);
 assert.throws(()=>validateOldTownScene({...scene,anchors:{anchors:scene.anchors.anchors.slice(1)}}),/count/);
 const copy=structuredClone(scene);
 copy.anchors.anchors[0].groundAnchorTiles[0]++;
 assert.throws(()=>validateOldTownScene(copy),/anchor-drift/);
});

test('canonical sprite fit uses opaque alpha and preserves aspect and ground contact',()=>{
 const fit=spriteFit([500,800],[17,17],[1024,1024],[100,150,899,949]);
 assert.equal(fit.width,1024*(1088/800));
 assert.equal(fit.height,fit.width);
 assert.equal(fit.x+(100+899+1)*(1088/800)/2,500);
 assert.equal(fit.y+(949+1)*(1088/800),800);
 assert.throws(()=>spriteFit([0,0],[11,14],[1024,1024],[100,200,50,600]),/invalid/);
});
