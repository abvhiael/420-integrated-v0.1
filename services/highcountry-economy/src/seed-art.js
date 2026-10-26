import manifest from '../../../deployments/highcountry/seed-assets.v1.json' with {type:'json'};
import {SettlementError} from './buds-ledger.js';
export function reconcileSeedArt(catalog,assets=manifest){
 const fail=()=>{throw new SettlementError('canonical seed asset reconciliation failed');};
 if(assets?.schema!=='HC.SEED.ASSETS.V1'||assets.entries?.length!==146)fail();
 const paths=new Set(),ids=new Set(),counts={};const byCultivar=new Map(catalog.cultivars.map(c=>[c.id,c])),mapped=new Map();
 for(const e of assets.entries){
  if(ids.has(e.id)||paths.has(e.repositoryPath)||!/^([a-f0-9]{40})$/.test(e.gitBlobSha1)||!/^\/assets\/highcountry\/[a-z0-9/_-]+\.png$/.test(e.publicPath)||e.repositoryPath.includes('..')||!Number.isSafeInteger(e.bytes)||e.bytes<1||(e.sha256!==null&&!/^[a-f0-9]{64}$/.test(e.sha256)))fail();
  const c=e.cultivarId?byCultivar.get(e.cultivarId):null,slug=c?.id.toLowerCase(),group=c?.tier==='exclusive'?'original-sixteen':c?.tier;
  let expected;
  if(e.role==='illustration'&&c)expected=c.tier==='exclusive'?'/assets/highcountry/original-sixteen/'+slug+'-botanical-plate.png':'/assets/highcountry/seed-catalogue/'+c.tier+'/'+slug+'-botanical-plate.png';
  else if(e.role==='harvest-card'&&c)expected='/assets/highcountry/seed-catalogue/harvest-cards/'+group+'/'+slug+'-harvest-card.png';
  else if(e.role==='seed-icon'&&['Emerald Coast','Golden Prairie','Red Mesa'].includes(e.region)&&['common','rare','exclusive'].includes(e.tier))expected='/assets/highcountry/seed-icons/hc-seed-icon-'+e.region.toLowerCase().replaceAll(' ','-')+'-'+e.tier+'.png';
  else if(e.role==='pack'&&['Emerald Coast','Golden Prairie','Red Mesa','World'].includes(e.region))expected='/assets/highcountry/seed-packs/hc-seed-pack-'+e.region.toLowerCase().replaceAll(' ','-')+'.png';
  else if(e.role==='harvest-seal'&&['common','rare','exclusive'].includes(e.tier))expected='/assets/highcountry/seed-catalogue/harvest-cards/seals/hc-harvest-seal-'+(e.tier==='exclusive'?'original-sixteen':e.tier)+'.png';
  if(!expected||e.publicPath!==expected||('/'+e.repositoryPath.replace('apps/highcountry-web/public/',''))!==expected)fail();
  ids.add(e.id);paths.add(e.repositoryPath);counts[e.role]=(counts[e.role]??0)+1;
  if(e.cultivarId){const c=byCultivar.get(e.cultivarId);if(!c||c.region!==e.region||c.tier!==e.tier||!['illustration','harvest-card'].includes(e.role))fail();const row=mapped.get(c.id)??{};if(row[e.role])fail();row[e.role]=e.publicPath;mapped.set(c.id,row);}
 }
 for(const [role,count] of Object.entries({illustration:65,'harvest-card':65,'seed-icon':9,pack:4,'harvest-seal':3}))if(counts[role]!==count)fail();
 for(const c of catalog.cultivars){const row=mapped.get(c.id);if(!row?.illustration||!row['harvest-card'])fail();const icon=assets.entries.filter(e=>e.role==='seed-icon'&&e.region===c.region&&e.tier===c.tier),seal=assets.entries.filter(e=>e.role==='harvest-seal'&&e.tier===c.tier);if(icon.length!==1||seal.length!==1)fail();Object.assign(row,{harvestCard:row['harvest-card'],seedIcon:icon[0].publicPath,harvestSeal:seal[0].publicPath});delete row['harvest-card'];}
 return mapped;
}
