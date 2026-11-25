import test from 'node:test';import assert from 'node:assert/strict';import {renderApplicationShell} from '../core/app-shell.js';
import {DASHBOARD_ASSETS,selectGreeting} from '../core/dashboard-art.js';
import {welcomeHero,appIcon,ecosystemRail} from '../core/dashboard-ui.js';
test('dashboard preserves approved logo, real destinations and truthful empty states',()=>{const out=renderApplicationShell();for(const part of ['dashboard-welcome','data-greeting','Your Communities','Upcoming Events','Discover People','https://420exchange.420integrated.org/','https://420pay.420integrated.org/','https://town.420integrated.org/','More dApps','href="/groups"','href="/events"','href="/discover"','href="/games"','Canonical feed unavailable'])assert.ok(out.includes(part),part);assert.ok(!out.includes('42.7K members'));});
test('game catalogue is public without claiming a playable board or bypassing wallet sessions',()=>{const out=renderApplicationShell({pathname:'/games'});for(const part of ['Main Classics','Canadian Classics','Labyrinth Cribbage','Chess','Checkers','Backgammon','Dominoes','Word Salad','Planned — not yet playable','Registry only — not yet playable','420Wallet required for blockchain sessions only','href="/games/cribbage"'])assert.ok(out.includes(part),part);assert.ok(!out.includes('data-action="game-invite"'));});
test('guest dashboard does not show another account profile name',()=>{const out=renderApplicationShell({profileProjection:{account:'0x'+'1'.repeat(40),displayName:'Injected member'}});assert.ok(!out.includes('Injected member'));});

test('greetings select the visitor local time and retain meaningful alternative text',()=>{
 const at=h=>new Date(2026,0,1,h);
 for(const [hour,file] of [[0,'after-hours'],[4,'after-hours'],[5,'good-morning'],[10,'good-morning'],[11,'grow-together'],[16,'grow-together'],[17,'welcome'],[20,'welcome'],[21,'after-hours'],[23,'after-hours']]){
  assert.equal(selectGreeting(at(hour)).file,file+'.webp');
  assert.ok(welcomeHero(at(hour)).includes('/assets/greetings/'+file+'.webp'));
  assert.match(welcomeHero(at(hour)),/alt="[^"]+"/);
 }
 assert.equal(selectGreeting(new Date(NaN)).file,'welcome.webp');
});
test('approved artwork inventory is exact and icons never invent a destination',()=>{
 assert.equal(DASHBOARD_ASSETS.length,14);assert.equal(new Set(DASHBOARD_ASSETS).size,14);
 assert.match(appIcon('420Pay'),/420pay.webp/);assert.match(appIcon('Unknown'),/more-dapps.webp/);
 const rail=ecosystemRail();assert.ok(rail.includes('href="https://grow.420integrated.org/"'));assert.ok(rail.includes('href="https://420mail.420integrated.org/"'));assert.ok(!rail.includes('href="https://420grow.420integrated.org/"'));assert.ok(!rail.includes('href="https://20mail.420integrated.org/"'));assert.match(rail,/420arcade.webp/);assert.match(rail,/Launch URL pending/);assert.doesNotMatch(rail,/href="https:\/\/420arcade/);
});
