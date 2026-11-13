import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chainId420,endpoint420,normalizeNetwork420,normalizeRegistry420,networkFromLegacy420,
  probeEndpoint420,probeNetwork420,watchAsset420,DEFAULT_NETWORKS_420} from '../../extension/core/network-registry.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../extension');
const read=x=>readFileSync(resolve(root,x),'utf8');
const RPC='https://rpc.example.org/v1',OTHER='https://backup.example.org/';
const base={chainId:'0x1a4',chainName:'420 Integrated Test',rpcUrls:[RPC,OTHER],
  nativeCurrency:{name:'420 Token',symbol:'420',decimals:18},
  blockExplorerUrls:['https://explorer.example.org/'],enabled:true};
function fakeRpc(override){
 return async (url,options)=>{
   const request=JSON.parse(options.body);
   assert.equal(request.method,'eth_chainId');
   return {ok:true,json:async()=>({jsonrpc:'2.0',id:request.id,result:override?.[url]||'0x1a4'})};
 };
}
test('M3: trusted seed identities and configurable 420 network never invent deployed authority',()=>{
 const initial=normalizeRegistry420();
 assert.equal(initial.networks['0x1'].chainName,'Ethereum Mainnet');
 assert.equal(initial.networks['0xaa36a7'].nativeCurrency.symbol,'ETH');
 assert.equal(initial.selectedChainId,null);
 assert.ok(DEFAULT_NETWORKS_420.every(x=>!x.enabled&&!x.smartAccountApproved));
 const prior=networkFromLegacy420({chainId:'0x1a4',rpcUrl:RPC,networkName:'420 Integrated',trackedAssets:[]});
 assert.equal(prior.chainId,'0x1a4');
 assert.equal(prior.smartAccountApproved,false);
});
test('M3: chain identity, endpoint policy, multiple RPCs and per-network currency',()=>{
 assert.equal(chainId420('0x01A4'),'0x1a4');
 for(const id of ['420','0x0','-1','0x123z'])assert.throws(()=>chainId420(id),/chain ID/);
 for(const url of ['http://evil.example/','file:///etc/passwd','https://u:pass@rpc.example.org','https://rpc.example.org/#secret'])
   assert.throws(()=>endpoint420(url),/credentials|HTTPS/);
 assert.equal(endpoint420('http://127.0.0.1:8545/',{local:true}),'http://127.0.0.1:8545/');
 const normalized=normalizeNetwork420(base);
 assert.deepEqual(normalized.rpcUrls,[RPC,OTHER]);
 assert.equal(normalized.nativeCurrency.symbol,'420');
 assert.equal(normalized.smartAccountApproved,false);
 assert.throws(()=>normalizeNetwork420({...base,rpcUrls:[RPC,'http://evil.example.org/']}),/HTTPS/);
 assert.throws(()=>normalizeNetwork420({...base,nativeCurrency:{symbol:'X',decimals:-1}}),/native currency/);
});
test('M3: endpoint cross-chain spoofing and unhealthy failover fail closed',async()=>{
 const network=normalizeNetwork420(base);
 assert.equal((await probeEndpoint420(RPC,'0x1a4',fakeRpc())).healthy,true);
 await assert.rejects(()=>probeEndpoint420(RPC,'0x1a4',fakeRpc({[RPC]:'0x1'})),/different chain/);
 const probe=await probeNetwork420(network,fakeRpc({[OTHER]:'0x1'}));
 assert.deepEqual(probe.map(x=>x.healthy),[true,false]);
 assert.equal(probe[1].url,OTHER);
});
test('M3: network registry preserves chain-scoped tokens but cannot inherit SmartAccount authority',()=>{
 const a=normalizeNetwork420({...base,assets:[{address:'0x'+'22'.repeat(20),symbol:'ERC',decimals:6}]});
 const registry=normalizeRegistry420({epoch:5,selectedChainId:'0x1a4',networks:{'0x1a4':{...a,smartAccountApproved:true,enabled:true}}});
 assert.equal(registry.epoch,5);
 assert.equal(registry.selectedChainId,'0x1a4');
 assert.equal(registry.networks['0x1a4'].smartAccountApproved,false);
 assert.equal(registry.networks['0x1a4'].assets[0].decimals,6);
 assert.equal(registry.networks['0x1'].assets?.length||0,0);
});
test('M3: wallet_watchAsset accepts only chain-matched ERC20 metadata',()=>{
 const opts={type:'ERC20',options:{address:'0x'+'22'.repeat(20),symbol:'ERC',decimals:6,chainId:'0x1a4'}};
 assert.equal(watchAsset420(opts,'0x1a4').symbol,'ERC');
 assert.throws(()=>watchAsset420({...opts,options:{...opts.options,chainId:'0x1'}},'0x1a4'),/chain mismatch/);
 assert.throws(()=>watchAsset420({...opts,options:{...opts.options,address:'0x'+'0'.repeat(40)}},'0x1a4'),/contract address/);
 assert.throws(()=>watchAsset420({...opts,type:'ERC721'},'0x1a4'),/ERC20/);
});
test('M3: provider, approval, sign/nonce/preview and UX are chain-bound',()=>{
 const worker=read('service-worker.js'),popup=read('popup.js'),html=read('popup.html');
 for(const method of ['wallet_addEthereumChain','wallet_switchEthereumChain','wallet_watchAsset']){
   assert.ok(worker.includes(method),method);
 }
 for(const marker of ['networkRegistry420','effectiveChain420(origin)','probeNetwork420','notifyChain420','chainChanged',
  'context.epoch','context.chainId','Network context changed during signing','No independently verified SmartAccount420 authority',
  'permission','aggregateAssets420','monitorNetworks420']){
   assert.ok(worker.includes(marker),marker);
 }
 assert.match(worker,/state.network.epoch!==message.epoch/);
 assert.match(worker,/selectedAccount!==message.account/);
 assert.match(worker,/await probeNetwork420\(network\)/);
 assert.match(popup,/before.epoch!==state.wallet.network.epoch/);
 assert.match(popup,/confirmed:true,chainId:before.chainId,epoch:before.epoch/);
 for(const id of ['network-select','switch-network','add-network-form','network-health','aggregate-assets','new-currency-symbol']){
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.doesNotMatch(worker,/eth_sendRawTransaction/);
});
