import assert from 'node:assert/strict';
import {cp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildExtension420} from './build.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const firefoxDir=join(root,'dist-firefox');
export async function buildFirefox420(){
 const {dist}=await buildExtension420();
 await rm(firefoxDir,{recursive:true,force:true});
 await mkdir(firefoxDir,{recursive:true});
 for(const file of await readdir(dist))
   await cp(join(dist,file),join(firefoxDir,file),{recursive:true});
 const manifest=JSON.parse(await readFile(join(firefoxDir,'manifest.json'),'utf8'));
 assert.equal(manifest.manifest_version,3);
 assert.equal(manifest.background?.service_worker,'service-worker.js');
 // Firefox uses an MV3 event-page module, not Chromium's MV3 service worker.
 manifest.background={scripts:['service-worker.js'],type:'module'};
 // Trezor Suite's Chromium externally_connectable integration must not be
 // advertised as Firefox-compatible before a device+browser review.
 delete manifest.externally_connectable;
 manifest.browser_specific_settings={gecko:{strict_min_version:'128.0'}};
 await writeFile(join(firefoxDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return firefoxDir;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 console.log('Firefox event-page extension package:',await buildFirefox420());
}
