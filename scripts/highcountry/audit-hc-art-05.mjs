// HC-ART-05: the PNGs committed to main are authoritative. No source art alteration.
// Verifies all 197 original PNG files, canonical relative locations and image headers.
// Manifests are secondary metadata, never an excuse to reject or replace merged artwork.
import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
const base=resolve(import.meta.dirname,'../../apps/highcountry-web/public/assets/structures');
const expected={a:18,b:18,c:18,d:52,e:43,f:48};
const result={schema:'hc-art-05-main-png-authority-v2',expectedTotal:197,collections:{},failures:[],manifestReconciliation:[]};
async function collect(path,entries=[]){
 for(const e of await readdir(path,{withFileTypes:true})){
  const p=join(path,e.name);
  if(e.isDirectory())await collect(p,entries);
  else if(e.isFile()&&e.name.toLowerCase().endsWith('.png'))entries.push(p);
 }
 return entries;
}
async function manifests(path,entries=[]){
 for(const e of await readdir(path,{withFileTypes:true})){
  const p=join(path,e.name);
  if(e.isDirectory())await manifests(p,entries);
  else if(e.isFile()&&e.name==='manifest.json')entries.push(p);
 }
 return entries;
}
for(const [code,n] of Object.entries(expected)){
 const root=join(base,'hc-art-05-'+code);
 const pngs=(await collect(root)).sort();
 const manifestFiles=await manifests(root);
 let rgbaCount=0;
 const recorded=new Set();
 for(const p of pngs){
  const b=await readFile(p);
  const rel=relative(base,p).replaceAll('\\','/');
  if(b.length<26||!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
    result.failures.push({kind:'not-png',path:rel});continue;
  }
  if(b[25]!==6){result.failures.push({kind:'not-rgba',path:rel});continue;}
  if(!b.readUInt32BE(16)||!b.readUInt32BE(20)){result.failures.push({kind:'invalid-dimensions',path:rel});continue;}
  rgbaCount++;
 }
 for(const manifestPath of manifestFiles){
  let m;
  try{m=JSON.parse(await readFile(manifestPath,'utf8'));}
  catch(e){result.manifestReconciliation.push({kind:'invalid-manifest',path:relative(base,manifestPath),message:e.message});continue;}
  if(!Array.isArray(m.assets))continue;
  for(const a of m.assets){
   const filename=a.filename??a.canonical_filename;
   const location=a.repository_path??a.repo_path??a.github_path??(filename?join(manifestPath,'..',filename):null);
   if(!location)continue;
   const projectRoot=resolve(base,'../../../../../');
   const p=location.startsWith('apps/')?resolve(projectRoot,location):resolve(manifestPath,'..',location);
   recorded.add(p);
   if(!pngs.includes(p)){result.manifestReconciliation.push({kind:'stale-manifest-path',path:relative(base,manifestPath),record:a.id,asset:location});continue;}
   if(a.sha256){
    const hash=createHash('sha256').update(await readFile(p)).digest('hex');
    if(hash!==a.sha256)result.manifestReconciliation.push({kind:'stale-sha256-metadata',path:relative(base,manifestPath),record:a.id,asset:location,committedSha256:hash,recordedSha256:a.sha256});
   }
  }
 }
 const unregistered=pngs.filter(p=>!recorded.has(p)).map(p=>relative(base,p).replaceAll('\\','/'));
 result.collections[code]={expected:n,committedPngs:pngs.length,validRgbaPngs:rgbaCount,manifests:manifestFiles.length,notInManifest:unregistered.length};
 if(pngs.length!==n)result.failures.push({kind:'png-inventory-count',collection:code,expected:n,actual:pngs.length});
}
result.verifiedTotal=Object.values(result.collections).reduce((s,c)=>s+c.validRgbaPngs,0);
result.assetQualified=result.failures.length===0&&result.verifiedTotal===197;
result.modifiersQualified=false;
console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--strict')&&!result.assetQualified)process.exitCode=1;
