import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createChaosGame,takeChaosTurn,advanceChaosLeg,chaosLeaders,LEGS} from '../core/cross-country-chaos.js';
import {renderChaosGame} from '../core/classics-ui.js';
import {escapeHtml as esc} from '../core/design-system.js';
import {chaosChampionshipPlacings,renderChaosRegionalResults,renderChaosChampionshipResults,renderChaosResultsHistory} from '../core/chaos-results.js';
const turn=(s,action,rest={})=>takeChaosTurn(s,{player:s.players[s.turn].id,action,...rest});
const row=(id,name,place,km,banked,total,winner=false)=>({id,name,place,km,rawKm:km+50,banked,total,winner});
function completed(){
 const s=createChaosGame({names:['Annie','Bobby','Casey','Dee'],seed:7});
 s.leg=2;s.phase='finished';s.players.forEach((p,i)=>{p.score=[7200,7200,6300,4200][i];p.wins=[1,1,0,0][i]});
 s.results=[
  {leg:0,winners:[0],standings:[row(0,'Annie',1,2500,2500,2500,true),row(1,'Bobby',2,2200,2200,2200),row(2,'Casey',3,1800,1800,1800),row(3,'Dee',4,1200,1200,1200)]},
  {leg:1,winners:[1],standings:[row(1,'Bobby',1,2500,2500,4700,true),row(0,'Annie',2,2200,2200,4700),row(2,'Casey',3,2000,2000,3800),row(3,'Dee',4,1500,1500,2700)]},
  {leg:2,winners:[0],standings:[row(0,'Annie',1,2500,2500,7200,true),row(1,'Bobby',2,2500,2500,7200),row(2,'Casey',3,2500,2500,6300),row(3,'Dee',4,1500,1500,4200)]}
 ];
 return s;
}
test('CCC-ART-7: real engine regional finish displays persistent winner graphic and canonical mileage',()=>{
 let s=createChaosGame({names:['Annie','Bobby'],seed:19});
 s.players[0].played=[{type:'mileage',km:2400,uid:9001}];s.players[0].km=2400;
 s.players[0].hand[0]={type:'mileage',km:100,uid:9002};
 s=turn(s,'drive',{index:0});s=turn(s,'discard',{index:0});
 s=turn(s,'pass');s=turn(s,'discard',{index:0});s=turn(s,'discard',{index:0});
 assert.equal(s.phase,'between');
 const before=structuredClone(s),html=renderChaosGame({game:s,revealed:false});
 for(const marker of ['Regional finish line!','ccc-results-screen--regional','ccc-results-victor',
 'ccc-result-trophy','ccc-results-table','Effective km','Raw km','Banked km','Championship total',
 'Continue to','ccc-results-board'])assert.ok(html.includes(marker),marker);
 assert.ok(html.includes(s.results[0].standings.find(x=>x.winner).name));
 assert.doesNotMatch(html,/ccc-hand-card|data-chaos-move|data-chaos-action="draw"/);
 assert.deepEqual(s,before);
 assert.equal(renderChaosRegionalResults(advanceChaosLeg(s)),'');
});
test('CCC-ART-7: stage ties preserve both recorded winners and historical scoreboard results',()=>{
 const s=completed();s.phase='between';s.leg=1;s.results=s.results.slice(0,2);
 s.results[1].standings[1].winner=true;
 const html=renderChaosRegionalResults(s);
 assert.match(html,/Joint stage winners/);
 assert.equal((html.match(/ccc-results-victor"/g)||[]).length,2);
 assert.equal((html.match(/ccc-result-winner/g)||[]).length,2);
 assert.match(html,/2,550 km/);
 assert.match(html,/4,700 km/);
 const history=renderChaosResultsHistory(s);
 assert.match(history,/The Down East Disaster/);
 assert.doesNotMatch(history,/The Never-Ending Ontario/);
});
test('CCC-ART-7: final leaderboard matches engine tie-breaks and joint champions',()=>{
 const s=completed();
 let ranks=chaosChampionshipPlacings(s);
 assert.deepEqual(ranks.map(r=>r.id),chaosLeaders(s).map(p=>p.id));
 assert.deepEqual(ranks.filter(p=>p.winner).map(p=>p.id),[0,1]);
 s.players[1].wins=2;ranks=chaosChampionshipPlacings(s);
 assert.equal(ranks[0].id,1);assert.equal(ranks.filter(p=>p.winner).length,1);
 s.players[1].wins=1;
 s.results[2].standings[1].banked=2400;ranks=chaosChampionshipPlacings(s);
 assert.equal(ranks[0].id,0);
 assert.deepEqual(ranks.slice(0,2).map(p=>p.place),[1,2]);
});
test('CCC-ART-7: championship podium, history, safe restart and secret hands',()=>{
 const s=completed(),before=structuredClone(s);
 const html=renderChaosGame({game:s,revealed:true});
 for(const marker of ['Joint grand champions','ccc-results-screen--championship','ccc-championship-podium',
 'ccc-result-trophy','Final mileage scoreboard','Stage wins','West stage banked','New championship'])
  assert.ok(html.includes(marker),marker);
 for(const leg of LEGS)assert.ok(html.includes(esc(leg.name)),'regional heading is present and safely HTML-escaped');
 assert.equal((html.match(/ccc-podium-place--champion/g)||[]).length,2);
 assert.doesNotMatch(html,/ccc-hand-card|data-chaos-move|data-chaos-action="draw"/);
 assert.deepEqual(s,before);
 s.players[0].name='<img src=x onerror=alert(1)>';
 for(const r of s.results)r.standings.find(p=>p.id===0).name=s.players[0].name;
 s.players[0].hand=[{type:'fix',name:'HIDDEN_HAND_TOKEN_91'}];
 const hostile=renderChaosGame({game:s,revealed:true});
 assert.doesNotMatch(hostile,/<img src=x onerror|HIDDEN_HAND_TOKEN_91/);
 assert.match(hostile,/&lt;img src=x onerror/);
});
test('CCC-ART-7: production budget, local art, responsive/accessibility guards',async()=>{
 const root=resolve(import.meta.dirname,'..');
 const css=await readFile(resolve(root,'ccc-tabletop.css'),'utf8');
 const source=await readFile(resolve(root,'core/chaos-results.js'),'utf8');
 const ui=await readFile(resolve(root,'core/classics-ui.js'),'utf8');
 const gate=await readFile(resolve(root,'scripts/qualify-web.mjs'),'utf8');
 for(const v of ['ccc-results-screen','ccc-results-table-scroll','ccc-result-trophy','ccc-championship-podium',
  '@media(max-width:660px)','@media(prefers-reduced-motion:reduce)','[data-motion="reduce"]','@media(forced-colors:active)'])
  assert.ok(css.includes(v),v);
 for(const v of ['renderChaosRegionalResults(game)','renderChaosChampionshipResults(game)','renderChaosResultsHistory(game)'])
  assert.ok(ui.includes(v),v);
 assert.match(gate,/baseTotal:1093\*1024/);
 assert.match(gate,/CCC-ART-7 local results\/accessibility qualification failed/);
 assert.doesNotMatch(source.replaceAll('http://www.w3.org/2000/svg',''),/\bfetch\s*\(|\bsetTimeout\s*\(|\bsetInterval\s*\(|https?:\/\//);
 assert.doesNotMatch(source,/\.hand\b|\.deck\b/);
});
