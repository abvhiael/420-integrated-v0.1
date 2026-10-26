import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {regionalMemorabiliaCatalogue,canPlaceRegionalMemorabilia} from '../src/regional-memorabilia-catalogue.js';
test('twelve canonical uploaded regional souvenirs, six of each placement class',()=>{
 const root=fileURLToPath(new URL('../public',import.meta.url));
 assert.equal(regionalMemorabiliaCatalogue.length,12);
 assert.equal(new Set(regionalMemorabiliaCatalogue.map(x=>x.id)).size,12);
 for(const region of ['emerald','prairie','mesa'])assert.equal(regionalMemorabiliaCatalogue.filter(x=>x.originRegion===region).length,4);
 for(const layer of ['wall_decor','tabletop_decor'])assert.equal(regionalMemorabiliaCatalogue.filter(x=>x.placement.layer===layer).length,6);
 for(const item of regionalMemorabiliaCatalogue){
  assert.ok(existsSync(root+item.assetUrl),'missing '+item.id);
  assert.equal(item.footprint.tileSizePx,64);
  assert.equal(item.placement.blocksMovement,false);
  assert.equal(item.placement.blocksFurniture,false);
  assert.equal(item.placement.regionRestriction,null);
  assert.equal(item.marketplace.price,null);
  assert.equal(item.marketplace.inventoryPolicy,'authenticated-server-owned');
  assert.equal(item.marketplace.achievementEntitlement,false);
 }
});
test('wall and tabletop positions enforce separate anchors and occupancy',()=>{
 const w='hc-memorabilia-emerald-heritage-pennant',t='hc-memorabilia-emerald-cedar-sailboat';
 assert.equal(canPlaceRegionalMemorabilia({id:w,owned:true,hasWallAnchor:true}),true);
 assert.equal(canPlaceRegionalMemorabilia({id:w,owned:true,hasWallAnchor:true,wallOccupied:true}),false);
 assert.equal(canPlaceRegionalMemorabilia({id:t,owned:true,hasSurfaceAnchor:true}),true);
 assert.equal(canPlaceRegionalMemorabilia({id:t,owned:true,hasSurfaceAnchor:true,surfaceOccupied:true}),false);
 assert.equal(canPlaceRegionalMemorabilia({id:t,owned:false,hasSurfaceAnchor:true}),false);
 assert.equal(canPlaceRegionalMemorabilia({id:'fake',owned:true,hasWallAnchor:true}),false);
});
