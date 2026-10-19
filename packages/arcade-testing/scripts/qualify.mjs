import {spawnSync} from 'node:child_process';
import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const inventory=[
 ['phaser','packages/arcade-phaser/test/lifecycle.test.mjs'],
 ['react-casual','packages/arcade-core/test/react-casual.test.mjs'],
 ['input','packages/arcade-input/test/input.test.mjs'],
 ['audio','packages/arcade-audio/test/audio.test.mjs'],
 ['saves','packages/arcade-saves/test/saves.test.mjs'],
 ['scores','packages/arcade-score/test/events.test.mjs'],
 ['controls','packages/arcade-controls/test/controls.test.mjs'],
 ['assets','packages/arcade-assets/test/assets.test.mjs'],
 ['runtime-contracts','packages/arcade-testing/test/runtime-qualification.test.mjs']
];
export function verifyInventory(){
 const seen=new Set();
 for(const [name,path] of inventory){
  if(seen.has(name)||seen.has(path)||!existsSync(resolve(root,path)))throw Error('Missing or duplicate mandatory Arcade qualification owner: '+name);
  seen.add(name);seen.add(path);
 }
 const games=JSON.parse(readFileSync(resolve(root,'config/arcade-game-identities.json'),'utf8')).games;
 const frozen=JSON.parse(readFileSync(resolve(root,'config/arcade-0-7-scope-freeze.json'),'utf8'));
 if(games.length!==11||JSON.stringify(games.map(x=>x.slug))!==JSON.stringify(frozen.scope.genesisGames)||frozen.scope.runtimeBuildsCompleted!==0)throw Error('Unapproved roster or runtime release claim');
 return {inventory:inventory.map(([owner,path])=>({owner,path})),gameCount:games.length};
}
export function runQualification({execute=true}={}){
 const checked=verifyInventory();
 const sha=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
 if(sha.status!==0||!/^[a-f0-9]{40}$/.test(sha.stdout.trim()))throw Error('Exact implementation SHA unavailable');
 const results=[];
 if(execute){
  for(const [owner,path] of inventory){
   const run=spawnSync(process.execPath,['--test',path],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
   results.push({owner,path,status:run.status===0?'PASS':'FAIL',exitCode:run.status,stderr:(run.stderr??'').slice(-2400)});
   if(run.status!==0)break;
  }
 }
 return {schema:'arcade-runtime-qualification-v1',implementationSha:sha.stdout.trim(),gameCount:checked.gameCount,results,qualified:execute&&results.length===inventory.length&&results.every(x=>x.status==='PASS'),liveNetworkQualified:false,gameRuntimeReady:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const output=runQualification();process.stdout.write(JSON.stringify(output,null,2)+'\n');if(!output.qualified)process.exitCode=1;}catch(e){process.stderr.write(String(e)+'\n');process.exitCode=1;}
}
