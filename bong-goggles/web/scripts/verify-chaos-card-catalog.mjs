// CCC-2: verify all user-supplied card masters, the approved URL registry,
// and deterministic physical-card inventory BEFORE emitting any deployable WebP.
import {createHash} from 'node:crypto';
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import sharp from 'sharp';
import {
 CHAOS_ART_REGISTRY,CHAOS_CARD_ART_SOURCES,CHAOS_CARD_ART_OUTPUTS,chaosCardArt
} from '../core/chaos-card-art.js';
import {
 LEGS,MILEAGE_COUNTS,HAZARDS,FIXES,UPGRADES,LEGENDARIES,STANDARD_DECK_SIZE,
 createChaosGame,regionalDeck,assertLegendaryAllocation
} from '../core/cross-country-chaos.js';

const root=resolve(import.meta.dirname,'..');
const sourceDir='assets/games/cross-country-chaos/cards/';
const assert=(ok,reason)=>{if(!ok)throw new Error('CCC-2 card qualification: '+reason);};
const sorted=entries=>[...entries].sort().join('\n');
const exactKeys=(given,wanted,what)=>assert(sorted(Object.keys(given))===sorted(wanted),what+' identity mismatch');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function scan(dir){
 const result=[];
 for(const e of await readdir(dir,{withFileTypes:true})){
  const full=resolve(dir,e.name);
  if(e.isDirectory())result.push(...await scan(full));
  else if(e.isFile()&&e.name.endsWith('.png'))
   result.push(relative(root,full).replaceAll('\\','/'));
 }
 return result;
}

export function verifyCardRuleCatalog(){
 const registry=CHAOS_ART_REGISTRY;
 exactKeys(registry.mileage,MILEAGE_COUNTS.map(([km])=>String(km)),'mileage artwork');
 exactKeys(registry.fixes,FIXES.map(c=>c.id),'repair artwork');
 exactKeys(registry.upgrades,UPGRADES.map(c=>c.id),'upgrade artwork');
 exactKeys(registry.legendary,LEGENDARIES.map(c=>c.id),'legendary artwork');
 exactKeys(registry.hazards,LEGS.map(c=>c.id),'regional artwork groups');
 for(const leg of LEGS)exactKeys(registry.hazards[leg.id],HAZARDS[leg.id].map(c=>c.id),'hazards in '+leg.id);
 assert(LEGS.length===3&&LEGS.every(c=>c.target===2500),'three 2,500 km regions required');
 assert(MILEAGE_COUNTS.reduce((sum,[,count])=>sum+count,0)===126,'126 mileage cards required');
 assert(CHAOS_CARD_ART_SOURCES.length===49&&CHAOS_CARD_ART_OUTPUTS.length===49,'49 masters and outputs required');
 assert(new Set(CHAOS_CARD_ART_SOURCES).size===49,'duplicate source mapping');
 assert(new Set(CHAOS_CARD_ART_OUTPUTS).size===49,'duplicate output mapping');
 for(let i=0;i<49;i++){
  assert(CHAOS_CARD_ART_SOURCES[i].startsWith(sourceDir),'foreign source path');
  assert(CHAOS_CARD_ART_OUTPUTS[i]===CHAOS_CARD_ART_SOURCES[i].replace(/\.png$/,'.webp'),'source/output identity mismatch');
 }
 const mapped=new Set(CHAOS_CARD_ART_OUTPUTS.map(p=>'/'+p));
 for(const seed of [1,54,420,2026]){
  const game=createChaosGame({names:['Driver A','Driver B','Driver C','Driver D'],seed});
  assertLegendaryAllocation(game.legendaryByLeg);
  const dealt=game.players.flatMap(p=>p.hand);
  assert(dealt.length===28&&game.deck.length+dealt.length===
   STANDARD_DECK_SIZE+game.legendaryByLeg[0].length,'seven-card opening deck preservation');
  const legends=[];
  for(let stage=0;stage<3;stage++){
   const state=structuredClone(game);state.leg=stage;state.serial=0;
   const deck=regionalDeck(state);
   const region=LEGS[stage].id;
   const tally=(type,id=null)=>deck.filter(c=>c.type===type&&(id===null||c.id===id)).length;
   assert(deck.length===STANDARD_DECK_SIZE+game.legendaryByLeg[stage].length,'stage deck length '+region);
   assert(new Set(deck.map(c=>c.uid)).size===deck.length,'physical card instance collision '+region);
   for(const [km,count] of MILEAGE_COUNTS)
    assert(deck.filter(c=>c.type==='mileage'&&c.km===km).length===count,'mileage quantity '+region+'/'+km);
   for(const c of HAZARDS[region])assert(tally('hazard',c.id)===9,'hazard quantity '+region+'/'+c.id);
   for(const c of FIXES)assert(tally('fix',c.id)===12,'repair quantity '+region+'/'+c.id);
   for(const c of UPGRADES)assert(tally('upgrade',c.id)===1,'upgrade quantity '+region+'/'+c.id);
   assert(tally('legendary')===game.legendaryByLeg[stage].length,'legendary count '+region);
   legends.push(...deck.filter(c=>c.type==='legendary').map(c=>c.id));
   for(const c of deck){
    const art=chaosCardArt(c,region);
    assert(art&&mapped.has(art),'unmapped or foreign card art '+region+'/'+c.type+'/'+(c.id||c.km));
    if(c.type==='hazard')assert(art.includes('/hazards/'+region+'/'),'cross-region hazard image');
   }
  }
  assert(sorted(legends)===sorted(LEGENDARIES.map(c=>c.id)),'legendary duplication/omission across championship');
 }
 return {regions:3,sourceArtwork:49,regionalStandardCards:278,legendaryCards:4};
}

