import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const load=path=>readFile(resolve(root,path),'utf8');
test('R06.7 official SVG brand, favicon and lifecycle artwork all exist',async()=>{
 for(const filename of ['highcountry-logo.svg','highcountry-icon.svg','highcountry-growing.svg','highcountry-ready.svg']){
  const path='public/assets/'+filename,src=await load(path);
  assert.match(src,/<svg\b/);assert.match(src,/viewBox=/);assert.match(src,/<\/svg>/);
  assert.ok((await stat(resolve(root,path))).size<30000);
  assert.doesNotMatch(src,/<script\b|onload\s*=|href\s*=\s*["']https?:/i);
 }
 const html=await load('public/index.html');assert.match(html,/highcountry-icon\.svg/);assert.match(html,/Skip to content/);
 const app=await load('src/app.js');
 assert.match(app,/highcountry-logo\.svg/);assert.match(app,/cultivationStageArt\(phase\)/);
 assert.match(app,/illustration\.fallback/);assert.match(app,/aria-current/);
 assert.match(app,/role','status/);
});
test('responsive, keyboard focus, forced-colors and reduced-motion support exist',async()=>{
 const css=await load('public/styles.css');
 for(const rule of [':focus-visible','prefers-reduced-motion','forced-colors','max-width:600px','min-height:44px','.game-panel','.controls'])assert.ok(css.includes(rule),rule);
 assert.doesNotMatch(css,/outline\s*:\s*(?:0|none)\b/i);
});
