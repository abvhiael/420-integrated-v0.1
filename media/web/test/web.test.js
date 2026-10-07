import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRuntimeConfig,runtimeReadiness,featureEnabled,SERVICE_ID} from '../core/config.js';
import {MediaService,safeMediaURL} from '../core/service.js';
import {connectWallet,walletNetworkValid,installWalletInvalidation} from '../core/wallet.js';
import {idempotencyKey,rememberRetry,retryState,clearRetry,resetRetries} from '../core/state.js';

function configFixture(){
  return {
    schema:'420-media-web-runtime-v1',
    site:{name:'420Media',productionOrigin:null},
    network:{name:'420 Integrated',chainId:null,network:null,explorerUrl:null},
    registry:{serviceId:SERVICE_ID},
    api:{baseUrl:null},
    features:{upload:true,library:true,playback:true,livestreaming:true},
    execution:{status:'DISABLED_UNTIL_CANONICAL_RUNTIME_RESOLVED',requireWalletChainMatch:true,requireCapabilityDiscovery:true,requireHTTPS:true}
  };
}

test('runtime config remains fail-closed without inventing deployment',()=>{
  const config=validateRuntimeConfig(configFixture());
  const readiness=runtimeReadiness(config);
  assert.equal(readiness.ready,false);
  assert.deepEqual(readiness.missing,['apiBaseUrl','chainId','network','capabilities']);
  assert.throws(()=>validateRuntimeConfig({...config,site:{...config.site,productionOrigin:'https://media.420integrated.org'}}),/production origin/);
  assert.throws(()=>validateRuntimeConfig({...config,registry:{serviceId:'wrong'}}),/service id/);
});

test('runtime readiness validates wallet chain and feature discovery',()=>{
  const config=configFixture();config.api.baseUrl='https://media.example.invalid';
  const compatibility={chain_id:420,network:'testnet'};
  const capabilities={service_id:SERVICE_ID,features:{'media.livestreaming':false}};
  assert.equal(runtimeReadiness(config,{compatibility,capabilities}).ready,true);
  const wrong=runtimeReadiness(config,{compatibility,capabilities,wallet:{account:'0x1111111111111111111111111111111111111111',chainId:'0x1a5'}});
  assert.equal(wrong.ready,false);
  assert.ok(wrong.missing.includes('walletChainMismatch'));
  assert.equal(featureEnabled(config,capabilities,'livestreaming'),false);
});

test('wallet connection and invalidation enforce expected network',async()=>{
  const handlers={};
  const ethereum={
    async request({method}){if(method==='eth_requestAccounts')return ['0x1111111111111111111111111111111111111111'];if(method==='eth_chainId')return '0x1a4';throw Error('bad method');},
    on(name,fn){handlers[name]=fn;},
    removeListener(name,fn){if(handlers[name]===fn)delete handlers[name];}
  };
  const wallet=await connectWallet(ethereum,420);
  assert.equal(wallet.account,'0x1111111111111111111111111111111111111111');
  assert.equal(walletNetworkValid(wallet,420),true);
  await assert.rejects(()=>connectWallet(ethereum,421),/WRONG_NETWORK/);
  let reason='';
  const dispose=installWalletInvalidation(ethereum,value=>{reason=value;});
  handlers.chainChanged('0x1a5');
  assert.equal(reason,'chainChanged');
  dispose();
});

test('service validates API envelope, idempotency header and safe transport URL',async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options});
    const body=url.includes('/v1/assets?')
      ? {version:'v1',data:{items:[],next_cursor:''},rate_limit:{limit:120,remaining:119,reset_at:'2026-10-06T20:00:00Z'}}
      : {version:'v1',data:{asset:{id:'asset-1'},upload_id:'upload-1',provider_id:'p',node_id:'n',service_id:'s',endpoint:'https://storage.example.invalid/upload'},rate_limit:{limit:120,remaining:119,reset_at:'2026-10-06T20:00:00Z'}};
    return {ok:true,status:200,async text(){return JSON.stringify(body);}};
  };
  const service=new MediaService({baseUrl:'https://media.example.invalid',fetchImpl});
  const page=await service.assets({limit:24});
  assert.deepEqual(page.items,[]);
  await service.prepareUpload({id:'asset-1'},'idem-1');
  assert.equal(calls[1].options.headers['idempotency-key'],'idem-1');
  assert.throws(()=>new MediaService({baseUrl:'http://example.com',fetchImpl}),/HTTPS/);
  assert.equal(safeMediaURL('javascript:alert(1)','https://media.example.invalid'),null);
  assert.equal(safeMediaURL('https://cdn.example.invalid/video.mp4','https://media.example.invalid'),'https://cdn.example.invalid/video.mp4');
});

test('upload transport rejects unsafe endpoint and accepts HTTPS',async()=>{
  let method='';
  const service=new MediaService({
    baseUrl:'https://media.example.invalid',
    fetchImpl:async(_url,options)=>{method=options.method;return {ok:true,status:200,async text(){return '{}';}};}
  });
  await assert.rejects(()=>service.uploadBytes('http://example.com/upload',new Blob(['video'],{type:'video/mp4'})),/unsafe upload endpoint/);
  await service.uploadBytes('https://storage.example.invalid/upload',new Blob(['video'],{type:'video/mp4'}));
  assert.equal(method,'PUT');
});

test('retry state is memory-only and keeps exact idempotency key',()=>{
  resetRetries();
  const key=idempotencyKey('upload');
  rememberRetry('upload',key,{id:'asset-1'});
  assert.equal(retryState('upload').key,key);
  assert.equal(retryState('upload').payload.id,'asset-1');
  clearRetry('upload');
  assert.equal(retryState('upload'),null);
});
