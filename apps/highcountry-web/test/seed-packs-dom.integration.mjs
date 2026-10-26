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
