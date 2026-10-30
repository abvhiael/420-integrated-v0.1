import test from 'node:test';
import assert from 'node:assert/strict';
import {defineTaxonomyCatalog,TAXONOMY_VERSION,POLICY_VERSION} from '../src/object-taxonomy.js';
import {CONTRACT_VERSION} from '../src/placement-contract.js';
import {BUILDING_COMPAT_VERSION,defineBuildingFunction,defineBuildingCompatibilityRegistry,resolveBuildingCompatibility,checkBuildingEquipment,BuildingCompatibilityService} from '../src/building-compatibility.js';
const t={schemaVersion:TAXONOMY_VERSION,typeId:'artisan_bench',family:'workshop',roles:['crafting'],surfaces:['floor'],layers:['furniture'],decorative:false,qualified:true,qualificationRef:'review_1'};
const pol={schemaVersion:POLICY_VERSION,policyId:'developer_craft',typeId:'artisan_bench',revision:1,origin:'developer',maxModifiers:1,perItemCapBps:500,effects:[{effectId:'crafting_efficiency',minBps:250,maxBps:250,weight:1}],qualified:true,qualificationRef:'review_2'};
const catalog=defineTaxonomyCatalog({types:[t],policies:[pol]});
const building={schemaVersion:BUILDING_COMPAT_VERSION,buildingTypeId:'artisan_shop',revision:1,functions:['crafting'],slots:[{slotId:'workbench',function:'crafting',surface:'floor',layer:'furniture',typeIds:['artisan_bench'],capacity:1}],qualified:true,qualificationRef:'review_building'};
const registry=defineBuildingCompatibilityRegistry({catalog,buildings:[building]});
const geometry={schemaVersion:CONTRACT_VERSION,assetId:'certified_bench',geometryId:'bench_g',geometryVersion:1,surface:'floor',layer:'furniture',visualPx:{width:64,height:64},renderAnchorPx:{x:0,y:0},occupancy:{kind:'rectangle',width:1,height:1},allowedOrientations:[0],qualified:true,qualificationRef:'geo_review'};
const placement={schemaVersion:CONTRACT_VERSION,instanceId:'item_1',assetId:'certified_bench',ownerPrincipal:'alice',parcelId:'parcel_1',buildingId:'building_1',roomId:null,regionId:'emerald-coast',surface:'floor',layer:'furniture',gridX:0,gridY:0,orientation:0,renderAnchor:{x:0,y:0},geometryId:'bench_g',geometryVersion:1,parentInstanceId:null,slotId:null,revision:1,createdAt:100,updatedAt:100,history:[],state:'placed',validationVersion:1};
const item={itemId:'item_1',designId:'certified_bench',typeId:'artisan_bench',owner:'alice',state:'owned',origin:'developer',transferable:true,policyId:'developer_craft',policyRevision:1,catalogSha256:catalog.sha256,effects:[{effectId:'crafting_efficiency',bps:250}]};
const args=()=>({registry,catalog,buildingTypeId:'artisan_shop',revision:1,buildingId:'building_1',parcelId:'parcel_1',ownerPrincipal:'alice',placements:[structuredClone(placement)],geometries:[structuredClone(geometry)],items:[structuredClone(item)],assignedSlots:['workbench']});
const denied=fn=>assert.throws(fn,/hc-econ-03:|hc-econ-01:|hc-place-02:/);
test('E15 immutable reviewed building functions, exact qualified slot and pinned registry',()=>{
 const b=resolveBuildingCompatibility(registry,{buildingTypeId:'artisan_shop',revision:1});
 assert(Object.isFrozen(b.slots[0].typeIds));
 assert.equal(b.registrySha256,registry.sha256);
 assert.deepEqual(checkBuildingEquipment(args()).functions,{crafting:{ordinaryBps:250,questBps:0,effectiveBps:250}});
 assert.deepEqual(checkBuildingEquipment(args()).slotOccupancy,{workbench:1});
});
test('fail closed on unsupported building/slot/type/revision, missing certification and altered catalogue',()=>{
 denied(()=>defineBuildingFunction({...building,qualified:false},catalog));
 denied(()=>defineBuildingFunction({...building,slots:[{...building.slots[0],typeIds:['unreviewed']}]},catalog));
 denied(()=>defineBuildingFunction({...building,slots:[{...building.slots[0],function:'comfort'}]},catalog));
 denied(()=>defineBuildingCompatibilityRegistry({catalog,buildings:[building,building]}));
 denied(()=>resolveBuildingCompatibility({...registry,sha256:'0'.repeat(64)},{buildingTypeId:'artisan_shop',revision:1}));
 denied(()=>resolveBuildingCompatibility(registry,{buildingTypeId:'artisan_shop',revision:2}));
 denied(()=>checkBuildingEquipment({...args(),assignedSlots:['unsupported']}));
 denied(()=>checkBuildingEquipment({...args(),catalog:{...catalog,sha256:'0'.repeat(64)}}));
});
test('HC-PLACE ownership/geometry/room/custody restrictions are retained',()=>{
 denied(()=>checkBuildingEquipment({...args(),placements:[{...placement,ownerPrincipal:'mallory'}]}));
 denied(()=>checkBuildingEquipment({...args(),placements:[{...placement,buildingId:'other_building'}]}));
 denied(()=>checkBuildingEquipment({...args(),placements:[{...placement,parcelId:'wrong_parcel'}]}));
 denied(()=>checkBuildingEquipment({...args(),placements:[{...placement,state:'stored'}]}));
 denied(()=>checkBuildingEquipment({...args(),geometries:[{...geometry,qualified:false}]}));
 denied(()=>checkBuildingEquipment({...args(),items:[{...item,owner:'mallory'}]}));
 denied(()=>checkBuildingEquipment({...args(),items:[{...item,state:'burned'}]}));
});
test('tampered or unqualified item outcomes and duplicate fixed developer effects reject',()=>{
 denied(()=>checkBuildingEquipment({...args(),items:[{...item,effects:[{effectId:'crafting_efficiency',bps:450}]}]}));
 denied(()=>checkBuildingEquipment({...args(),items:[{...item,policyId:'forged'}]}));
 denied(()=>checkBuildingEquipment({...args(),placements:[placement,placement],items:[item,item],geometries:[geometry,geometry],assignedSlots:['workbench','workbench']}));
});

test('server-only compatibility read rejects absent or revoked placement authority',async()=>{
 const snapshot=args();let trusted=true;
 const reader={
  readAuthorizedBuilding:async(session,id)=>session==='session_a'&&id==='building_1'?snapshot:null,
  verifyPlacedEquipment:async()=>trusted
 };
 const service=new BuildingCompatibilityService({catalog,registry,reader});
 assert.equal((await service.compatibility('session_a','building_1')).functions.crafting.effectiveBps,250);
 snapshot.registry={...registry,sha256:'0'.repeat(64)};
 snapshot.catalog={...catalog,sha256:'0'.repeat(64)};
 assert.equal((await service.compatibility('session_a','building_1')).registrySha256,registry.sha256);
 trusted=false;
 await assert.rejects(service.compatibility('session_a','building_1'),/hc-econ-03:equipment-authority-unverified/);
 await assert.rejects(service.compatibility('expired','building_1'),/hc-econ-03:unauthorized-building/);
 denied(()=>new BuildingCompatibilityService({catalog,registry,reader:{}}));
});
