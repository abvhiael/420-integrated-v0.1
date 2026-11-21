import test from 'node:test';
import assert from 'node:assert/strict';
import {statSync} from 'node:fs';
import {resolve} from 'node:path';
import {
 CHAOS_CARD_ART_SOURCES,CHAOS_CARD_ART_OUTPUTS,CHAOS_ART_REGISTRY,
 chaosMileageArt,chaosFixArt,chaosUpgradeArt,chaosLegendaryArt,chaosHazardArt,chaosCardArt
} from '../core/chaos-card-art.js';
import {LEGS,MILEAGE_VALUES,FIXES,UPGRADES,LEGENDARIES,HAZARDS,createChaosGame} from '../core/cross-country-chaos.js';
import {renderChaosGame} from '../core/classics-ui.js';

test('all 49 uploaded PNG assets map one-to-one to approved WebP output paths',()=>{
 assert.equal(CHAOS_CARD_ART_SOURCES.length,49);
 assert.equal(CHAOS_CARD_ART_OUTPUTS.length,49);
 assert.equal(new Set(CHAOS_CARD_ART_SOURCES).size,49);
 assert.equal(new Set(CHAOS_CARD_ART_OUTPUTS).size,49);
 for(let i=0;i<49;i++){
  const src=CHAOS_CARD_ART_SOURCES[i],dst=CHAOS_CARD_ART_OUTPUTS[i];
  assert.match(src,/^assets\/games\/cross-country-chaos\/cards\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\.png$/);
  assert.equal(dst,src.replace(/\.png$/i,'.webp'));
  assert.ok(statSync(resolve(import.meta.dirname,'..',src)).size>10000,'missing uploaded source '+src);
 }
});
test('all mileage, fix, upgrade, legendary and regional hazard identities resolve with no source ambiguity',()=>{
 for(const km of MILEAGE_VALUES)assert.ok(chaosMileageArt(km)?.endsWith('/mileage-'+km+'.webp'));
 for(const fix of FIXES)assert.ok(chaosFixArt(fix.id)?.includes('/common/fix-'),fix.name);
 for(const up of UPGRADES)assert.ok(chaosUpgradeArt(up.id)?.includes('/power/upgrade-'),up.name);
 for(const power of LEGENDARIES)assert.ok(chaosLegendaryArt(power.id)?.includes('/power/legendary-'),power.name);
 for(const leg of LEGS){
  for(const h of HAZARDS[leg.id])assert.ok(chaosHazardArt(leg.id,h.id)?.includes('/hazards/'+leg.id+'/'),h.name);
 }
 assert.equal(chaosHazardArt('ontario','ferry'),null);
 assert.equal(chaosHazardArt('bad','flat'),null);
 assert.equal(chaosFixArt('__proto__'),null);
 assert.equal(chaosCardArt({type:'hazard',id:'flat'},'east'),null);
 assert.equal(chaosCardArt({type:'mileage',km:999}),null);
 assert.equal(chaosCardArt({type:'unknown',id:'truck'},'east'),null);
 assert.equal(chaosCardArt(null,'west'),null);
});
test('CCC-1 hand, installed equipment and regional hazards show approved images only after private reveal',()=>{
 const game=createChaosGame({names:['Alice','Bob','Charlie','Dana'],seed:10});
 const hidden=renderChaosGame({game,revealed:false});
 assert.doesNotMatch(hidden,/ccc-hand-card|data-chaos-move/,'private hand and actions must be concealed during handoff');
 const shown=renderChaosGame({game,revealed:true});
 assert.match(shown,/ccc-card-image/);
 assert.match(shown,/<img[^>]+loading="lazy"[^>]+decoding="async"/);
 assert.ok(game.players[0].hand.some(c=>shown.includes(chaosCardArt(c,'east'))));
 assert.equal(game.players[0].upgrades.length,0,'CCC-1 does not pre-award vehicle upgrades');
 assert.ok(!game.players[0].legendary,'CCC-1 does not pre-award legendary powers');
 game.players[0].upgrades.push({...UPGRADES[0],type:'upgrade',uid:912345});
 const equipped=renderChaosGame({game,revealed:true});
 assert.ok(equipped.includes(chaosUpgradeArt(UPGRADES[0].id)));
 game.players[0].hand[0]={...LEGENDARIES[0],type:'legendary',uid:923456};
 const powerHand=renderChaosGame({game,revealed:true});
 assert.ok(powerHand.includes(chaosLegendaryArt(LEGENDARIES[0].id)),'hand legendary uses approved artwork');
 game.players[0].status={...HAZARDS.east[0],type:'hazard'};
 assert.ok(renderChaosGame({game,revealed:true}).includes(chaosHazardArt('east','ferry')));
 game.leg=1;
 game.players[0].status={...HAZARDS.ontario[1],type:'hazard'};
 assert.ok(renderChaosGame({game,revealed:true}).includes(chaosHazardArt('ontario','whiteout')));
 assert.doesNotMatch(renderChaosGame({game,revealed:false}),/ccc-hand-card|data-chaos-move/);
 assert.ok(renderChaosGame({game,revealed:false}).includes(chaosHazardArt('ontario','whiteout')),'public hazards remain visible');
});
