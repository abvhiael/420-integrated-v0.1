#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNetworkManifest420, discoverNetwork420 } from '../../../developer-hub/src/network-discovery.mjs';
import { createSecurityQualificationReport420, createSecurityQualificationView420 } from '../../../developer-hub/src/security-qualification.mjs';
import { createQualificationEvidenceHandoff420, createQualificationHandoffView420 } from '../../../developer-hub/src/qualification-handoff.mjs';
const here=dirname(fileURLToPath(import.meta.url));const repoRoot=resolve(here,'../../..');
function fail(message){console.error(`420_QUALIFY_ERROR=${message}`);process.exit(1);}
function print(value){process.stdout.write(`${JSON.stringify(value,null,2)}\n`);}
async function json420(path){return JSON.parse(await readFile(resolve(process.cwd(),path),'utf8'));}
async function selected420(evidencePath,manifestPath,profilePath){
  const profile=await json420(profilePath??resolve(repoRoot,'developer-hub/qualification/profile.v1.json'));
  const evidence=await json420(evidencePath);
  const manifest=resolve(process.cwd(),manifestPath??resolve(repoRoot,'developer-hub/manifests/local.example.json'));
  const network=discoverNetwork420(await loadNetworkManifest420(manifest));
  const report=createSecurityQualificationReport420({profile,evidence,network});
  return {profile,evidence,report};
}
async function main(){
  const args=process.argv.slice(2);const command=args[0]??'view';
  if(command==='view'){
    const profile=await json420(args[1]??resolve(repoRoot,'developer-hub/qualification/profile.v1.json'));
    return print({qualification:createSecurityQualificationView420(profile),handoff:createQualificationHandoffView420()});
  }
  if(command==='check'){
    if(!args[1])fail('usage: 420-qualify check EVIDENCE_JSON [MANIFEST_JSON] [PROFILE_JSON]');
    const {report}=await selected420(args[1],args[2],args[3]);print(report);if(report.result!=='PASS')process.exitCode=3;return;
  }
  if(command==='handoff'){
    if(!args[1]||!args[2])fail('usage: 420-qualify handoff EVIDENCE_JSON COMMIT_SHA [MANIFEST_JSON] [PROFILE_JSON]');
    const {evidence,report}=await selected420(args[1],args[3],args[4]);
    const handoff=createQualificationEvidenceHandoff420({report,evidence,expectedCommitSha:args[2]});print(handoff);if(!handoff.releaseEvidenceReady)process.exitCode=3;return;
  }
  fail('usage: 420-qualify view [PROFILE_JSON] | check EVIDENCE_JSON [MANIFEST_JSON] [PROFILE_JSON] | handoff EVIDENCE_JSON COMMIT_SHA [MANIFEST_JSON] [PROFILE_JSON]');
}
main().catch(error=>fail(error instanceof Error?error.message:String(error)));
