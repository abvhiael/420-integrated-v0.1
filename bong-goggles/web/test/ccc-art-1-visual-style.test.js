import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createChaosGame} from '../core/cross-country-chaos.js';
import {renderChaosGame} from '../core/classics-ui.js';
import {renderChaosHighway} from '../core/chaos-board.js';
import {CHAOS_ART_DIRECTION,chaosRegionArt} from '../core/chaos-visual-style.js';

const readStyles=()=>readFile(resolve(import.meta.dirname,'..','classics.css'),'utf8');

test('CCC-ART-1: visual identity and regional humour are immutable and geographically distinct',()=>{
 const theme=CHAOS_ART_DIRECTION;
 assert.equal(theme.name,'Cross-Country Chaos');
 assert.ok(Object.isFrozen(theme)&&Object.isFrozen(theme.typography)&&Object.isFrozen(theme.regions));
 assert.deepEqual(Object.keys(theme.regions).sort(),['east','ontario','west']);
 for(const key of Object.keys(theme.regions)){
  assert.strictEqual(chaosRegionArt(key),theme.regions[key]);
  assert.ok(Object.isFrozen(theme.regions[key]));
  for(const field of ['shield','sign','line','caption','marker']){
   assert.equal(typeof theme.regions[key][field],'string');
   assert.ok(theme.regions[key][field].length>3);
  }
 }
 assert.equal(new Set(Object.values(theme.regions).map(v=>v.line)).size,3);
 assert.equal(chaosRegionArt('__proto__'),null);
 assert.equal(chaosRegionArt('unknown'),null);
 assert.match(theme.voice,/road-trip mischief/);
 assert.match(theme.title,/Coast to coast/);
});
test('CCC-ART-1: full highway branding and region-specific humour render in every stage without changing game parameters',()=>{
 for(let leg=0;leg<3;leg++){
  const s=createChaosGame({names:['Driver One','Driver Two'],seed:1972});
  s.leg=leg;
  const region=['east','ontario','west'][leg],art=chaosRegionArt(region);
  const visible=renderChaosGame({game:s,revealed:true});
  const hidden=renderChaosGame({game:s,revealed:false});
  const map=renderChaosHighway(s);
  assert.ok(visible.includes('ccc-wrap--roadtrip ccc-region--'+region));
  assert.ok(hidden.includes('ccc-wrap--roadtrip ccc-region--'+region));
  assert.match(visible,/ccc-highway-shield/);
  assert.match(visible,/🍁/);
  assert.ok(visible.includes(art.line));
  assert.ok(visible.includes(art.caption));
  assert.ok(map.includes(art.sign));
  assert.match(map,/ccc-wayfinding-sign/);
  assert.match(map,/schematic, not to scale/);
  assert.match(visible,/2,500 km target/);
  assert.match(hidden,/Pass the device/);
  assert.doesNotMatch(hidden,/ccc-hand-card|data-chaos-move/);
  assert.equal(s.players.length,2);
  assert.equal(s.players[0].hand.length,7);
 }
 const welcome=renderChaosGame();
 assert.match(welcome,/ccc-hero--roadtrip/);
 assert.match(welcome,/ccc-highway-shield/);
 assert.match(welcome,/One questionable turn/);
 assert.match(welcome,/Start the cross-Canada championship/);
});
test('CCC-ART-1: branded interface uses scoped colour tokens, local type fallbacks and textured card-table styles',async()=>{
 const css=await readStyles();
 for(const [key,hex] of Object.entries({
  '--ccc-ink':'#10251f','--ccc-night':'#132d25','--ccc-felt':'#1d4734',
  '--ccc-cream':'#f6efd7','--ccc-gold':'#f6cd71','--ccc-enamel-red':'#e37557'
 }))assert.ok(css.includes(key+':'+hex+';'),'missing '+key);
 for(const region of ['east','ontario','west'])assert.ok(css.includes('.ccc-wrap--roadtrip.ccc-region--'+region));
 for(const selector of ['.ccc-hero--roadtrip','.ccc-highway-shield','.ccc-road-brandline',
  '.ccc-wayfinding-sign','.ccc-highway-canvas','.ccc-seat-mat--active',
  '.ccc-stock-back','.ccc-hand-card.ccc-hazard'])
  assert.ok(css.includes(selector),'missing styled '+selector);
 assert.match(css,/--ccc-display:[^;]+system-ui/);
 assert.match(css,/--ccc-sign:[^;]+Arial/);
 assert.match(css,/repeating-linear-gradient/);
 assert.match(css,/radial-gradient/);
 assert.match(css,/focus-visible/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media\(max-width:450px\)/);
 assert.doesNotMatch(css,/@import\s+url\(|font-face\s*\{/i,'brand must not depend on remote or bundled fonts');
 assert.ok(Buffer.byteLength(css,'utf8')<35000,'visual styling stays lightweight');
});
test('CCC-ART-1: road-sign text remains safe and public; hostile names are escaped in art layouts',()=>{
 const s=createChaosGame({names:['<img src=x onerror=x>','Driver B'],seed:70});
 const html=renderChaosGame({game:s,revealed:false});
 assert.doesNotMatch(html,/<img src=x onerror=x>/);
 assert.match(html,/&lt;img src=x onerror=x&gt;/);
 assert.match(html,/ccc-wayfinding-sign/);
 assert.match(html,/aria-label="Trans-Canada-inspired road trip"/);
 assert.doesNotMatch(html,/data-chaos-move/);
});
test('CCC-ART-1: highway-shield, caution-gold and cream-on-dark palette retain readable colour contrast',()=>{
 const rgb=hex=>hex.match(/[a-f0-9]{2}/gi).map(n=>parseInt(n,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const lum=hex=>rgb(hex).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((m,n)=>n-m);return (x+.05)/(y+.05);};
 assert.ok(contrast('f6efd7','132d25')>=7,'cream text on dark road green');
 assert.ok(contrast('10251f','f6cd71')>=7,'caution-gold button contrast');
 assert.ok(contrast('ffffff','21613f')>=6,'white road-sign lettering');
 assert.ok(contrast('fff9e5','122a24')>=7,'display text on dark hero');
});
