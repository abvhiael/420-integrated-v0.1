// CCC-ART-8: deterministic image inventory from the already approved artwork.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {CHAOS_CARD_ART_SOURCES,CHAOS_CARD_ART_OUTPUTS} from '../core/chaos-card-art.js';
import {CHAOS_MAP_ASSETS,CHAOS_MAP_DIMENSIONS} from '../core/chaos-map-art.js';
import {CHAOS_VEHICLE_ASSETS,CHAOS_VEHICLE_SOURCE_SHA} from '../core/chaos-vehicles.js';

export const CHAOS_IMAGE_MANIFEST_PATH='assets/games/cross-country-chaos/image-manifest.json';
export const CHAOS_CARD_CATALOG_SHA256='3e5248bcb419b85c6904c85d61a466dec3f6275a8e3a4693d3c8fe1c71fe82c0';
export const CHAOS_IMAGE_MANIFEST_SCHEMA='ccc-art-8-images-v1';
const root=resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex');
const gitSha=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const check=(ok,msg)=>{if(!ok)throw Error('CCC-ART-8 asset qualification: '+msg);};
const cardsDir='assets/games/cross-country-chaos/cards/';
const mapsDir='assets/games/cross-country-chaos/maps/';
const carsDir='assets/games/cross-country-chaos/vehicles/';
const safe=s=>typeof s==='string'&&/^assets\/games\/cross-country-chaos\/[a-z0-9/_-]+\.(png|webp|svg)$/.test(s)&&!s.includes('//')&&!s.includes('..');
const image=(path,format,width,height,transparent,bytes)=>({
 path,format,width,height,transparent,bytes:bytes.length,sha256:sha(bytes)
});
export async function inspectChaosRaster(bytes,{format,width,height,transparent,label='raster'}){
 const meta=await sharp(bytes).metadata();
 check(meta.format===format&&meta.width===width&&meta.height===height,'incorrect format or dimensions: '+label);
 check(Boolean(meta.hasAlpha)===transparent,'incorrect alpha channel: '+label);
 if(transparent){
  const alpha=(await sharp(bytes).stats()).channels.at(-1);
  check(meta.channels===4&&alpha&&alpha.min<255&&alpha.max>0,
   'missing visible pixels or actual transparency: '+label);
 }
 return true;
}
export function assertChaosImageManifest(m){
 check(m?.schema===CHAOS_IMAGE_MANIFEST_SCHEMA&&m.game==='cross-country-chaos','invalid manifest schema');
 check(m.sourceCatalogSha256===CHAOS_CARD_CATALOG_SHA256,'approved PNG catalog mismatch');
 check(Array.isArray(m.cards)&&m.cards.length===49,'49 cards required');
 check(Array.isArray(m.maps)&&m.maps.length===6,'6 atlas layers required');
 check(Array.isArray(m.vehicles)&&m.vehicles.length===6,'6 vehicle tokens required');
 check(Array.isArray(m.results)&&m.results.length===2,'2 inline results required');
 const seen=new Set();
 const entry=(o,path,fmt,w,h,alpha)=>{
  check(o?.path===path&&safe(o.path)&&o.format===fmt&&o.width===w&&o.height===h&&
   o.transparent===alpha&&Number.isInteger(o.bytes)&&o.bytes>0&&/^[a-f0-9]{64}$/.test(o.sha256),
   'invalid image identity or properties: '+path);
  check(!seen.has(path),'duplicate image: '+path);seen.add(path);
 };
 for(let i=0;i<49;i++){
  const c=m.cards[i],p=CHAOS_CARD_ART_SOURCES[i],o=CHAOS_CARD_ART_OUTPUTS[i];
  check(c?.id===o.slice(cardsDir.length,-5),'incorrect card name');
  entry(c.source,p,'png',640,1080,true);
  entry(c.export,o,'webp',480,810,true);
  check(c.source.bytes<=2*1024*1024&&c.export.bytes<=128*1024,'card size limit violated');
 }
 for(let i=0;i<6;i++){
  const a=CHAOS_MAP_ASSETS[i],r=m.maps[i];
  check(r?.id===a.path.slice(mapsDir.length,-5)&&r.gitBlobSha===a.gitBlobSha,'atlas identity');
  entry(r.export,a.path,'webp',a.width,a.height,a.transparent);
  check(r.export.bytes===a.bytes,'atlas byte length changed');
 }
 for(let i=0;i<6;i++){
  const path=CHAOS_VEHICLE_ASSETS[i],r=m.vehicles[i],id=path.slice(carsDir.length,-4);
  check(r?.id===id&&r.gitBlobSha===CHAOS_VEHICLE_SOURCE_SHA[id],'vehicle identity');
  entry(r.export,path,'svg',100,64,true);
  check(r.export.bytes>=800&&r.export.bytes<=2048,'vehicle size limit violated');
 }
 const inline=[['winner-trophy','ccc-result-trophy','0 0 175 155'],
  ['finish-flag','ccc-result-flag','0 0 144 94']];
 for(let i=0;i<2;i++){
  const r=m.results[i],[id,cssClass,viewBox]=inline[i];
  check(r?.id===id&&r.format==='inline-svg'&&r.cssClass===cssClass&&
   r.viewBox===viewBox&&r.transparent===true,'invalid inline winner graphic');
 }
 return {cards:49,maps:6,vehicles:6,inlineResults:2};
}
export async function createChaosImageManifest({sourceRoot=root,outputRoot}={}){
 check(typeof outputRoot==='string'&&outputRoot.length>0,'output directory required');
 const cards=[],digests=[];
 for(let i=0;i<49;i++){
  const path=CHAOS_CARD_ART_SOURCES[i],out=CHAOS_CARD_ART_OUTPUTS[i];
  const [source,output]=await Promise.all([
   readFile(resolve(sourceRoot,path)),readFile(resolve(outputRoot,out))]);
  await inspectChaosRaster(source,{format:'png',width:640,height:1080,transparent:true,label:path});
  await inspectChaosRaster(output,{format:'webp',width:480,height:810,transparent:true,label:out});
  const from=image(path,'png',640,1080,true,source);
  digests.push(path+':'+from.sha256);
  cards.push({id:out.slice(cardsDir.length,-5),source:from,export:image(out,'webp',480,810,true,output)});
 }
 check(sha(Buffer.from(digests.sort().join('\n')))===CHAOS_CARD_CATALOG_SHA256,
  '49 pinned card masters changed');
 const maps=[];
 for(const a of CHAOS_MAP_ASSETS){
  const [source,out]=await Promise.all([
   readFile(resolve(sourceRoot,a.path)),readFile(resolve(outputRoot,a.path))]);
  await inspectChaosRaster(out,{format:'webp',width:a.width,height:a.height,
   transparent:a.transparent,label:a.path});
  check(source.equals(out)&&out.length===a.bytes&&gitSha(source)===a.gitBlobSha,
   'modified atlas master or export: '+a.path);
  maps.push({id:a.path.slice(mapsDir.length,-5),export:image(a.path,'webp',a.width,a.height,a.transparent,out),
   gitBlobSha:a.gitBlobSha});
 }
 const vehicles=[];
 for(const path of CHAOS_VEHICLE_ASSETS){
  const [source,out]=await Promise.all([
   readFile(resolve(sourceRoot,path)),readFile(resolve(outputRoot,path))]);
  const id=path.slice(carsDir.length,-4);
  check(source.equals(out)&&gitSha(source)===CHAOS_VEHICLE_SOURCE_SHA[id],
   'modified vehicle master or export: '+path);
  vehicles.push({id,export:image(path,'svg',100,64,true,out),
   gitBlobSha:CHAOS_VEHICLE_SOURCE_SHA[id]});
 }
 const resultCode=await readFile(resolve(sourceRoot,'core/chaos-results.js'),'utf8');
 for(const [cls,viewBox] of [['ccc-result-trophy','0 0 175 155'],['ccc-result-flag','0 0 144 94']])
  check(resultCode.includes('class="'+cls+'" viewBox="'+viewBox+'"')&&
   resultCode.includes('aria-hidden="true" focusable="false"'),
   'unqualified inline results illustration');
 const manifest={schema:CHAOS_IMAGE_MANIFEST_SCHEMA,game:'cross-country-chaos',
  sourceCatalogSha256:CHAOS_CARD_CATALOG_SHA256,cards,maps,vehicles,
  results:[
   {id:'winner-trophy',format:'inline-svg',cssClass:'ccc-result-trophy',viewBox:'0 0 175 155',transparent:true},
   {id:'finish-flag',format:'inline-svg',cssClass:'ccc-result-flag',viewBox:'0 0 144 94',transparent:true}
  ]};
 assertChaosImageManifest(manifest);
 return manifest;
}
export async function verifyChaosPublishedImageManifest({sourceRoot=root,outputRoot}={}){
 check(typeof outputRoot==='string','output directory required');
 const raw=await readFile(resolve(outputRoot,CHAOS_IMAGE_MANIFEST_PATH),'utf8');
 let actual;
 try{actual=JSON.parse(raw);}catch{throw Error('CCC-ART-8 invalid image manifest JSON');}
 assertChaosImageManifest(actual);
 const expected=await createChaosImageManifest({sourceRoot,outputRoot});
 check(raw===JSON.stringify(expected)+'\n','manifest does not match exact published bytes');
 return {cards:49,transparentPngMasters:49,transparentWebpExports:49,
  atlasLayers:6,transparentForegrounds:3,svgVehicles:6,inlineResults:2,
  manifestBytes:Buffer.byteLength(raw),catalogSha256:CHAOS_CARD_CATALOG_SHA256};
}
