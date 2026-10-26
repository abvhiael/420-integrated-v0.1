import test from 'node:test';
import assert from 'node:assert/strict';
import {entertainmentCatalogue,getEntertainmentAsset,canPlaceEntertainment} from '../src/entertainment-catalogue.js';
test('HC-ART-02-F has twelve canonical unique assets with immutable safe marketplace metadata',()=>{
 assert.equal(entertainmentCatalogue.length,12);
 assert.equal(new Set(entertainmentCatalogue.map(a=>a.id)).size,12);
 for(const a of entertainmentCatalogue){
  assert.equal(a.assetUrl,'/assets/cultivation/props/entertainment-recreation/universal/'+a.id+'.png');
  assert.ok(a.footprint.width>=1&&a.footprint.height>=1);
  assert.equal(a.marketplace.price,null);
  assert.equal(a.marketplace.inventoryPolicy,'authenticated-server-owned');
  assert.equal(getEntertainmentAsset(a.id),a);
 }
});
test('tabletop and wall assets demand appropriate anchor while floor furniture blocks',()=>{
 assert.equal(canPlaceEntertainment({id:'hc-prop-entertainment-chess-set'}),false);
 assert.equal(canPlaceEntertainment({id:'hc-prop-entertainment-chess-set',anchor:'furniture'}),true);
 assert.equal(canPlaceEntertainment({id:'hc-prop-entertainment-dartboard',anchor:'wall'}),true);
 assert.equal(canPlaceEntertainment({id:'hc-prop-entertainment-dartboard',anchor:'furniture'}),false);
 assert.equal(getEntertainmentAsset('hc-prop-entertainment-stereo-console').placement.blocksFurniture,true);
 assert.equal(canPlaceEntertainment({id:'hc-prop-entertainment-stereo-console',occupied:true}),false);
 assert.equal(canPlaceEntertainment({id:'hc-prop-entertainment-cornhole',region:'indoor'}),false);
 assert.equal(canPlaceEntertainment({id:'unknown'}),false);
});
