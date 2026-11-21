import test from 'node:test';
import assert from 'node:assert/strict';
import {
 LEGS,MILEAGE_COUNTS,HAZARDS,FIXES,UPGRADES,LEGENDARIES,
 createChaosGame,regionalDeck,assertLegendaryAllocation,advanceChaosLeg,canFix
} from '../core/cross-country-chaos.js';
import {
 CHAOS_CARD_ART_SOURCES,CHAOS_CARD_ART_OUTPUTS,chaosCardArt
} from '../core/chaos-card-art.js';
import {
 verifyCardRuleCatalog,verifyChaosCardCatalog
} from '../scripts/verify-chaos-card-catalog.mjs';
import {renderChaosGame} from '../core/classics-ui.js';

const names=['Driver 1','Driver 2','Driver 3','Driver 4'];
const allCards=(game,leg)=>{
 const state=structuredClone(game);state.leg=leg;state.serial=0;
 return regionalDeck(state);
};
test('CCC-2: uploaded PNG source hashes, file identities, sizes, alpha and card-art URL allowlist match rules',async()=>{
 const result=await verifyChaosCardCatalog();
 assert.deepEqual({regions:result.regions,sourceArtwork:result.sourceArtwork,regionalStandardCards:result.regionalStandardCards,legendaryCards:result.legendaryCards},
  {regions:3,sourceArtwork:49,regionalStandardCards:278,legendaryCards:4});
 assert.match(result.catalogSha256,/^[0-9a-f]{64}$/);
 assert.equal(CHAOS_CARD_ART_SOURCES.length,49);
 assert.equal(CHAOS_CARD_ART_OUTPUTS.length,49);
});
test('CCC-2: single artwork resolver covers every card including powers, and rejects foreign identities',()=>{
 const game=createChaosGame({names,seed:13});
 for(let stage=0;stage<3;stage++)for(const c of allCards(game,stage)){
  const image=chaosCardArt(c,LEGS[stage].id);
  assert.ok(image?.startsWith('/assets/games/cross-country-chaos/cards/'),c.type);
  assert.ok(CHAOS_CARD_ART_OUTPUTS.includes(image.slice(1)),'unqualified visual identity '+image);
  if(c.type==='hazard')assert.ok(image.includes('/hazards/'+LEGS[stage].id+'/'));
 }
 assert.equal(chaosCardArt({type:'hazard',id:'ferry'},'ontario'),null);
 assert.equal(chaosCardArt({type:'upgrade',id:'__proto__'},'east'),null);
 assert.equal(chaosCardArt({type:'legendary',id:'fake'},'west'),null);
 assert.equal(chaosCardArt({type:'mileage',km:550},'west'),null);
 assert.equal(chaosCardArt({type:'unknown',id:'truck'},'west'),null);
});
test('CCC-2: championship has exactly four distinct legendaries, allocated 1/1/2 and forbidden to duplicate',()=>{
 for(let seed=1;seed<=48;seed++){
  const game=createChaosGame({names,seed});
  assert.equal(assertLegendaryAllocation(game.legendaryByLeg),true);
  assert.deepEqual(game.legendaryByLeg.map(x=>x.length).sort(),[1,1,2]);
  assert.deepEqual(game.legendaryByLeg.flat().sort(),LEGENDARIES.map(x=>x.id).sort());
  for(let stage=0;stage<3;stage++)
   assert.deepEqual(allCards(game,stage).filter(c=>c.type==='legendary').map(c=>c.id).sort(),
    [...game.legendaryByLeg[stage]].sort());
 }
 const game=createChaosGame({names,seed:8});
 const duplicate=structuredClone(game);
 duplicate.legendaryByLeg[0][0]=duplicate.legendaryByLeg[1][0];
 assert.throws(()=>regionalDeck(duplicate),/Four unique legendary/);
 const missing=structuredClone(game);
 missing.legendaryByLeg[0]=[];
 assert.throws(()=>regionalDeck(missing),/Invalid championship legendary distribution/);
 const forged=structuredClone(game);
 forged.legendaryByLeg[0][0]='unknown-power';
 assert.throws(()=>regionalDeck(forged),/Four unique legendary/);
 assert.throws(()=>regionalDeck({...game,leg:3}),/Invalid regional stage/);
});
test('CCC-2: each region retains exactly 278 base cards with canonical hazard/fix/upgrades inventory',()=>{
 assert.deepEqual(LEGS.map(l=>l.target),[2500,2500,2500]);
 assert.equal(verifyCardRuleCatalog().regionalStandardCards,278);
 for(const region of LEGS){
  assert.equal(HAZARDS[region.id].length,8);
  assert.equal(new Set(HAZARDS[region.id].map(h=>h.id)).size,8);
 }
 assert.equal(FIXES.length,6);assert.equal(UPGRADES.length,8);
 assert.deepEqual(MILEAGE_COUNTS.map(x=>x[1]),[30,26,22,18,14,10,6]);
 for(let i=0;i<3;i++){
  const game=createChaosGame({names,seed:192+i});
  const deck=allCards(game,i);
  const count=(type)=>deck.filter(c=>c.type===type).length;
  assert.equal(count('mileage'),126);assert.equal(count('hazard'),72);
  assert.equal(count('fix'),72);assert.equal(count('upgrade'),8);
  assert.equal(count('legendary'),game.legendaryByLeg[i].length);
  assert.equal(new Set(deck.map(c=>c.uid)).size,deck.length);
 }
});
test('CCC-2: physically different regional shuffles preserve each master identity and discard earlier-region decks',()=>{
 const a=createChaosGame({names,seed:26}),b=createChaosGame({names,seed:26});
 assert.deepEqual(a,b,'same seed yields identical initial deal, allocation and deck');
 const x=[0,1,2].map(leg=>allCards(a,leg).map(c=>c.type+':'+(c.id||c.km)).join('|'));
 assert.notEqual(x[0],x[1]);assert.notEqual(x[1],x[2]);assert.notEqual(x[0],x[2]);
 const startSerial=a.serial;
 a.phase='between';
 a.players[0].upgrades=[{id:'duct-tape',category:'mechanical'}];
 a.players[0].status={kind:'block',category:'road'};
 a.players[0].played=[{type:'mileage',km:200}];
 a.players[0].km=200;
 const next=advanceChaosLeg(a);
 assert.equal(next.leg,1);
 assert.equal(next.deck.length+next.players.reduce((sum,p)=>sum+p.hand.length,0),
  278+next.legendaryByLeg[1].length);
 assert.ok(next.deck.every(c=>c.uid>startSerial));
 assert.ok(next.players.every(p=>p.upgrades.length===0&&p.status===null&&p.played.length===0&&p.hand.length===7));
 assert.ok(next.discard.length===0&&next.spent.length===0);
});
test('CCC-2: named repairs match hazard categories; navigation shortcut never undoes permanent detours',()=>{
 const generic={type:'fix',id:'help',category:'all'};
 for(const leg of LEGS)for(const h of HAZARDS[leg.id]){
  if(h.kind==='detour')continue;
  assert.equal(canFix(h,generic),true);
  const matched=FIXES.find(c=>c.category===h.category);
  if(matched)assert.equal(canFix(h,{...matched,type:'fix'}),matched.id!=='atlas');
 }
 assert.equal(canFix({category:'navigation',kind:'detour'},{type:'fix',id:'atlas',category:'navigation'}),false);
});

