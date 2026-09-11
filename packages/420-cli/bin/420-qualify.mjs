#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNetworkManifest420, discoverNetwork420 } from '../../../developer-hub/src/network-discovery.mjs';
import { createSecurityQualificationReport420, createSecurityQualificationView420 } from '../../../developer-hub/src/security-qualification.mjs';
const here=dirname(fileURLToPath(import.meta.url));const repoRoot=resolve(here,'../../..');
function fail(message){console.error(`420_QUALIFY_ERROR=${message}`);process.exit(1);}
function print(value){process.stdout.write(`${JSON.stringify(value,null,2)}\n`);}
async function json420(path){return JSON.parse(await readFile(resolve(process.cwd(),path),'utf8'));}
async function main(){
  const [command='view',evidencePath,manifestPath,profilePath]=process.argv.slice(2);
  const profile=await json420(profilePath??resolve(repoRoot,'developer-hub/qualification/profile.v1.json'));
  if(command==='view')return print(createSecurityQualificationView420(profile));
  if(command!=='check'||!evidencePath)fail('usage: 420-qualify view [PROFILE_JSON] | check EVIDENCE_JSON [MANIFEST_JSON] [PROFILE_JSON]');
  const evidence=await json420(evidencePath);
  const manifest=resolve(process.cwd(),manifestPath??resolve(repoRoot,'developer-hub/manifests/local.example.json'));
  const network=discoverNetwork420(await loadNetworkManifest420(manifest));
  const report=createSecurityQualificationReport420({profile,evidence,network});print(report);
  if(report.result!=='PASS')process.exitCode=3;
}
main().catch(error=>fail(error instanceof Error?error.message:String(error)));
