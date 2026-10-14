import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGamingDeployment420,createGamingRpcTransport420,createGamingSessionTransport420,GamingTransportError420} from '../src/transports.js';
import {createGamingContractBindings420,GAMING_ABI_SELECTORS420} from '../src/abi-bindings.js';
import {keccak256} from '../../../services/highcountry-economy/src/keccak.js';
const H=x=>'0x'+x.repeat(64),A=x=>'0x'+x.repeat(40),game=H('b'),code='0x60016000';
const names=['games','identity','entitlements','crossGame','claims','bridge','migration'];
const contracts=Object.fromEntries(names.map((n,i)=>[n,{address:A(String(i+1)),codeHash:keccak256(Buffer.from(code.slice(2),'hex'))}]));
const manifest={chainId:'420',gameId:game,rpcUrl:'https://rpc.example',witnessUrl:'https://witness.example',apiUrl:'https://api.example',contracts};
const config=()=>validateGamingDeployment420({manifest,expectedChainId:'420',gameId:game});
test('R05.8 configured manifest rejects wrong network, collision, insecure provider and invalid ABI hash',()=>{
 assert.equal(config().chainId,'420');
 for(const patch of [
  {...manifest,chainId:'1'}, {...manifest,rpcUrl:'http://rpc.example'},
  {...manifest,witnessUrl:manifest.rpcUrl},
  {...manifest,contracts:{...contracts,claims:contracts.games}},
  {...manifest,contracts:{...contracts,claims:{...contracts.claims,codeHash:H('0')}}}
 ])assert.throws(()=>validateGamingDeployment420({manifest:patch,expectedChainId:'420',gameId:game}),
  e=>e instanceof GamingTransportError420);
});
test('R05.8 real JSON-RPC transport bounds retry on read-only transient errors',async()=>{
 const statuses=[503,503,200],seen=[],delay=[];
 const transport=createGamingRpcTransport420({deployment:config(),maxAttempts:3,
  fetchImpl:async(_url,x)=>{
   const body=JSON.parse(x.body);seen.push(body.method);
   const status=statuses.shift();
   return {ok:status===200,status,json:async()=>({jsonrpc:'2.0',id:body.id,result:'0x1a4'})};
  },backoff:async n=>delay.push(n)});
 assert.equal(await transport.assertNetwork(),'420');assert.equal(seen.length,3);
 assert.deepEqual(delay,[1,2]);
 await assert.rejects(()=>transport.request('eth_sendTransaction',[]),/gaming-rpc-method-denied/);
});
test('R05.8 malformed RPC response and external wallet wrong network fail explicitly',async()=>{
 const provider={request:async()=> '0x1'};
 const t=createGamingRpcTransport420({deployment:config(),provider,
  fetchImpl:async(_url,x)=>({ok:true,json:async()=>({jsonrpc:'2.0',id:JSON.parse(x.body).id,result:'0x1a4'})})});
 await assert.rejects(()=>t.assertNetwork(),/gaming-wallet-wrong-network/);
 const bad=createGamingRpcTransport420({deployment:config(),
  fetchImpl:async()=>({ok:true,json:async()=>({jsonrpc:'2.0',id:999,result:'0x1a4'})})});
 await assert.rejects(()=>bad.assertNetwork(),/gaming-rpc-malformed/);
});
test('R05.8 canonical SDK bindings use exact selector, bytecode hash and blockHash EIP-1898',async()=>{
 const calls=[],anchor=H('a');
 const deployment=config();
 const transport=createGamingRpcTransport420({deployment,fetchImpl:async(_url,opts)=>{
  const r=JSON.parse(opts.body);calls.push(r);
  const result=r.method==='eth_chainId'?'0x1a4':r.method==='eth_getCode'?code:'0x'+('0'.repeat(63)+'1');
  return {ok:true,json:async()=>({jsonrpc:'2.0',id:r.id,result})};
 }});
 const client=createGamingContractBindings420({transport});
 const result=await client.read({contract:'games',method:'isActive',args:[game],blockHash:anchor});
 assert.equal(result.data,'0x'+('0'.repeat(63)+'1'));
 assert.equal(calls[1].params[1].blockHash,anchor);
 assert.equal(calls[2].params[1].blockHash,anchor);
 assert.equal(calls[2].params[0].data,'0x'+keccak256(Buffer.from('isActive(bytes32)')).slice(2,10)+game.slice(2));
 await assert.rejects(()=>client.read({contract:'games',method:'arbitrary',args:[game],blockHash:anchor}),
  /gaming-abi-method-denied/);
 await assert.rejects(()=>client.read({contract:'games',method:'isActive',args:[game]}),
  /gaming-unpinned-read-denied/);
});
test('R05.8 scoped HTTP transport denies stale session and never retries private authorization',async()=>{
 let count=0;
 const t=createGamingSessionTransport420({deployment:config(),getToken:async()=> 'session',
  fetchImpl:async()=>{count++;return {status:403,ok:false}}});
 await assert.rejects(()=>t.events(),/gaming-session-revoked/);
 assert.equal(count,1);
 const ok=createGamingSessionTransport420({deployment:config(),getToken:async()=> 'signed',
  fetchImpl:async(url,opts)=>{
   assert.ok(url.startsWith('https://api.example/events?limit=2'));
   assert.equal(opts.headers.authorization,'Bearer signed');
   return {ok:true,status:200,json:async()=>({events:[{event_kind:'GameProfileCreated'}]})};
  }});
 assert.equal((await ok.events({limit:2})).length,1);
});
