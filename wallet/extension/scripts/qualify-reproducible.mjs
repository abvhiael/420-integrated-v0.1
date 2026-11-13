import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {buildExtension420} from './build.mjs';
import {buildFirefox420,firefoxDir} from './build-firefox.mjs';

const digest=x=>createHash('sha256').update(x).digest('hex');
async function inventory(root){
 const result=[];
 async function visit(dir,relative=''){
  for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
   const path=join(dir,entry.name),name=relative?relative+'/'+entry.name:entry.name;
   if(entry.isDirectory())await visit(path,name);
   else if(entry.isFile())result.push([name,digest(await readFile(path))]);
  }
 }
 await visit(root);
 return result;
}
const first=(await buildExtension420()).dist;
const firstInv=await inventory(first);
const second=(await buildExtension420()).dist;
assert.deepEqual(await inventory(second),firstInv,'Same-source Chromium package must have identical bytes on repeated builds');
const firefox=await buildFirefox420();
const ffInv=await inventory(firefox);
assert.equal(firstInv.length>10,true);
assert.deepEqual(ffInv.filter(([path])=>path!=='manifest.json'),firstInv.filter(([path])=>path!=='manifest.json'),
 'Firefox must reuse the identical reviewed code, with only browser manifest configuration varying');
const ff=JSON.parse(await readFile(join(firefox,'manifest.json'),'utf8'));
assert.deepEqual(ff.background,{scripts:['service-worker.js'],type:'module'});
assert.equal(ff.background.service_worker,undefined);
assert.equal(ff.externally_connectable,undefined);
assert.equal(ff.browser_specific_settings.gecko.strict_min_version,'128.0');
if(process.env.WALLET_PRODUCTION_RELEASE==='1'){
 for(const file of ['vendor/trezor-connect-10.bundle.js','vendor/walletconnect-walletkit.bundle.js']){
  assert(firstInv.some(([path])=>path===file),'Release SDK bundle missing: '+file);
 }
 // A reproducible build from already installed deps is necessary but not
 // sufficient. A committed transitive dependency lock and independent audit
 // are release gates, never bypassed by this checker.
 assert.equal(process.env.WALLET_EXTERNAL_AUDIT_APPROVED,'true','Independent external custody/security audit required');
}
console.log('PASS: byte-for-byte double-build Chromium, distinct Firefox event-page manifest, common code digest parity');
console.log('Chromium SHA256 inventory:',JSON.stringify(firstInv));
console.log('Firefox SHA256 inventory:',JSON.stringify(ffInv));
