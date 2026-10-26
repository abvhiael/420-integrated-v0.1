// Deployment entry point. Mount reviewed configuration and CA separately; never load player signing keys.
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {FinalizedRpc} from './finalized-rpc.js';
import {parseSeedBreedingPlan} from './seed-chain-reader.js';
import {createRuntime,runtimeHttpServer} from './runtime-service.js';
import {HIGHCOUNTRY_SKILL_RESEARCH_V1} from './skill-catalog-v1.js';
import {createSignedProgressionEvidence} from './signed-progression-evidence.js';
import {createSignedPlayerLevelProvider} from './signed-player-level.js';
import {HIGHCOUNTRY_MISSIONS_V1} from './mission-catalog-v1.js';
import {createSignedMissionEvidence} from './signed-mission-evidence.js';
import {readFile as readCatalog} from 'node:fs/promises';
const required=name=>{const x=process.env[name];if(!x)throw Error(name+' required');return x;};
const config=JSON.parse(await readFile(required('HC_RUNTIME_CONFIG_FILE'),'utf8'));
const port=Number(required('PORT'));
if(!Number.isSafeInteger(port)||port<1||port>65535||!/^https:\/\//.test(config.authority?.origin))
 throw Error('reviewed HTTPS origin and valid port required');
const pool=new pg.Pool({connectionString:required('HC_DATABASE_URL'),max:8,
 ssl:{ca:await readFile(required('HC_DATABASE_CA_FILE'),'utf8'),rejectUnauthorized:true}});
try {
 const signerRpc=new FinalizedRpc(config.signerRpc);
 let progression;
 if(config.progression){
  const p=config.progression;
  if(p.catalogVersion!==HIGHCOUNTRY_SKILL_RESEARCH_V1.version)
   throw Error('unapproved progression catalogue version');
  progression={
   catalog:HIGHCOUNTRY_SKILL_RESEARCH_V1,
   verifyEvidence:createSignedProgressionEvidence({publicKey:p.evidencePublicKey,
    issuer:p.evidenceIssuer,gameId:config.authority.gameId,chainId:config.authority.chainId}),
   getPlayerLevel:createSignedPlayerLevelProvider({url:p.levelProviderUrl,
    publicKey:p.levelPublicKey,issuer:p.levelIssuer,
    gameId:config.authority.gameId,chainId:config.authority.chainId})
  };
 }
 let missions;
 if(config.missions){
  const m=config.missions;
  if(m.catalogVersion!==HIGHCOUNTRY_MISSIONS_V1.version)throw Error('unapproved mission catalogue version');
  missions={catalog:HIGHCOUNTRY_MISSIONS_V1,
   verifyEvidence:createSignedMissionEvidence({publicKey:m.evidencePublicKey,
    issuer:m.evidenceIssuer,gameId:config.authority.gameId,chainId:config.authority.chainId})};
 }
 let discovery;
 if(config.discovery){
  const d=config.discovery;
  const journeys=JSON.parse(await readCatalog(new URL('../../../deployments/highcountry/original-sixteen-discovery-journeys.v1.json',import.meta.url),'utf8'));
  const canonical=JSON.parse(await readCatalog(new URL('../../../deployments/highcountry/original-sixteen-archive.v1.json',import.meta.url),'utf8'));
  if(d.catalogVersion!==journeys.schema)throw Error('unapproved discovery version');
  discovery={journeys,canonical,verifyEvidence:createSignedMissionEvidence({
   publicKey:d.evidencePublicKey,issuer:d.evidenceIssuer,
   gameId:config.authority.gameId,chainId:config.authority.chainId})};
 }
 let seedCatalogue;
 if(config.seedCatalogue){
  const d=new URL('../../../deployments/highcountry/',import.meta.url);
  const load=async name=>JSON.parse(await readFile(new URL(name,d),'utf8'));
  if(config.seedCatalogue.version!=='HC.SEED.CATALOGUE.V1')throw Error('unapproved seed catalogue version');
  seedCatalogue={...config.seedCatalogue,catalog:await load('seed-catalog.v1.json'),research:await load('common-cultivar-research.v1.json'),rarePairs:await load('rare-parent-pairs.v1.json'),founders:await load('original-sixteen-archive.v1.json'),commonReferences:await load('common-reference-genomes.v1.json'),rarePlan:parseSeedBreedingPlan(await readFile(new URL('rare-breeding-plan.v1.json',d),'utf8'))};
 }
 if(config.seedPacks&&config.seedPacks.version!=='HC.SEED.PACKS.V1')throw Error('unapproved seed pack version');
 if(config.seedPacks&&!seedCatalogue)throw Error('seed catalogue required for issuance');
 if(config.seedOpenings&&config.seedOpenings.version!=='HC.SEED.OPENINGS.V1')throw Error('unapproved opening version');
 if(config.seedOpenings&&(!config.seedPacks||!seedCatalogue))throw Error('seed opening dependencies required');
 const runtime=await createRuntime({...config,pool,signerRpc,progression,missions,discovery,seedCatalogue});
 const server=runtimeHttpServer(runtime,{origin:config.authority.origin});
 server.listen(port,'0.0.0.0');
 let closing=false;
 const drain=()=>{if(closing)return;closing=true;server.close(async()=>{await pool.end();process.exit(0);});};
 process.on('SIGTERM',drain);process.on('SIGINT',drain);
}catch(error){await pool.end();throw error;}
