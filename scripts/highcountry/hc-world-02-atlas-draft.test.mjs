import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=s=>JSON.parse(readFileSync(path.join(root,s),'utf8'));
const atlas=read('deployments/highcountry/hc-world-county-atlases.draft.v1.json');
const founding=read('deployments/highcountry/hc-world-founding-spec.v1.json');
export function verifyDraft(a){
 assert.equal(a.status,'DESIGN_DRAFT_PENDING_OWNER_APPROVAL');assert.equal(a.regions.length,3);
 const ids=new Set();
 for(const region of a.regions){
  const registered=founding.settlements.filter(s=>s.regionId===region.regionId);
  const expectedNames=new Set(registered.map(s=>s.name)),anchors=region.namedAnchors;
  assert.deepEqual(new Set(Object.keys(anchors)),expectedNames);
  const [width,height]=a.canvas;
  for(const [name,pt] of Object.entries(anchors)) {assert.ok(pt.every(Number.isSafeInteger),name);assert.ok(pt[0]>=0&&pt[0]<width&&pt[1]>=0&&pt[1]<height,name);}
  const adjacency=new Map(Object.keys(anchors).map(name=>[name,new Set()]));
  for(const line of region.routeCorridors){assert.ok(line.length>=2);for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i];assert.ok(adjacency.has(a)&&adjacency.has(b),'route references known settlements');adjacency.get(a).add(b);adjacency.get(b).add(a)}}
  const seen=new Set(),stack=[registered[0].name];while(stack.length){const k=stack.pop();if(seen.has(k))continue;seen.add(k);stack.push(...adjacency.get(k));}
  assert.equal(seen.size,15,'all county settlements connected by travel');
  assert.ok(region.terrainZones.length>=5);assert.ok(region.protectedFeatures.length>=2);
  for(const feature of region.protectedFeatures){assert.ok(!ids.has(feature.id));ids.add(feature.id);if(feature.bounds){const [x,y,X,Y]=feature.bounds;assert.ok(x>=0&&y>=0&&X<=width&&Y<=height&&x<X&&y<Y)}else{assert.ok(feature.bufferTiles>0);for(const [x,y] of feature.centerline)assert.ok(x>=0&&y>=0&&x<width&&y<height)}}
 }
 return true;
}
test('three distinct draft terrain atlases include all 45 fixed settlement anchors and connected road graph',()=>verifyDraft(atlas));
test('missing rural hamlet stops route qualification',()=>{const t=structuredClone(atlas);delete t.regions[0].namedAnchors.Southbank;assert.throws(()=>verifyDraft(t))});
test('isolated municipality fails',()=>{const t=structuredClone(atlas);t.regions[2].routeCorridors=t.regions[2].routeCorridors.filter(r=>!r.includes('White Cactus'));assert.throws(()=>verifyDraft(t),/connected/)});
test('invalid exclusion boundary fails',()=>{const t=structuredClone(atlas);t.regions[0].protectedFeatures[0].bounds=[-1,0,30,50];assert.throws(()=>verifyDraft(t))});
