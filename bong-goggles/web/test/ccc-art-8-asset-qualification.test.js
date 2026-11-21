import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {CHAOS_CARD_ART_SOURCES,CHAOS_CARD_ART_OUTPUTS} from '../core/chaos-card-art.js';
import {CHAOS_MAP_ASSETS} from '../core/chaos-map-art.js';
import {CHAOS_VEHICLE_ASSETS,CHAOS_VEHICLE_SOURCE_SHA} from '../core/chaos-vehicles.js';
import {createChaosGame} from '../core/cross-country-chaos.js';
import {renderChaosGame} from '../core/classics-ui.js';
import {CHAOS_IMAGE_MANIFEST_PATH,CHAOS_CARD_CATALOG_SHA256,CHAOS_IMAGE_MANIFEST_SCHEMA,
 inspectChaosRaster,assertChaosImageManifest} from '../scripts/verify-chaos-image-manifest.mjs';
const root=resolve(import.meta.dirname,'..'),hash='a'.repeat(64);
const meta=(path,format,width,height,transparent)=>({path,format,width,height,transparent,bytes:1500,sha256:hash});
function fixture(){
 const cardsDir='assets/games/cross-country-chaos/cards/';
 const mapsDir='assets/games/cross-country-chaos/maps/';
 const carsDir='assets/games/cross-country-chaos/vehicles/';
 return {schema:CHAOS_IMAGE_MANIFEST_SCHEMA,game:'cross-country-chaos',
  sourceCatalogSha256:CHAOS_CARD_CATALOG_SHA256,
  cards:CHAOS_CARD_ART_SOURCES.map((source,i)=>({
   id:CHAOS_CARD_ART_OUTPUTS[i].slice(cardsDir.length,-5),
   source:meta(source,'png',640,1080,true),
   export:meta(CHAOS_CARD_ART_OUTPUTS[i],'webp',480,810,true)
  })),
  maps:CHAOS_MAP_ASSETS.map(a=>({
   id:a.path.slice(mapsDir.length,-5),
   export:{...meta(a.path,'webp',1920,830,a.transparent),bytes:a.bytes},
   gitBlobSha:a.gitBlobSha
  })),
  vehicles:CHAOS_VEHICLE_ASSETS.map(path=>{
   const id=path.slice(carsDir.length,-4);
   return {id,export:meta(path,'svg',100,64,true),
    gitBlobSha:CHAOS_VEHICLE_SOURCE_SHA[id]};
  }),
  results:[
   {id:'winner-trophy',format:'inline-svg',cssClass:'ccc-result-trophy',viewBox:'0 0 175 155',transparent:true},
   {id:'finish-flag',format:'inline-svg',cssClass:'ccc-result-flag',viewBox:'0 0 144 94',transparent:true}
  ]
 };
}
test('CCC-ART-8: single deterministic 49 PNG/49 WebP, 6 atlas/6 SVG and winner-art manifest',()=>{
 const m=fixture();
 assert.deepEqual(assertChaosImageManifest(m),{cards:49,maps:6,vehicles:6,inlineResults:2});
 assert.equal(CHAOS_IMAGE_MANIFEST_PATH,'assets/games/cross-country-chaos/image-manifest.json');
 assert.equal(m.cards.length,49);
 assert.ok(m.cards.every((c,i)=>c.source.path.endsWith('.png')&&
  c.export.path===CHAOS_CARD_ART_OUTPUTS[i]&&c.source.width*810===c.export.width*1080));
});
test('CCC-ART-8: manifest rejects missing, forged, duplicated, malformed and nontransparent exports',()=>{
 const bad=fn=>{const m=fixture();fn(m);assert.throws(()=>assertChaosImageManifest(m),/CCC-ART-8 asset qualification/);};
 bad(m=>m.cards.pop());
 bad(m=>m.cards[0].export.path='../bad.webp');
 bad(m=>m.cards[0].export.path=m.cards[1].export.path);
 bad(m=>m.cards[0].export.width=481);
 bad(m=>m.cards[0].source.transparent=false);
 bad(m=>m.cards[0].source.sha256='not-a-hash');
 bad(m=>m.maps[0].export.transparent=true);
 bad(m=>m.maps[0].gitBlobSha='0'.repeat(40));
 bad(m=>m.vehicles[0].export.height=65);
 bad(m=>m.vehicles[0].gitBlobSha='0'.repeat(40));
 bad(m=>m.results[1].cssClass='evil');
 bad(m=>m.sourceCatalogSha256='0'.repeat(64));
});
test('CCC-ART-8: inspect source pixel alpha, reject opaque RGBA and empty transparent PNGs',async()=>{
 const semi=await sharp({create:{width:8,height:8,channels:4,background:{r:255,g:20,b:70,alpha:.5}}}).png().toBuffer();
 assert.equal(await inspectChaosRaster(semi,{format:'png',width:8,height:8,transparent:true}),true);
 await assert.rejects(inspectChaosRaster(semi,{format:'png',width:9,height:8,transparent:true}),/dimensions/);
 await assert.rejects(inspectChaosRaster(semi,{format:'webp',width:8,height:8,transparent:true}),/format/);
 const opaque=await sharp({create:{width:8,height:8,channels:4,background:{r:255,g:20,b:70,alpha:1}}}).png().toBuffer();
 await assert.rejects(inspectChaosRaster(opaque,{format:'png',width:8,height:8,transparent:true}),/alpha|transparency/);
 const empty=await sharp({create:{width:8,height:8,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toBuffer();
 await assert.rejects(inspectChaosRaster(empty,{format:'png',width:8,height:8,transparent:true}),/visible pixels/);
 const webp=await sharp(semi).webp({quality:78}).toBuffer();
 assert.equal(await inspectChaosRaster(webp,{format:'webp',width:8,height:8,transparent:true}),true);
});
test('CCC-ART-8: real source PNG and transparent atlas foreground match declared export profiles',async()=>{
 const source=await readFile(resolve(root,CHAOS_CARD_ART_SOURCES[0]));
 assert.equal(await inspectChaosRaster(source,{format:'png',width:640,height:1080,transparent:true}),true);
 const foreground=await readFile(resolve(root,CHAOS_MAP_ASSETS.find(a=>a.transparent).path));
 assert.equal(await inspectChaosRaster(foreground,{format:'webp',width:1920,height:830,transparent:true}),true);
});
test('CCC-ART-8: 2–4 player map, cards and vehicles remain locally scaled with private hands',async()=>{
 const css=await readFile(resolve(root,'classics.css'),'utf8');
 const tabletop=await readFile(resolve(root,'ccc-tabletop.css'),'utf8');
 const board=await readFile(resolve(root,'core/chaos-board.js'),'utf8');
 assert.match(css,/aspect-ratio:16\/27/);
 assert.match(board,/preserveAspectRatio="xMidYMid meet"/);
 assert.match(tabletop,/CCC-ART-8: mobile media ratios/);
 assert.match(tabletop,/@media\(max-width:480px\)/);
 for(const count of [2,3,4]){
  const game=createChaosGame({names:['A','B','C','D'].slice(0,count),seed:19});
  const html=renderChaosGame({game,revealed:false});
  assert.equal((html.match(/class="ccc-map-vehicle ccc-map-vehicle--/g)||[]).length,count);
  assert.match(html,/east-atlas-underlay\.webp/);
  assert.doesNotMatch(html,/ccc-hand-card|data-chaos-move/);
 }
});
test('CCC-ART-8: source and deployment validation wired into existing GitHub production gates',async()=>{
 const build=await readFile(resolve(root,'scripts/build.mjs'),'utf8');
 const gate=await readFile(resolve(root,'scripts/qualify-web.mjs'),'utf8');
 const verifier=await readFile(resolve(root,'scripts/verify-chaos-image-manifest.mjs'),'utf8');
 assert.match(build,/createChaosImageManifest/);
 assert.match(build,/CHAOS_IMAGE_MANIFEST_PATH/);
 assert.match(gate,/verifyChaosPublishedImageManifest/);
 assert.match(gate,/baseTotal:1157\*1024/);
 assert.match(gate,/name!==CHAOS_IMAGE_MANIFEST_PATH/);
 assert.match(verifier,/CHAOS_CARD_CATALOG_SHA256/);
 assert.match(verifier,/source\.equals\(out\)/);
 assert.match(verifier,/raw===JSON\.stringify\(expected\)/);
 assert.doesNotMatch(verifier,/\bfetch\s*\(|\bsetTimeout\s*\(|\bsetInterval\s*\(|\beval\s*\(/);
});
