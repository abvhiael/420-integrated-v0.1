import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {agriculturalBuildingCatalogue,getAgriculturalBuilding,canPlaceAgriculturalBuilding} from '../src/agricultural-building-catalogue.js';
import {recreationCatalogue,getRecreationAsset,canPlaceRecreationAsset} from '../src/recreation-catalogue.js';
import {landscapeCatalogue,getLandscapeAsset,canPlaceLandscapeAsset} from '../src/landscape-catalogue.js';
import {gardenOrnamentCatalogue,getGardenOrnament,canPlaceGardenOrnament} from '../src/garden-ornament-catalogue.js';
import {fireGatheringCatalogue,getFireGatheringFeature,canPlaceFireGatheringFeature} from '../src/fire-gathering-catalogue.js';
import {createMarketplaceClient,mountMarketplace} from '../src/marketplace.js';
const entries=[
 ['agricultural',agriculturalBuildingCatalogue,getAgriculturalBuilding,canPlaceAgriculturalBuilding],
 ['recreation',recreationCatalogue,getRecreationAsset,canPlaceRecreationAsset],
 ['landscape',landscapeCatalogue,getLandscapeAsset,canPlaceLandscapeAsset],
 ['garden',gardenOrnamentCatalogue,getGardenOrnament,canPlaceGardenOrnament],
 ['fire',fireGatheringCatalogue,getFireGatheringFeature,canPlaceFireGatheringFeature]
];
test('all five independently preserved catalogue classes load and remain lookupable',()=>{
 for(const [name,catalogue,get] of entries){
  assert.ok(catalogue.length>0,name);
  const ids=new Set(catalogue.map(asset=>asset.id));
  assert.equal(ids.size,catalogue.length,name+' duplicate ID');
  for(const item of catalogue)assert.equal(get(item.id)?.id,item.id,name);
  assert.equal(get('unregistered-unknown-id'),null,name);
 }
});
test('all five additions preserve server-owned purchase and fail-closed placement',()=>{
 for(const [name,catalogue,get,canPlace] of entries){
  assert.equal(canPlace({id:catalogue[0].id}),false,name);
  assert.equal(canPlace({id:'unregistered-unknown-id',owned:true}),false,name);
  for(const asset of catalogue)assert.equal(asset.marketplace.inventoryPolicy,'authenticated-server-owned',name);
 }
});
test('marketplace retains existing authentication boundary and exports',()=>{
 assert.equal(typeof createMarketplaceClient,'function');
 assert.equal(typeof mountMarketplace,'function');
 assert.throws(()=>createMarketplaceClient({apiUrl:'http://localhost',authenticate:()=>{}}),/marketplace-config-invalid/);
});
test('all five catalogue modules are packaged by the static build and displayed in marketplace',async()=>{
 const build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 const page=await readFile(new URL('../src/marketplace.js',import.meta.url),'utf8');
 for(const [module,header] of [
  ['agricultural-building','Barns, agricultural buildings & homesteads'],
  ['recreation','Recreation & relaxation'],
  ['landscape','Paths, borders & landscape details'],
  ['garden-ornament','Garden ornaments & yard art'],
  ['fire-gathering','Fire pits & outdoor gathering']
 ]){
  assert.ok(build.includes("'"+module+"-catalogue.js'"),module+' absent from build');
  assert.ok(page.includes(header),header+' absent from marketplace');
 }
 for(const heading of ['Premium comfort & regional furniture','Regional memorabilia','Garden structures & shade','Red Mesa leisure buildings','Water features & wildlife gardens'])assert.ok(page.includes(heading),'existing category lost: '+heading);
});
