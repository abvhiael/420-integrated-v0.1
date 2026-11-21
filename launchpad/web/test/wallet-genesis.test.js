import test from 'node:test';
import assert from 'node:assert/strict';
import {keccak256Hex} from '../../../wallet/web/core/keccak.js';
import {GENESIS_APP_SERVICES} from '../../../wallet/web/core/genesis-app-catalog.js';
import {verifyGenesisService420,assertGenesisNavigationSnapshot420} from '../../../wallet/web/core/genesis-wallet-integration420.js';

const CHAIN='0x1a4',ACCOUNT='0x'+'aa'.repeat(20);
const REGISTRY='0x0000000000000000000000000000000000000434';
const ROUTER='0x'+'22'.repeat(20);
const registryCode='0x6001600055',routerCode='0x6002600055',metadataHash='0x'+'33'.repeat(32);
const digest=hex=>keccak256Hex(Uint8Array.from(hex.slice(2).match(/../g),x=>parseInt(x,16)));
const word=x=>BigInt(x).toString(16).padStart(64,'0');
const meta=GENESIS_APP_SERVICES.find(x=>x.id==='launchpad');
const registry={chainId:CHAIN,address:REGISTRY,codeHash:digest(registryCode)};
const entry={id:meta.id,name:meta.name,serviceId:meta.serviceId,approved:true,
  chainId:CHAIN,url:'https://launchpad.example.org/',origin:'https://launchpad.example.org',
  version:1,implementation:ROUTER,codeHash:digest(routerCode),metadataHash};
function provider({chain=CHAIN,code=routerCode,active=true,implementation=ROUTER}={}){
  const calls=[];
  return {calls,request:async(method,args=[])=>{
    calls.push({method,args});
    if(method==='eth_chainId')return chain;
    if(method==='eth_getCode')return args[0]===REGISTRY?registryCode:args[0]===ROUTER?code:'0x';
    if(method==='eth_call'){
      if(args[0].to!==REGISTRY)throw Error('wrong Registry');
      const selector='0x'+keccak256Hex(new TextEncoder().encode('getService(bytes32)')).slice(2,10);
      const serviceHash=keccak256Hex(new TextEncoder().encode('420/service/launchpad/v1'));
      if(args[0].data.toLowerCase()!==(selector+serviceHash.slice(2)).toLowerCase())throw Error('untrusted service lookup');
      return '0x'+implementation.slice(2).padStart(64,'0')+entry.codeHash.slice(2)+metadataHash.slice(2)+word(1)+word(42)+word(active?1:0);
    }
    throw Error('unsupported RPC method');
  }};
}
test('420Wallet resolves Launchpad as a Registry-published, codehash verified navigation-only service',async()=>{
  assert.equal(meta.serviceId,'420/service/launchpad/v1');
  const rpc=provider(),verified=await verifyGenesisService420(rpc,{registry,entry,chainId:CHAIN});
  assert.equal(verified.verified,true);
  assert.equal(verified.permission,'NAVIGATION_ONLY');
  assert.equal(verified.accountGrant,false);
  assert.equal(verified.spendingAuthority,false);
  const navigation=assertGenesisNavigationSnapshot420(verified,verified,{account:ACCOUNT,chainId:CHAIN});
  assert.equal(navigation.serviceId,'420/service/launchpad/v1');
  assert.equal(navigation.accountGrant,false);
  assert.equal(navigation.spendingAuthority,false);
  assert.ok(rpc.calls.some(x=>x.method==='eth_call'&&x.args[0].to===REGISTRY));
});
test('420Wallet blocks revoked, counterfeited and cross-network Launchpad handoff',async()=>{
  for(const malicious of [
    {active:false},{implementation:'0x'+'44'.repeat(20)},{code:'0x6003'},{chain:'0x1'}
  ])await assert.rejects(()=>verifyGenesisService420(provider(malicious),{registry,entry,chainId:CHAIN}));
  const verified=await verifyGenesisService420(provider(),{registry,entry,chainId:CHAIN});
  assert.throws(()=>assertGenesisNavigationSnapshot420(verified,{...verified,url:'https://phish.example.org/'},
    {account:ACCOUNT,chainId:CHAIN}),/changed/);
  assert.throws(()=>assertGenesisNavigationSnapshot420(verified,verified,
    {account:ACCOUNT,chainId:'0x1'}),/chain/);
});
