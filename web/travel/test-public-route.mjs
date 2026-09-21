import assert from 'node:assert/strict';
import { publicTravelRead } from '../../functions/_travel-public.js';
const request = (path,method='GET',env={TRAVEL_PUBLIC_ORIGIN:'https://travel-origin.example/'}) => ({request:new Request('https://420travel.420integrated.org'+path,{method,headers:{Cookie:'session=secret',Authorization:'Bearer secret'}}),env});
const read = async response => ({status:response.status, body:await response.json(), headers:response.headers});
const upstream = globalThis.fetch;
let calls=[];
globalThis.fetch = async (url, options) => {calls.push({url,options});return new Response(JSON.stringify({state:'ready',places:[{id:'p1',name:'Town',category:'area',city:'Regina',region:'SK',country:'CA',approximate:true,owner_secret:'no'}]}),{status:200,headers:{'Content-Type':'application/json','Set-Cookie':'leak=yes'}});};
try {
  let result=await read(await publicTravelRead(request('/travel/api/v1/places?destination=Regina'),'/travel/api/v1/places'));
  assert.equal(result.status,200);assert.deepEqual(result.body.places,[{id:'p1',name:'Town',category:'area',city:'Regina',region:'SK',country:'CA',approximate:true}]);
  assert.equal(result.headers.get('Set-Cookie'),null);assert.equal(result.headers.get('Cache-Control'),'no-store');
  assert.equal(calls[0].url,'https://travel-origin.example/travel/api/v1/places?destination=Regina');assert.deepEqual(Object.keys(calls[0].options.headers),['Accept']);assert.equal(calls[0].options.redirect,'manual');
  for(const context of [request('/travel/api/v1/places','POST'),request('/travel/api/v1/places?url=https://evil.example'),request('/travel/api/v1/places','GET',{}),request('/travel/api/v1/places','GET',{TRAVEL_PUBLIC_ORIGIN:'http://localhost:8088/'})]){
    const r=await publicTravelRead(context,'/travel/api/v1/places');assert.ok(r.status>=400);
  }
  assert.equal((await publicTravelRead(request('/travel/api/v1/private'),'/travel/api/v1/places')).status,404);
  globalThis.fetch=async()=>new Response('redirect',{status:302,headers:{Location:'https://elsewhere.example/'}});
  assert.equal((await publicTravelRead(request('/travel/api/v1/places'),'/travel/api/v1/places')).status,502);
  globalThis.fetch=async()=>new Response(JSON.stringify({state:'ready',places:[{id:'p1',name:'Town',category:'area',city:'Regina',region:'SK',country:'CA',approximate:true},{id:'private',name:'Oops'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  assert.equal((await publicTravelRead(request('/travel/api/v1/places'),'/travel/api/v1/places')).status,502);
  globalThis.fetch=async()=>new Response(JSON.stringify({state:'empty'}),{status:200,headers:{'Content-Type':'application/json'}});
  result=await read(await publicTravelRead(request('/travel/api/v1/events'),'/travel/api/v1/events'));
  assert.equal(result.status,200);assert.deepEqual(result.body,{state:'empty',events:[]});
  globalThis.fetch=async()=>{throw Error('upstream unavailable');};
  assert.equal((await publicTravelRead(request('/travel/api/v1/events'),'/travel/api/v1/events')).status,503);
  console.log('PASS: exact route, GET only, HTTPS origin, no credentials, no redirects, allowlisted JSON, outage and empty states');
} finally {globalThis.fetch=upstream;}
