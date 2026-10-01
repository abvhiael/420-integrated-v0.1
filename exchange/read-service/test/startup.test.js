import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startExchangeReadService,loadExchangeReadConfig} from '../src/startup.mjs';

function response(body,status=200){return {ok:status>=200&&status<300,status,headers:{get:n=>n==='content-type'?'application/json':null},json:async()=>body};}

test('service starts locally from config with RPC/indexer/storage/catalogue composition and shuts down gracefully',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'exchange-pre10-'));
 const cat=path.join(dir,'catalogue.json'),configFile=path.join(dir,'config.json'),store=path.join(dir,'state','read.json');
 fs.writeFileSync(cat,JSON.stringify({schema:'420-exchange-catalogue-v1',version:1,markets:[{
   marketSubjectId:'m1',canonicalMarketId:null,marketLabel:'420 / LOCAL',baseSymbol:'420',quoteSymbol:'LOCAL',
   qualification:'DISPLAY_ONLY_UNQUALIFIED',routeHealthy:false,settlementHealthy:false,source:'local-test'
 }],assets:[{assetId:'420',symbol:'420',qualification:'DISPLAY_ONLY_UNQUALIFIED',source:'local-test'}],routes:[{routeId:'r1',marketSubjectId:'m1',qualification:'DISPLAY_ONLY_UNQUALIFIED',source:'local-test'}]}));
 fs.writeFileSync(configFile,JSON.stringify({schema:'420-exchange-read-service-config-v1',host:'127.0.0.1',port:0,chainId:'1056',indexerBaseUrl:'http://indexer.local',rpcUrl:'http://rpc.local',cataloguePath:'catalogue.json',storagePath:'state/read.json',refreshOnStart:true,shutdownTimeoutMs:1000}));
 const fake=async(url,options={})=>{
   if(url==='http://rpc.local')return response({jsonrpc:'2.0',id:1,result:'0x420'});
   const u=new URL(String(url));
   if(u.pathname==='/v1/status')return response({apiVersion:'v1',data:{chainId:'1056',indexedHead:'2',indexedHeadHash:'0x'+'11'.repeat(32),indexedHeadTimestamp:'1000',finality:{mode:'head',confirmations:null,safeHead:'2'},lag:'0',authoritative:false}});
   if(u.pathname==='/ready')return response({apiVersion:'v1',data:{ready:true,databaseReady:true,chainId:'1056',indexedHead:'2'}});
   if(u.pathname==='/v1/protocols/events')return response({apiVersion:'v1',data:{items:[],nextCursor:''}});
   throw new Error('unexpected '+url);
 };
 const config=loadExchangeReadConfig(configFile);const runtime=await startExchangeReadService(config,{fetchImpl:fake,registerSignals:false});
 assert.ok(runtime.address.port>0);assert.equal(fs.existsSync(store),true);
 const ready=await fetch('http://127.0.0.1:'+runtime.address.port+'/ready');assert.equal(ready.status,200);assert.equal((await ready.json()).ready,true);
 await runtime.close();
 assert.equal(runtime.server.listening,false);
});
