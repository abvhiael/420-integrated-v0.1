// Verify the exact six user-uploaded map layers before building any deployable assets.
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {CHAOS_MAP_ART,CHAOS_MAP_ASSETS,CHAOS_MAP_DIMENSIONS} from '../core/chaos-map-art.js';

const root=resolve(import.meta.dirname,'..');
const assert=(ok,message)=>{if(!ok)throw new Error('CCC-ART-2 map qualification: '+message);};
const blobSha=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
const MAP_DIR='assets/games/cross-country-chaos/maps/';
export function verifyMapRegistry(){
 assert(Object.keys(CHAOS_MAP_ART).sort().join(',')==='east,ontario,west','three regional boards required');
 assert(CHAOS_MAP_DIMENSIONS.width===2*CHAOS_MAP_DIMENSIONS.svgWidth&&
  CHAOS_MAP_DIMENSIONS.height===2*CHAOS_MAP_DIMENSIONS.svgHeight,'live SVG aspect ratio mismatch');
 assert(CHAOS_MAP_ASSETS.length===6&&new Set(CHAOS_MAP_ASSETS.map(a=>a.path)).size===6,
  'exactly six unique atlas images required');
 let total=0;
 for(const entry of CHAOS_MAP_ASSETS){
  assert(entry.path.startsWith(MAP_DIR)&&entry.path.endsWith('.webp')&&entry.url==='/'+entry.path,
   'non-allowlisted map asset path');
  assert(/^[a-f0-9]{40}$/.test(entry.gitBlobSha),'unverified source identity: '+entry.path);
  assert(Number.isSafeInteger(entry.bytes)&&entry.bytes>10000,'invalid expected source size');
  assert(entry.width===(entry.transparent?1920:1907)&&entry.height===(entry.transparent?830:825),
   'wrong approved native atlas dimensions: '+entry.path);
  assert(entry.bytes<= (entry.transparent?80*1024:4*1024*1024),'individual map asset exceeds approved budget: '+entry.path);
  total+=entry.bytes;
 }
 assert(total<=12*1024*1024,'aggregate map art exceeds the 12 MiB publication budget');
 return {regions:3,layers:CHAOS_MAP_ASSETS.length,expectedBytes:total};
}
export async function verifyChaosMapArt(){
 const inventory=verifyMapRegistry();
 const sourceFolder=resolve(root,MAP_DIR);
 const names=(await readdir(sourceFolder,{withFileTypes:true}));
 const actual=names.filter(e=>e.isFile()&&e.name.toLowerCase().endsWith('.webp')).map(e=>e.name).sort();
 const expected=CHAOS_MAP_ASSETS.map(a=>a.path.slice(MAP_DIR.length)).sort();
 assert(actual.join('|')===expected.join('|'),'missing or additional WebP map master in source directory');
 let bytes=0;
 for(const asset of CHAOS_MAP_ASSETS){
  const raw=await readFile(resolve(root,asset.path));
  assert(raw.length===asset.bytes,'uploaded image size changed: '+asset.path);
  assert(blobSha(raw)===asset.gitBlobSha,'uploaded image content differs from GitHub-approved master: '+asset.path);
  const meta=await sharp(raw).metadata();
  assert(meta.format==='webp'&&meta.width===asset.width&&meta.height===asset.height,
   'incorrect image format or dimensions: '+asset.path+' (expected '+asset.width+'x'+asset.height+', got '+meta.format+' '+meta.width+'x'+meta.height+')');
  assert(Boolean(meta.hasAlpha)===asset.transparent,
   'opaque underlay / transparent foreground contract violated: '+asset.path);
  bytes+=raw.length;
 }
 assert(bytes===inventory.expectedBytes,'unexpected map artwork total');
 return {...inventory,verifiedBytes:bytes};
}
