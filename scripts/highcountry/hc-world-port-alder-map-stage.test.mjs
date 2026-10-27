import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {selectPortAlderArtwork} from '../../apps/highcountry-web/src/port-alder-map-stage.js';
const repo=new URL('../../',import.meta.url);
const catalog=JSON.parse(readFileSync(new URL('deployments/highcountry/hc-world-map-catalogue.v1.json',repo)));
const overlay=JSON.parse(readFileSync(new URL('deployments/highcountry/hc-world-port-alder-artwork-hitboxes.v2.json',repo)));
const nav=JSON.parse(readFileSync(new URL('deployments/highcountry/hc-world-06-port-alder-district-navigation.v1.json',repo)));
const valid={schema:'HC.WORLD.PURCHASE.MILESTONE.V1',settlementId:'HC-EC-S01',authority:'SERVER_ATTESTED_CANONICAL_SETTLED_TITLE_CURRENT_OWNER',finalized:true,qualifyingPurchased:300,eligibleTitles:600,revision:5,canonicalSnapshotId:'HC-EC-S01:snapshot99'};
test('all three original uploaded files exist with actual names',()=>{for(const src of [catalog.maps.region.src,catalog.maps.town.genesisSrc,catalog.maps.town.developed50Src]){const p=new URL('apps/highcountry-web/public'+src,repo);assert.ok(statSync(p).size>100000)}});
test('all thirteen artwork hitboxes reference immutable district IDs',()=>{assert.equal(overlay.districts.length,13);assert.equal(new Set(overlay.districts.map(d=>d.districtId)).size,13);for(const d of overlay.districts){assert.ok(nav.districts.some(n=>n.id===d.districtId));assert.ok(d.polygon.length>=3);assert.ok(d.polygon.every(([x,y])=>x>=0&&x<1536&&y>=0&&y<1024))}});
test('no public heritage geography in map catalogue',()=>{assert.equal(catalog.privacy.heritageLocationsPublic,false);assert.equal(overlay.heritageSitesPublished,false)});
test('unverified, missing and guest snapshots remain Genesis',()=>{for(const s of [undefined,null,{}, {...valid,authority:'GUEST'}, {...valid,finalized:false},{...valid,qualifyingPurchased:301,eligibleTitles:300},{...valid,revision:-1}]){assert.equal(selectPortAlderArtwork(catalog,s).stage,'GENESIS');assert.equal(selectPortAlderArtwork(catalog,s).verified,false)}});
test('verified milestone switches only at >= half',()=>{assert.equal(selectPortAlderArtwork(catalog,{...valid,qualifyingPurchased:299}).stage,'GENESIS');assert.equal(selectPortAlderArtwork(catalog,valid).stage,'DEVELOPED_50')});
test('single-title exact half uses integers',()=>{assert.equal(selectPortAlderArtwork(catalog,{...valid,qualifyingPurchased:1,eligibleTitles:2}).stage,'DEVELOPED_50');assert.equal(selectPortAlderArtwork(catalog,{...valid,qualifyingPurchased:1,eligibleTitles:3}).stage,'GENESIS')});

test('75% milestone remains on 50% artwork until canonical full image uploaded',()=>{const v=selectPortAlderArtwork(catalog,{...valid,qualifyingPurchased:450});assert.equal(v.stage,'DEVELOPED_50')});
test('full-capacity stage begins at exact 75% when its image is available',()=>{const c=structuredClone(catalog);c.maps.town.developed75AssetReady=true;assert.equal(selectPortAlderArtwork(c,{...valid,qualifyingPurchased:449}).stage,'DEVELOPED_50');assert.equal(selectPortAlderArtwork(c,{...valid,qualifyingPurchased:450}).stage,'DEVELOPED_75')});
