// A06 scoped art manifest: reporting only, never awards or revokes entitlements.
import {createHash} from 'node:crypto';
import {readFile, stat} from 'node:fs/promises';
import {join, relative, resolve} from 'node:path';

const prefix='assets/highcountry/original-sixteen/';
export const standardKinds=['seed-front','seed-back','founder-seal','archive-key-art','fragment-01','fragment-02','fragment-03','fragment-04','final-revelation'];
export const deferredKinds=['archive-front','archive-back','bud-illustration','botanical-plate'];
export const sharedMasters=[
 'seed-packet-master','region-style-emerald','region-style-prairie','region-style-mesa',
 'archive-screen-background','fragment-card-template','discovery-locked-overlay',
 'discovery-unlocked-overlay','founder-master-set-display','collection-case-emerald',
 'collection-case-prairie','collection-case-mesa','founder-badge-and-archive-stamp-master'
].map(x=>prefix+'a01/'+x+'.svg');
export const founderPath=(id,kind)=>prefix+'hc-f'+String(id).padStart(2,'0')+'-'+kind+'.png';
export const immediatePaths=Object.freeze([...sharedMasters,...Array.from({length:16},(_,i)=>standardKinds.map(kind=>founderPath(i+1,kind))).flat()]);
export const deferredPaths=Object.freeze(Array.from({length:16},(_,i)=>deferredKinds.map(kind=>founderPath(i+1,kind))).flat());
if(immediatePaths.length!==157||deferredPaths.length!==64||new Set([...immediatePaths,...deferredPaths]).size!==221)throw Error('a06-inventory-invariant');

async function inspect(root,path){
 const target=resolve(root,path);
 if(relative(resolve(root),target).startsWith('..'))throw Error('unsafe-path');
 let bytes;
 try{const info=await stat(target);if(!info.isFile())return {path,status:'missing'};bytes=await readFile(target);}
 catch(e){if(e.code==='ENOENT')return {path,status:'missing'};throw e;}
 let width=null,height=null;
 if(path.endsWith('.png')){
  if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.toString('ascii',12,16)!=='IHDR')return {path,status:'invalid',reason:'png-header'};
  width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);
  if(width===0||height===0)return {path,status:'invalid',reason:'png-dimensions'};
 }else if(path.endsWith('.svg')){
  const str=bytes.toString('utf8');
  if(!/<svg\\b/.test(str)||/<script\\b|onload\\s*=|javascript:/i.test(str))return {path,status:'invalid',reason:'svg-invalid-or-active-content'};
 }
 return {path,status:'available',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),...(width?{width,height}:{})};
}
export async function buildScopedA06Manifest(root){
 const immediate=await Promise.all(immediatePaths.map(path=>inspect(root,path)));
 // Deliberately never read deferred files: entitlement logic and later production are independent.
 const deferred=deferredPaths.map(path=>({path,status:'deferred',reason:'owner-approved-pre-public-release'}));
 const present=immediate.filter(x=>x.status==='available').length;
 return {schema:'HC.ORIGINAL_SIXTEEN.A06.SCOPED.V1',status:'SCOPED_PARTIAL_NOT_221_CLOSEOUT',
  generatedAt:null,totals:{full:221,immediate:157,deferred:64,available:present,missing:immediate.filter(x=>x.status==='missing').length,invalid:immediate.filter(x=>x.status==='invalid').length},
  immediate,deferred,qualification:{level:1,fullA06Qualified:false},
  policy:{entitlementsIndependentOfArtwork:true,founderRevelationRetained:true,archiveEditionEntitlementsRetained:true,founderSealsRetained:true,museumEntitlementsRetained:true,masterRewardRetained:true,geneticsUnchanged:true}};
}
// Explicit fail-closed lookup: only verified available images are served; the caller may render its existing fallback.
export function resolveOriginalSixteenArt(manifest,path){
 if(!immediatePaths.includes(path)||manifest?.schema!=='HC.ORIGINAL_SIXTEEN.A06.SCOPED.V1')return null;
 const entry=manifest.immediate?.find(x=>x.path===path);
 return entry?.status==='available'&&/^[a-f0-9]{64}$/.test(entry.sha256)?'/'+path:null;
}
