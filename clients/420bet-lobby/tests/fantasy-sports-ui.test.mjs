import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFileSync} from 'node:fs';
import {createFantasySportsView,FANTASY_TABS,validFantasyTab} from '../src/fantasy-sports-ui.js';
test('Fantasy Sports landing has exactly five navigation actions and no duplicated logo or title',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const visited=[];
 const page=createFantasySportsView(document,{onNavigate:id=>visited.push(id)});
 assert.equal(page.dataset.fantasyPage,'home');
 assert.equal(page.dataset.transactions,'disabled');
 assert.equal(page.querySelectorAll('.fs-menu-action').length,5);
 assert.equal(page.querySelectorAll('h1').length,0);
 assert.equal(page.querySelectorAll('img').length,0);
 assert.equal(page.querySelectorAll('.fs-hero,.fs-header,.fs-title,.fs-footer').length,0);
 assert.deepEqual(FANTASY_TABS.map(t=>t.id),[
  'create-league','join-league','live-drafts','my-teams','leaderboards'
 ]);
 for(const [i,slug] of FANTASY_TABS.map(t=>t.id).entries())page.querySelectorAll('.fs-menu-action')[i].click();
 assert.deepEqual(visited,FANTASY_TABS.map(t=>t.id));
});
test('Every layer deep-link has its own placeholder and a working return to Fantasy Sports',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 for(const {id,label} of FANTASY_TABS){
  const calls=[];
  const page=createFantasySportsView(document,{tab:id,onNavigate:next=>calls.push(next)});
  assert.equal(page.dataset.fantasyPage,id);
  assert.equal(page.querySelector('h1').textContent,label);
  assert.match(page.textContent,/Awaiting authoritative testnet integration/);
  assert.equal(page.querySelectorAll('.fs-menu-action').length,0);
  page.querySelector('.fs-layer-home').click();
  assert.deepEqual(calls,[null]);
 }
 assert.equal(validFantasyTab('unknown'),null);
 assert.equal(validFantasyTab(null),null);
});
test('Back to lobby and keyboard focus are reachable without a separate gamebar',()=>{
 const {document}=parseHTML('<html><body></body></html>');let back=0;
 const home=createFantasySportsView(document,{onBack:()=>back++});
 home.querySelector('.fs-back').click();assert.equal(back,1);
 const nested=createFantasySportsView(document,{tab:'my-teams',onBack:()=>back++});
 assert.equal(nested.querySelector('.fs-back').getAttribute('aria-label'),'Return to Fantasy Sports landing');
 assert.match(home.querySelector('nav').getAttribute('aria-label'),/Fantasy Sports sections/);
});
test('Existing 420Bet lobby launches a dedicated immersive fantasy route and preserves other games',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/fantasy-sports.css',import.meta.url),'utf8');
 const catalogue=readFileSync(new URL('../src/catalogue.js',import.meta.url),'utf8');
 assert(main.includes("active.id==='fantasy'"));
 assert(main.includes("createFantasySportsView(document"));
 assert(main.includes("active.id!=='fantasy'"));
 assert(main.includes("history.pushState(null,'',location.pathname+'#game=fantasy'"));
 assert(main.includes("window.addEventListener('popstate',restoreRoute)"));
 assert(main.includes('createPokerRoomLive(document'));
 assert(main.includes('createRoyalKushTable(document'));
 assert(catalogue.includes("['fantasy','Fantasy Sports','Fantasy'"));
 assert(css.includes('fantasy-hockey-lounge.avif'));
 assert(css.includes('.fs-menu'));
 assert(css.includes('@media(max-width:670px)'));
 assert(css.includes('prefers-reduced-motion'));
});

test('Approved native-resolution wallpaper asset is present and decodable as AVIF container',()=>{
 const image=readFileSync(new URL('../public/assets/420bet/fantasy/fantasy-hockey-lounge.avif',import.meta.url));
 assert(image.length>100000,'Must use full-resolution approved artwork, not a placeholder');
 assert.equal(image.subarray(4,12).toString('ascii'),'ftypavif');
 const css=readFileSync(new URL('../src/fantasy-sports.css',import.meta.url),'utf8');
 assert(css.includes("background-size:cover")||css.includes('/cover no-repeat'));
 assert(css.includes('.art-fantasy-lounge'));
});
