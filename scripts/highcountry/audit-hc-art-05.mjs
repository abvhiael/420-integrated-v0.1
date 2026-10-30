// HC-ART-05: evidence-only audit. No changes to ownership, economy or placement authority.
// Run: node scripts/highcountry/audit-hc-art-05.mjs [--strict]
import {readdir,readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,relative} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const base=join(root,'apps/highcountry-web/public/assets/structures');
const expected=Object.freeze({'a':18,'b':18,'c':18,'d':52,'e':43,'f':48});
const groups=Object.fromEntries(Object.keys(expected).map(k=>[k,[]]));
const failures=[];
async function walk(dir){
 let list;try{list=await readdir(dir,{withFileTypes:true});}catch{return;}
 for(const ent of list){
  const p=join(dir,ent.name);
  if(ent.isDirectory())await walk(p);
  else if(ent.name==='manifest.json'){
   const rel=relative(base,p).replaceAll('\\','/');
   const match=/^hc-art-05-([a-f])\//.exec(rel);
   if(!match)continue;
   const group=match[1];
   try{
    const doc=JSON.parse(await readFile(p,'utf8'));
    if(!Array.isArray(doc.assets))throw Error('missing-assets-array');
    groups[group].push({path:p,doc});
   }catch(e){failures.push({kind:'invalid-manifest',path:rel,reason:String(e.message)});}
  }
 }
}
await walk(base);
const counts={}, verified=[];
for(const [group,manifests] of Object.entries(groups)){
 let count=0;const seen=new Set();
 for(const {path,doc} of manifests){
  for(const entry of doc.assets){
   const filename=entry.filename??entry.canonical_filename;
   const location=entry.repo_path??entry.repository_path??entry.github_path??(join(path,'..',String(filename??'unknown')));
   const full=resolve(root,location);
   const asset=relative(root,full).replaceAll('\\','/');
   const key=group+'/'+String(entry.id)+'/'+asset;
   if(!filename||!asset.startsWith('apps/highcountry-web/public/assets/structures/hc-art-05-'+group+'/')||
     seen.has(key)){failures.push({kind:'invalid-or-duplicate-record',group,asset,id:entry.id});continue;}
   seen.add(key);count++;
   try{
    const bytes=await readFile(full);
    if(bytes.length<26||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('not-png');
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
    if(bytes[25]!==6)throw Error('not-rgba');
    const fp=entry.footprint_tiles,canvas=entry.canvas_px;
    const fw=Array.isArray(fp)?fp[0]:fp?.width,fh=Array.isArray(fp)?fp[1]:fp?.height;
    const cw=Array.isArray(canvas)?canvas[0]:canvas?.width,ch=Array.isArray(canvas)?canvas[1]:canvas?.height;
    if(width!==fw*320||height!==fh*320||cw!==width||ch!==height)throw Error('footprint-or-canvas-mismatch');
    if(entry.sha256&&createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('sha256-mismatch');
    verified.push(asset);
   }catch(e){failures.push({kind:'asset-validation',group,asset,id:entry.id,reason:String(e.message)});}
  }
 }
 counts[group]={expected:expected[group],manifestRecords:count,verified:verified.filter(x=>x.includes('hc-art-05-'+group+'/')).length,manifestFiles:manifests.length};
 if(count!==expected[group])failures.push({kind:'incomplete-manifest-coverage',group,expected:expected[group],found:count});
}
const report={schema:'hc-art-05-inventory-audit-v1',expectedTotal:197,playerOwnedExpected:149,governmentOwnedExpected:48,counts,verifiedAssetCount:verified.length,failures,modifierQualification:'not-proven-by-assets',note:'No unapproved modifier values, grants or placement permissions are inferred.'};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(process.argv.includes('--strict')&&failures.length)process.exitCode=1;
