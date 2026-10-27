import test from 'node:test';
import assert from 'node:assert/strict';
import {createHighCountryCloudHttp420} from '../src/highcountry-cloud-http.js';
const game='0x'+'a'.repeat(64);
test('HC-NEXT-7.2 account-only HTTP rejects spoofing and invokes approved service without wallet',async()=>{
 const called=[];
 const exhibitions={
  enter:async input=>{called.push(input);return {eventId:input.eventId,accountId:'alice',status:'registered'};},
  status:async input=>({eventId:input.eventId,finalized:false}),
 };
 const authority={gameId:game,
  verifyToken:async token=>{if(token!=='valid')throw Error('invalid-token');return {sub:'alice',game};},
  registeredPrincipal:async token=>token==='valid'?'alice':null};
 const poolForPrincipal=async()=>({connect:async()=>{throw Error('not-expected');}});
 const provider={put:async()=>null,get:async()=>null,delete:async()=>null};
 const server=createHighCountryCloudHttp420({authority,poolForPrincipal,provider,
  origin:'https://game.example',ordinaryExhibitions:exhibitions});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 const post=(body,headers={})=>fetch(base+'/highcountry/exhibitions/enter',{method:'POST',
  headers:{origin:'https://game.example',authorization:'Bearer valid','content-type':'application/json',...headers},
  body:JSON.stringify(body)});
 try{
  let r=await post({eventId:'event',accountId:'victim'});
  assert.notEqual(r.status,200);assert.equal(called.length,0);
  r=await post({eventId:'event'},{origin:'https://evil.example'});
  assert.equal(r.status,403);assert.equal(called.length,0);
  r=await post({eventId:'event'},{authorization:'Bearer forged'});
  assert.notEqual(r.status,200);assert.equal(called.length,0);
  r=await post({eventId:'event'});
  assert.equal(r.status,200);assert.equal((await r.json()).accountId,'alice');
  assert.deepEqual(called,[{eventId:'event',token:'valid'}]);
 }finally{await new Promise(ok=>server.close(ok));}
});
