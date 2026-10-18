#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import {validateTestnetDeployment,captureTestnetHandoffEvidence} from '../src/testnet-deployment-handoff.mjs';
// Never parse or print secrets. Accept only a redacted, already verified health result.
// No remote URL is fetched by this script; actual deployment must be independently operated.
const [mode,manifestFile,evidenceFile]=process.argv.slice(2);
if(!['template','verify','capture'].includes(mode)||!manifestFile||(mode==='capture'&&!evidenceFile)){
 console.error('USAGE: node rideshare/scripts/testnet-handoff.mjs template|verify|capture <manifest> [redacted-health-json]');
 process.exitCode=2;
}else{
 try{
  const manifest=JSON.parse(readFileSync(manifestFile,'utf8'));
  const projection=validateTestnetDeployment(manifest,{allowTemplate:mode==='template'});
  if(mode==='verify'||mode==='template')process.stdout.write(JSON.stringify({verified:true,deployable:projection.deployable&&mode==='verify',manifestDigest:projection.manifestDigest,trafficEnabled:false,independentAcceptance:'NOT_ACCEPTED'})+'\n');
  else{
   const input=JSON.parse(readFileSync(evidenceFile,'utf8'));
   const report=captureTestnetHandoffEvidence({manifest,readiness:input.readiness,observation:input.observation,now:input.now});
   process.stdout.write(JSON.stringify(report)+'\n');
  }
 }catch{
  console.error('TESTNET_HANDOFF_DENIED');process.exitCode=1;
 }
}