export async function verifyChaosCardCatalog(){
 const rules=verifyCardRuleCatalog();
 const sourcePaths=await scan(resolve(root,sourceDir));
 assert(sorted(sourcePaths)===sorted(CHAOS_CARD_ART_SOURCES),'missing or unexpected PNG in uploaded artwork directory');
 const common=JSON.parse(await readFile(resolve(root,sourceDir,'common/manifest.json'),'utf8'));
 assert(Array.isArray(common)&&common.length===13,'common artwork manifest must contain 13 identities');
 const entries=new Map();
 for(const item of common){
  assert(typeof item.file==='string'&&!entries.has(item.file),'duplicate or invalid common manifest entry');
  entries.set(item.file,item);
 }
 const expectedCommon=new Map([
  ...MILEAGE_COUNTS.map(([km])=>['mileage-'+km+'.png',{card:km+' km',kind:'mileage'}]),
  ...FIXES.map(c=>['fix-'+c.id+'.png',{card:c.name,kind:'fix'}])
 ]);
 assert(sorted(entries.keys())===sorted(expectedCommon.keys()),'common artwork manifest identities do not match rules');
 const digests=[];
 for(const source of CHAOS_CARD_ART_SOURCES){
  const bytes=await readFile(resolve(root,source));
  const metadata=await sharp(bytes).metadata();
  assert(metadata.format==='png'&&metadata.width===640&&metadata.height===1080&&metadata.hasAlpha,
   'invalid card master format/dimensions/transparency: '+source);
  assert(bytes.length>10000&&bytes.length<=2*1024*1024,'card master outside source size bounds: '+source);
  const sha=digest(bytes);digests.push(source+':'+sha);
  if(source.includes('/common/')){
   const file=source.slice(source.lastIndexOf('/')+1),item=entries.get(file),expected=expectedCommon.get(file);
   assert(item&&expected&&item.card===expected.card&&item.kind===expected.kind&&
    item.size==='640x1080'&&item.sha256===sha,'common art identity or pinned SHA-256 mismatch: '+file);
  }
 }
 return {...rules,catalogSha256:digest(Buffer.from(sorted(digests)))};
}
