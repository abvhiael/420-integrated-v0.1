import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker,{handle420BetWorker} from '../worker/index.js';
const BASE='https://420bet.420integrated.org';
const req=(path,init)=>new Request(BASE+path,init);
const json=async response=>response.json();
const success=(name,called)=>async ({request,env})=>{
 called.push({name,path:new URL(request.url).pathname,env});
 return new Response(JSON.stringify({source:name}),{
  headers:{'content-type':'application/json'}});
};
test('Wrangler config adds a Worker entrypoint while preserving the production name, assets, secret, and domain routing',()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(config.name,'420bet');
 assert.equal(config.main,'./worker/index.js');
 assert.equal(config.assets.directory,'./dist');
 assert.equal(config.assets.binding,'ASSETS');
 assert.equal(config.assets.not_found_handling,'single-page-application');
 assert.deepEqual(config.assets.run_worker_first,['/api/420bet/sportsbook/*']);
 assert.equal(config.keep_vars,true);
 assert.equal(config.durable_objects.bindings[0].name,'SPORTSBOOK_ODDS_BUDGET');
 assert.deepEqual(config.migrations[0].new_sqlite_classes,['SportsbookOddsBudget']);
 assert(!Object.hasOwn(config,'routes'));
 assert(!Object.hasOwn(config,'vars'));
 assert(!Object.hasOwn(config,'secrets'));
 assert(!JSON.stringify(config).includes('THE_ODDS_API_KEY'));
});
test('Only published sportsbook API endpoints invoke backend instead of Vite SPA',async()=>{
 const called=[],secret='local_test_key_never_displayed';
 const env={THE_ODDS_API_KEY:secret,ASSETS:{fetch:async request=>{
  called.push({name:'asset',path:new URL(request.url).pathname});
  return new Response('asset', {status:200});
 }}};
 const options={marqueeHandler:success('marquee',called),linesHandler:success('lines',called)};
 let res=await handle420BetWorker(req('/api/420bet/sportsbook/marquee'),env,null,options);
 assert.equal(res.status,200);assert.equal((await json(res)).source,'marquee');
 res=await handle420BetWorker(req('/api/420bet/sportsbook/lines'),env,null,options);
 assert.equal(res.status,200);assert.equal((await json(res)).source,'lines');
 assert.deepEqual(called.map(x=>x.name),['marquee','lines']);
 assert(called[0].env.THE_ODDS_API_KEY===secret);
});
test('All existing casino files, navigation, hash routes and fallback assets retain their original route',async()=>{
 const assetPaths=['/','/index.html','/assets/420bet/brand/420bet-logo.png',
  '/assets/420bet/sportsbook/sportsbook-wallpaper.png',
  '/assets/index-abc123.js','/games/roulette','/api/420bet/player-history',
  '/api/420bet/poker/v1/session'];
 let calls=[];
 const env={ASSETS:{fetch:async request=>{
  calls.push(new URL(request.url).pathname);return new Response('original static asset');
 }}};
 for(const path of assetPaths){
  const result=await worker.fetch(req(path),env);
  assert.equal(result.status,200);assert.equal(await result.text(),'original static asset');
 }
 assert.deepEqual(calls,assetPaths);
});
test('Unknown sportsbook routes fail closed to JSON instead of displaying the homepage HTML',async()=>{
 let assetsCalled=false;
 const env={ASSETS:{fetch:async()=>{assetsCalled=true;return new Response('html');}}};
 const result=await worker.fetch(req('/api/420bet/sportsbook/unknown'),env);
 assert.equal(result.status,404);assert.equal(result.headers.get('content-type'),'application/json; charset=utf-8');
 assert.equal((await json(result)).error,'unknown_sportsbook_endpoint');
 assert.equal(assetsCalled,false);
});
test('Missing static binding returns controlled error, never makes an external redirect',async()=>{
 const result=await worker.fetch(req('/index.html'),{});
 assert.equal(result.status,503);
 assert.equal((await json(result)).error,'static_assets_unavailable');
});
test('Actual Worker marquee route fails closed if Cloudflare production secret is missing',async()=>{
 const r=await worker.fetch(req('/api/420bet/sportsbook/marquee'),{ASSETS:{fetch:async()=>new Response('html')}});
 assert.equal(r.status,503);
 assert.equal((await json(r)).error,'sports_feed_not_configured');
});
test('Actual Worker lines route requires explicitly configured KV cache',async()=>{
 const r=await worker.fetch(req('/api/420bet/sportsbook/lines'),{THE_ODDS_API_KEY:'SECRET'});
 assert.equal(r.status,503);
 assert.equal((await json(r)).error,'odds_budget_not_configured');
});

test('Production Worker exposes singleton odds Durable Object and routes requests without exposing secret',async()=>{
 const {SportsbookOddsBudget}=await import('../worker/index.js');
 assert.equal(typeof SportsbookOddsBudget,'function');
 let calls=0;
 const ctx={ASSETS:{fetch:async()=>new Response('html')},SPORTSBOOK_ODDS_BUDGET:{
  getByName(name){
   assert.equal(name,'420bet-free-odds-v1');
   return{fetch:async request=>{
    calls++;
    assert.equal(new URL(request.url).pathname,'/internal/read-lines');
    assert(!request.url.includes('THE_ODDS_API_KEY'));
    return new Response(JSON.stringify({source:'test'}),{headers:{'Content-Type':'application/json'}});
   }};
  }
 }};
 const r=await worker.fetch(req('/api/420bet/sportsbook/lines'),ctx);
 assert.equal(r.status,200);assert.equal((await r.json()).source,'test');assert.equal(calls,1);
});