test('CCC-2: played mileage artwork is stacked highest first and the discard top remains an illustrated face-up card',()=>{
 const game=createChaosGame({names,seed:85});
 game.players[0].played=[
  {type:'mileage',km:100},{type:'mileage',km:500},
  {type:'mileage',km:100},{type:'mileage',km:250}
 ];
 game.discard=[{type:'mileage',km:400},{type:'fix',id:'jerry',name:'Emergency Jerry Can'}];
 const revealed=renderChaosGame({game,revealed:true});
 const stacks=revealed.split('<div class="ccc-mileage-played"')[1].split('</div>')[0];
 assert.match(stacks,/mileage-500\.webp/);
 assert.match(stacks,/mileage-250\.webp/);
 assert.match(stacks,/mileage-100\.webp/);
 assert.ok(stacks.indexOf('mileage-500')<stacks.indexOf('mileage-250'));
 assert.ok(stacks.indexOf('mileage-250')<stacks.indexOf('mileage-100'));
 assert.match(stacks,/100 km × 2/);
 assert.match(revealed,/class="ccc-discard-top"/);
 assert.match(revealed,/fix-jerry\.webp/);
 const privateView=renderChaosGame({game,revealed:false});
 assert.doesNotMatch(privateView,/class="ccc-discard-top"|ccc-mileage-card-stack/);
});
