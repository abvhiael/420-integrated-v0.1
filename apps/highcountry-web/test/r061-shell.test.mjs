import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateHighCountryRuntime,detectHighCountryNetwork} from '../src/runtime.js';
import {resolveRoute} from '../src/app.js';
import {createHighCountryServer} from '../server.mjs';
const h='0x'+'a'.repeat(64),addr='0x'+'1'.repeat(40);
const online={schema:'highcountry-web-runtime-v1',mode:'connected',chainId:420,gameId:h,rpcUrl:'https://rpc.example',apiUrl:'https://api.example',
 contracts:{gameRegistry:addr,gameIdentity:addr,gameEntitlements:addr,gameClaims:addr}};
test('offline mode explicit, no phantom chain or contract',()=>{
 assert.equal(validateHighCountryRuntime({schema:'highcountry-web-runtime-v1',mode:'offline'}).networkStatus,'not-configured');
 assert.throws(()=>validateHighCountryRuntime({schema:'highcountry-web-runtime-v1',mode:'offline',rpcUrl:'https://rpc.example'}));
 assert.throws(()=>validateHighCountryRuntime({schema:'highcountry-web-runtime-v1',mode:'connected'}));
});
test('connected mode rejects malformed and unsafe configuration',()=>{
 assert.equal(validateHighCountryRuntime(online).networkStatus,'configured-not-verified');
 for(const bad of [
 {...online,chainId:null},{...online,rpcUrl:'http://rpc.example'},
 {...online,apiUrl:'https://username:pass@api.example'},
 {...online,contracts:{...online.contracts,gameClaims:'0x'+'0'.repeat(40)}},
 {...online,gameId:'0x'+'0'.repeat(64)}
 ])assert.throws(()=>validateHighCountryRuntime(bad));
});
test('network detection checks actual rpc, returns mismatch and unavailable explicitly',async()=>{
 const c=validateHighCountryRuntime(online);
 const make=x=>async()=>({ok:true,json:async()=>({jsonrpc:'2.0',id:1,result:x})});
 assert.equal((await detectHighCountryNetwork(c,{fetchImpl:make('0x1a4')})).status,'connected');
 assert.equal((await detectHighCountryNetwork(c,{fetchImpl:make('0x1')})).status,'wrong-network');
 assert.equal((await detectHighCountryNetwork(c,{fetchImpl:async()=>{throw Error('offline');}})).status,'unavailable');
});
test('real routes do not silently invent pages',()=>{
 for(const path of ['/','/play','/account','/settings','/about'])assert.equal(resolveRoute(path),path);
 assert.equal(resolveRoute('/admin'),'/not-found');
});
test('HTTP serves genuine app entrypoint, routes and private runtime, denies traversal and writes',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'r061-'));
 await writeFile(join(directory,'index.html'),'<!doctype html><title>High Country</title>');
 const server=createHighCountryServer({config:{schema:'highcountry-web-runtime-v1',mode:'offline'},distRoot:directory});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const index=await fetch(base+'/play');assert.equal(index.status,200);assert.match(await index.text(),/High Country/);
  const config=await fetch(base+'/runtime-config.json');assert.equal((await config.json()).mode,'offline');
  assert.equal((await fetch(base+'/no-such-route')).status,404);
  assert.equal((await fetch(base+'/play',{method:'POST'})).status,405);
  assert.equal((await fetch(base+'/..%2F..%2Fetc%2Fpasswd')).status,403);
 }finally{await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
});
