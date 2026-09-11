#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductionReadiness420, createProductionReadinessView420 } from '../../../developer-hub/src/production-readiness.mjs';
const here=dirname(fileURLToPath(import.meta.url));const repoRoot=resolve(here,'../../..');
function fail(message){console.error(`420_LAUNCH_ERROR=${message}`);process.exit(1);}
function print(value){process.stdout.write(`${JSON.stringify(value,null,2)}\n`);}
async function json420(path){return JSON.parse(await readFile(resolve(process.cwd(),path),'utf8'));}
async function main(){const [command='view',qualificationPath,handoffPath,releasePath]=process.argv.slice(2);if(command==='view')return print(createProductionReadinessView420());if(command!=='check'||!qualificationPath||!handoffPath)fail('usage: 420-launch view | check QUALIFICATION_JSON HANDOFF_JSON [RELEASE_READINESS_JSON]');const qualification=await json420(qualificationPath);const ciHandoff=await json420(handoffPath);const releaseReadiness=await json420(releasePath??resolve(repoRoot,'release/readiness.json'));const report=createProductionReadiness420({qualification,ciHandoff,releaseReadiness});print(report);if(report.result!=='READY')process.exitCode=3;}
main().catch(error=>fail(error instanceof Error?error.message:String(error)));
