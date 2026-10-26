import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {framedArtCatalogue,canPlaceFramedArt} from '../src/framed-art-catalogue.js';
test('all twelve registered framed artworks resolve to their uploaded PNGs',()=>{
 const root=fileURLToPath(new URL('../public',import.meta.url));
 assert.equal(framedArtCatalogue.length,12);
 assert.equal(new Set(framedArtCatalogue.map(x=>x.id)).size,12);
 for(const x of framedArtCatalogue){
  assert.ok(existsSync(root+x.assetUrl),'missing artwork '+x.id);
  assert.equal(x.placement.layer,'wall_decor');
  assert.equal(x.placement.blocksMovement,false);
  assert.equal(x.placement.blocksFurniture,false);
  assert.equal(x.placement.regionRestriction,null);
  assert.equal(x.marketplace.price,null);
  assert.equal(x.marketplace.inventoryPolicy,'authenticated-server-owned');
  assert.equal(x.marketplace.fairnessEffect,'none');
  assert.equal(x.footprint.tileSizePx,64);
 }
 assert.deepEqual(framedArtCatalogue.find(x=>x.id==='hc-wall-art-old-homestead').footprint,{width:2,height:1,tileSizePx:64});
});
test('poster-style independent wall occupancy and authenticated ownership apply',()=>{
 const id='hc-wall-art-pressed-fern';
 assert.equal(canPlaceFramedArt({id,owned:true,hasWallAnchor:true}),true);
 assert.equal(canPlaceFramedArt({id,owned:false,hasWallAnchor:true}),false);
 assert.equal(canPlaceFramedArt({id,owned:true,hasWallAnchor:false}),false);
 assert.equal(canPlaceFramedArt({id,owned:true,hasWallAnchor:true,wallOccupied:true}),false);
 assert.equal(canPlaceFramedArt({id:'not-canonical',owned:true,hasWallAnchor:true}),false);
});
