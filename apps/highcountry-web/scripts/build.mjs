import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {buildScopedA06Manifest} from '../../../services/highcountry-archive/src/scoped-a06.mjs';
const root=resolve(import.meta.dirname,'..');const dist=join(root,'dist');
await mkdir(dist,{recursive:true});await cp(join(root,'public'),dist,{recursive:true,force:true});await mkdir(join(dist,'src'),{recursive:true});
for(const name of ['app.js','archive-gallery.js','cultivation-art.js','cultivation-scene-layout.js','runtime.js','main.js','guest.js','cloud.js','account.js','local-auth.js','wallet.js','market.js','marketplace.js','skills.js','missions.js','discovery.js','transaction.js','routine.js'])await writeFile(join(dist,'src',name),await readFile(join(root,'src',name),'utf8'));
console.log('High Country static bundle built without substituting runtime values');

// Copy only manifest-verified immediate-scope assets; never package deferred visuals.
const repo=resolve(root,'../..');
const manifest=await buildScopedA06Manifest(repo);
if(manifest.totals.invalid)throw Error('a06-invalid-artwork');
for(const entry of [...manifest.immediate,...manifest.deferred].filter(x=>x.status==='available')){
 const dst=join(dist,entry.path);await mkdir(resolve(dst,'..'),{recursive:true});await cp(join(repo,entry.path),dst);
}
const manifestPath=join(dist,'assets/highcountry/original-sixteen/a06-scoped-manifest.json');
await mkdir(resolve(manifestPath,'..'),{recursive:true});await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log('A06 scoped public art: '+manifest.totals.available+' verified files, '+manifest.totals.missing+' pending, 64 deferred; no full closeout');
