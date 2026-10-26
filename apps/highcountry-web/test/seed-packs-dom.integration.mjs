import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createSeedPackClient,mountSeedPacks} from '../src/seed-packs.js';
const tick=()=>new Promise(r=>setTimeout(r,20));
test('starter UI issues one regional request, refreshes authoritative inventory and locks the choice',async()=>{
 const dom=new JSDOM('<main></main>'),document=dom.window.document,requests=[];let claimed=false,prepared=false;
 const view=mountSeedPacks({document,parent:document.querySelector('main'),runtime:{mode:'connected',apiUrl:'https://api.example'},authenticate:async()=> 'signed-token',fetchImpl:async(url,options)=>{
  const path=new URL(url).pathname,body=JSON.parse(options.body);requests.push({path,body,options});
  if(path.endsWith('/starter'))claimed=true;if(path.endsWith('/prepare'))prepared=true;
  return {ok:true,json:async()=>({ok:true,result:path.endsWith('/inventory')?{starterClaimed:claimed,packs:claimed?[{id:'starter:1',region:'Golden Prairie',starterCultivarId:'HC-C-blueberry',seeds:3,status:prepared?'issuance-prepared':'sealed'}]:[],lots:[]}:{accepted:true}})};
 }});
 const region=document.querySelector('[aria-label="Starter region"]');region.value='Golden Prairie';
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
 button('Claim starter packs').click();button('Claim starter packs').click();await tick();
 assert.equal(requests.filter(r=>r.path.endsWith('/starter')).length,1);assert.deepEqual(requests[0].body,{region:'Golden Prairie'});assert.equal(region.disabled,true);assert.equal(button('Claim starter packs').disabled,true);
 button('Prepare starter seeds').click();await tick();assert.deepEqual(requests.find(r=>r.path.endsWith('/prepare')).body,{packId:'starter:1'});assert.match(view.section.textContent,/Preparing seeds/);
 assert.ok(requests.every(r=>r.options.headers.authorization==='Bearer signed-token'));dom.window.close();
});
test('offline and unavailable inventory do not fabricate packs or grants',async()=>{
 const dom=new JSDOM('<main></main>'),document=dom.window.document;let calls=0;
 mountSeedPacks({document,parent:document.querySelector('main'),runtime:{mode:'offline'},fetchImpl:()=>calls++});assert.equal(calls,0);assert.equal(document.querySelectorAll('button').length,0);
 dom.window.close();const c=createSeedPackClient({apiUrl:'https://api.example',authenticate:async()=>null,fetchImpl:()=>calls++});await assert.rejects(c.starter('Red Mesa'),/sign-in/);assert.equal(calls,0);
});
test('standard opening UI has no preview or reroll and submits only immutable pack IDs',async()=>{
 const dom=new JSDOM('<main></main>'),document=dom.window.document,requests=[];let state='sealed';
 const view=mountSeedPacks({document,parent:document.querySelector('main'),runtime:{mode:'connected',apiUrl:'https://api.example'},authenticate:async()=> 'signed-token',fetchImpl:async(url,options)=>{
  const path=new URL(url).pathname,body=JSON.parse(options.body);requests.push({path,body});if(path.endsWith('/open'))state='opening-committed';if(path.endsWith('/opening'))state='outcome-ready';if(path.endsWith('/prepare'))state='issuance-prepared';
  return {ok:true,json:async()=>({ok:true,result:path.endsWith('/inventory')?{starterClaimed:true,packs:[{id:'pack:standard',region:'World',starterCultivarId:null,seeds:3,status:state,...(state==='outcome-ready'?{outcome:{cultivarName:'Blue Moon',tier:'rare'}}:{})}],lots:[]}:{accepted:true}})};
 }});
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);await view.refresh();assert.ok(button('Commit pack opening'));assert.doesNotMatch(view.section.textContent,/Blue Moon/);
 button('Commit pack opening').click();button('Commit pack opening').click();await tick();assert.equal(requests.filter(r=>r.path.endsWith('/open')).length,1);assert.equal(button('Commit pack opening'),undefined);assert.ok(button('Check verified opening'));assert.doesNotMatch(view.section.textContent,/Blue Moon/);
 button('Check verified opening').click();await tick();assert.match(view.section.textContent,/Blue Moon/);button('Prepare selected seeds').click();await tick();
 for(const request of requests.filter(r=>!r.path.endsWith('/inventory')))assert.deepEqual(request.body,{packId:'pack:standard'});assert.ok(![...document.querySelectorAll('button')].some(b=>/reroll|preview|cancel opening/i.test(b.textContent)));dom.window.close();
});
