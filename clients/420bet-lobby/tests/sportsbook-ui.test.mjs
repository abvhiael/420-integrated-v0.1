import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFileSync} from 'node:fs';
import {SPORTSBOOK_TABS,SPORTSBOOK_SPORTS,validSportsbookTab,
 createSportsbookView,validateSportsbookMarquee,loadSportsbookMarquee} from '../src/sportsbook-ui.js';
const now=Date.parse('2026-11-07T17:00:00.000Z');
const feed=()=>({source:'verified-sports-fixtures-v1',authority:'verified',
 date:'2026-11-07',timezone:'America/Regina',observedAt:'2026-11-07T16:55:00Z',
 expiresAt:'2026-11-07T19:00:00Z',
 events:[{id:'fixture-1',league:'NHL',home:'Home Team',away:'Away Team',startsAt:'2026-11-07T22:00:00Z',status:'scheduled'}]});
test('Sportsbook keeps approved full-bleed wallpaper, seven working tab destinations and no duplicated title',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 let chosen=null,back=0;
 const view=createSportsbookView(document,{onNavigate:id=>{chosen=id;},onBack:()=>{back++;},
  fetcher:async()=>({ok:false}),autoRefresh:false,clock:()=>now});
 assert.equal(view.dataset.sportsbookPage,'home');
 assert.equal(view.dataset.transactions,'disabled');
 assert.equal(view.querySelectorAll('.sb-menu-action').length,7);
 assert.equal(view.querySelectorAll('.sb-back').length,1);
 assert.equal(view.querySelectorAll('h1').length,0);
 assert.equal(view.querySelectorAll('.sb-chalkboard').length,1);
 for(const [i,t] of SPORTSBOOK_TABS.entries()){
  assert.equal(validSportsbookTab(t.id),t.id);
  view.querySelectorAll('.sb-menu-action')[i].click();
  assert.equal(chosen,t.id);
 }
 assert.equal(validSportsbookTab('__invalid'),null);
 view.querySelector('.sb-back').click();assert.equal(back,1);
 view.stopAnimation();
});
test('Unconnected daily feed fails closed; no invented matches, odds, times or bets',async()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const view=createSportsbookView(document,{fetcher:async()=>({ok:false}),autoRefresh:false,clock:()=>now});
 await view.ready;
 assert.match(view.querySelector('.sb-board-empty').textContent,/verified sports feed is connected/i);
 assert.equal(view.querySelectorAll('.sb-matchup').length,0);
 assert.equal(view.querySelectorAll('[data-wager]').length,0);
 assert.equal(view.querySelectorAll('.sb-chalkboard button').length,0);
 view.stopAnimation();
});
test('Only current server-verified fixtures may populate chalkboard; never treat image chalk as odds',async()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const view=createSportsbookView(document,{
  fetcher:async()=>({ok:true,headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>feed()}),
  autoRefresh:false,clock:()=>now});
 await view.ready;
 assert.equal(view.querySelectorAll('.sb-matchup').length,1);
 assert.match(view.querySelector('.sb-matchup-teams').textContent,/Away Team vs Home Team/);
 assert.equal(view.querySelector('.sb-matchup-league').textContent,'NHL');
 assert.equal(view.querySelectorAll('.sb-matchup button').length,0);
 view.stopAnimation();
});
test('Fixture feed rejects invented prices, stale data, cross-origin endpoints and wrong response types',async()=>{
 assert.equal(validateSportsbookMarquee(feed(),now).events.length,1);
 for(const changes of [
  {source:'invented'},{authority:'illustrative'},{observedAt:'2026-11-06T12:00:00Z'},
  {expiresAt:'2026-11-07T16:00:00Z'},{timezone:'Not/AZone'}
 ])assert.throws(()=>validateSportsbookMarquee({...feed(),...changes},now));
 assert.throws(()=>validateSportsbookMarquee({...feed(),events:[{...feed().events[0],odds:'-145'}]},now));
 assert.throws(()=>validateSportsbookMarquee({...feed(),events:[feed().events[0],feed().events[0]]},now));
 for(const path of ['https://odds.test/data','//odds.test/data','/fixture?fake=1']){
  await assert.rejects(()=>loadSportsbookMarquee(path,{fetcher:async()=>({ok:true}),now}));
 }
 const badType=()=>({ok:true,headers:{get:()=> 'text/html'},json:async()=>feed()});
 await assert.rejects(()=>loadSportsbookMarquee('/api/420bet/sportsbook/marquee',{fetcher:badType,now}));
});
test('Subpages preserve wallpaper, accessible back navigation and sports categories',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 let next='unset';
 for(const tab of SPORTSBOOK_TABS){
  const view=createSportsbookView(document,{tab:tab.id,onNavigate:id=>{next=id;},autoRefresh:false});
  assert.equal(view.dataset.sportsbookPage,tab.id);
  assert.equal(view.querySelector('.sb-layer h1').textContent,tab.label);
  assert.equal(view.querySelectorAll('.sb-menu').length,0);
  assert.equal(view.querySelectorAll('.sb-chalkboard').length,0);
  view.querySelector('.sb-layer-back').click();assert.equal(next,null);
  if(tab.id==='all-sports')assert.equal(view.querySelectorAll('.sb-sport-tile').length,SPORTSBOOK_SPORTS.length);
  view.stopAnimation();
 }
});
test('Sportsbook launcher is independent of fantasy, casino games and URLs',()=>{
 const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/sportsbook.css',import.meta.url),'utf8');
 assert(src.includes("active.id==='sportsbook'?'immersive sportsbook-immersive'"));
 assert(src.includes('createSportsbookView(document,{tab,marqueeEndpoint:'));
 assert(src.includes("location.pathname+'#game=sportsbook'"));
 assert(src.includes("g.id==='sportsbook'?' art-bud-ball-sportsbook'"));
 assert(src.includes('createFantasySportsView(document'));
 assert(css.includes('/assets/420bet/sportsbook/sportsbook-wallpaper.png'));
 assert(css.includes('.sb-chalkboard'));
 assert(css.includes('.sb-menu-action'));
 assert(css.includes('@media(max-width:720px)'));
});

test('HTTP failures explain the actual failing sportsbook layer instead of generic wait messages',async()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const unavailable=async()=>({ok:false,status:503,
  headers:{get:()=> 'application/json'},
  json:async()=>({error:'sports_feed_not_configured'})});
 const home=createSportsbookView(document,{fetcher:unavailable,autoRefresh:false});
 await home.ready;
 assert.match(home.querySelector('.sb-board-empty').textContent,/secret is missing/i);
 home.stopAnimation();
 const lineError=async()=>({ok:false,status:503,
  headers:{get:()=> 'application/json'},
  json:async()=>({error:'odds_budget_not_configured'})});
 const lines=createSportsbookView(document,{tab:'game-lines',fetcher:lineError,autoRefresh:false});
 await lines.ready;
 assert.match(lines.querySelector('.sb-lines-empty').textContent,/budget binding/i);
 lines.stopAnimation();
 const html=async()=>({ok:true,status:200,headers:{get:()=> 'text/html'}});
 const unbundled=createSportsbookView(document,{fetcher:html,autoRefresh:false});
 await unbundled.ready;
 assert.match(unbundled.querySelector('.sb-board-empty').textContent,/Worker route may not be deployed/i);
 unbundled.stopAnimation();
});
