import test from 'node:test';
import assert from 'node:assert/strict';
import {TownWebService} from '../core/service.js';
const config={services:{townApiBaseUrl:'https://town.example',searchApiBaseUrl:'https://search.example'}};
test('service discovery is pinned to public_town Search domain',async()=>{const old=globalThis.fetch;let url;globalThis.fetch=async u=>{url=String(u);return new Response(JSON.stringify({results:[]}),{status:200,headers:{'Content-Type':'application/json'}})};try{await new TownWebService(config).discoverCommunities('grow');assert.match(url,/domain%3Apublic_town/);}finally{globalThis.fetch=old;}});
test('mutations carry authentication and idempotency headers',async()=>{const old=globalThis.fetch;let init;globalThis.fetch=async(_,i)=>{init=i;return new Response(JSON.stringify({ID:'post:1'}),{status:201,headers:{'Content-Type':'application/json'}})};try{await new TownWebService(config,{token:'access-session'}).createPost('c',{ID:'post:1'},'idem-1');assert.equal(init.headers.Authorization,'Bearer access-session');assert.equal(init.headers['Idempotency-Key'],'idem-1');}finally{globalThis.fetch=old;}});
