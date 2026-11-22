// BC-0.12: source-bound release approval for the 25 *account* Classics.
// A successful test against a mock transport is never production acceptance.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {CLASSIC_ROADMAP} from '../core/classics.js';

export const BC12_REPO='abvhiael/420-integrated-v0.1';
export const BC12_WORKFLOWS=Object.freeze({
 framework:'.github/workflows/bc-0-12-classics-qualification.yml',
 live:'.github/workflows/bc-0-12-classics-live-acceptance.yml'
});
const SHA=/^[a-f0-9]{40}$/;
const knownKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).every(key=>keys.includes(key))&&keys.every(key=>Object.hasOwn(value,key));
const allTitles=()=>CLASSIC_ROADMAP.map(x=>x.id);
const reject=(reason)=>{throw new Error('BC-0.12 release denied: '+reason)};

export function assertCatalogueAndEvidence({manifest,roadmap=CLASSIC_ROADMAP}){
 if(!Array.isArray(roadmap)||roadmap.length!==25||
  roadmap.some((game,i)=>game.id!==allTitles()[i]||game.milestone!=='BC-'+(i+1)||
    !['main','canadian'].includes(game.collection))||
  new Set(roadmap.map(x=>x.id)).size!==25)reject('canonical game list/order changed');
 if(!knownKeys(manifest,['schema','games'])||
  manifest.schema!=='bc-0-12-release-evidence-v1'||!manifest.games||
  typeof manifest.games!=='object'||Array.isArray(manifest.games))reject('invalid evidence schema');
 const ids=Object.keys(manifest.games);
 if(ids.some(id=>!allTitles().includes(id)))reject('unknown or unrelated game evidence');
 // The catalogue's editorial "registry" state never means runnable;
 // any later "account" title must possess a separately verified proof.
 for(let i=0;i<roadmap.length;i++){
  const item=roadmap[i];
  if(!['planned','registry','account'].includes(item.status))reject('unknown game status '+item.id);
  if(item.status==='account'&&!manifest.games[item.id])reject('game marked playable without evidence '+item.id);
  if(manifest.games[item.id]&&!checkEvidenceShape(item.id,manifest.games[item.id]))
   reject('unqualified release record '+item.id);
  if(manifest.games[item.id]&&i>0&&roadmap.slice(0,i).some(prev=>
   prev.status!=='account'||!manifest.games[prev.id]))
   reject('game release out of mandatory roadmap order '+item.id);
 }
 return Object.freeze({count:roadmap.length,released:ids.length,locked:roadmap.length-ids.length});
}
export function checkEvidenceShape(gameId,proof){
 if(!knownKeys(proof,['gameId','sourceSha','rulesHash','deployedOrigin','frameworkRunId',
  'liveRunId','result','evidenceVersion']))return false;
 if(proof.gameId!==gameId||proof.evidenceVersion!==1||!SHA.test(proof.sourceSha)||
  !/^[a-f0-9]{64}$/.test(proof.rulesHash)||proof.deployedOrigin!=='https://bonggoggles.420integrated.org'||
  !Number.isSafeInteger(proof.frameworkRunId)||proof.frameworkRunId<1||
  !Number.isSafeInteger(proof.liveRunId)||proof.liveRunId<1||
  proof.frameworkRunId===proof.liveRunId||
  proof.result!=='completed-two-account-match')return false;
 return true
}
function supportedRun(x,proof,workflow){
 return x&&x.conclusion==='success'&&x.status==='completed'&&
  x.head_sha===proof.sourceSha&&x.repository?.full_name===BC12_REPO&&
  typeof x.path==='string'&&x.path.split('@')[0].endsWith(workflow)&&
  (workflow===BC12_WORKFLOWS.live?x.event==='workflow_dispatch':
    ['push','pull_request','workflow_dispatch'].includes(x.event));
}
export async function verifyReleaseEvidence(gameId,proof,{fetchImpl=fetch,token=process.env.GITHUB_TOKEN}={}){
 if(!allTitles().includes(gameId)||!checkEvidenceShape(gameId,proof))reject('invalid proof '+gameId);
 for(const [kind,runId] of [['framework',proof.frameworkRunId],['live',proof.liveRunId]]){
  const url='https://api.github.com/repos/'+BC12_REPO+'/actions/runs/'+runId;
  const headers={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  if(token)headers.Authorization='Bearer '+token;
  let response;
  try{response=await fetchImpl(url,{headers,signal:AbortSignal.timeout(12_000),redirect:'error'});}
  catch{reject('unreachable GitHub attestation for '+kind);}
  if(!response?.ok)reject('GitHub attestation HTTP failure for '+kind);
  const data=await response.json();
  if(!supportedRun(data,proof,BC12_WORKFLOWS[kind]))
   reject('missing, failed or wrong-sha '+kind+' attestation for '+gameId);
  if(kind==='live'&&(data.name!=='BC-0.12 Live Classics Acceptance'||
   data.head_branch!=='main'||data.inputs?.game_id!==gameId||
   data.inputs?.rules_hash!==proof.rulesHash))
   reject('live attestation game, ruleset, main branch or workflow mismatch');
 }
 return Object.freeze({gameId,sha:proof.sourceSha,verified:true});
}
export async function auditRelease({manifest,fetchImpl=fetch,token=process.env.GITHUB_TOKEN}){
 const summary=assertCatalogueAndEvidence({manifest});
 for(const item of CLASSIC_ROADMAP){
  if(item.status==='account'||Object.hasOwn(manifest.games,item.id)){
   if(!manifest.games[item.id]||item.status!=='account')
    reject('release evidence and enabled catalogue must agree: '+item.id);
   await verifyReleaseEvidence(item.id,manifest.games[item.id],{fetchImpl,token});
  }
 }
 return summary;
}
export async function loadReleaseEvidence(){
 return JSON.parse(await readFile(fileURLToPath(new URL('../../../docs/games/classics/BC-0-12-RELEASE-EVIDENCE.json',import.meta.url)),'utf8'));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const action=process.argv[2];
 if(action!=='--audit')reject('use --audit; live acceptance is a separate authoritative workflow');
 auditRelease({manifest:await loadReleaseEvidence()}).then(x=>{
  console.log('BC-0.12 catalogue/release audit:',JSON.stringify(x),
   '(mocked tests cannot authorize Play)');
 }).catch(e=>{console.error(e.message);process.exitCode=1});
}
