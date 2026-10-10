import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface,keccak256 } from 'ethers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RpcAuthority,ABIS,payComponents } from '../src/authority.mjs';
import { b32,address,NOW } from './fixtures.mjs';
const registryABI=['function component(bytes32) view returns(tuple(bytes32 componentId,address implementation,bytes32 runtimeCodeHash,tuple(uint16 major,uint16 minor,uint16 patch) version,uint8 lifecycle))','function isActive(bytes32) view returns(bool)'];
function fixture(){
  const code='0x60006000',codeHash=keccak256(code),versionResult=new Interface(['function protocolVersion() view returns(uint32)']).encodeFunctionResult('protocolVersion',[1]);
  const config={chainId:'420',environment:'local',rpcUrl:'http://127.0.0.1:8545',registry:{address:address(10),codeHash},contracts:Object.fromEntries(Object.keys(ABIS).map((name,i)=>[name,{address:address(i+20),codeHash,versionResult,verified:true,...payComponents[name]?{componentId:payComponents[name],registryVersion:[1,0,0]}:{}}]))};
  const calls=[];let wrong=null;
  const wiring={OrderRegistry420:{listingRegistry:'ListingRegistry420',policyRegistry:'MarketPolicyRegistry420',inventoryReservation:'InventoryReservation420'},InventoryReservation420:{listingRegistry:'ListingRegistry420',orderRegistry:'OrderRegistry420'},MarketPaySettlementAdapter420:{orders:'OrderRegistry420',payments:'PaymentRegistry420',invoices:'InvoiceRegistry420',merchants:'MerchantRegistry420'}};
  const rpc={send:async(method,args)=>{
    calls.push({method,args});if(wrong==='outage')throw new Error('rpc unavailable');
    if(method==='eth_chainId')return wrong==='chain'?'0x1':'0x1a4';
    if(method==='eth_getBlockByNumber')return wrong==='finality'?null:{hash:b32(100),parentHash:b32(99),number:'0x1',timestamp:'0x'+Math.floor((NOW-(wrong==='stale'?121000:0))/1000).toString(16)};
    if(method==='eth_getCode')return wrong==='code'?'0x6001':code;
    const [request]=args;
    const version=new Interface(['function protocolVersion() view returns(uint32)']);if(request.data===version.encodeFunctionData('protocolVersion'))return wrong==='version'?version.encodeFunctionResult('protocolVersion',[2]):versionResult;
    if(request.to===config.registry.address){const iface=new Interface(registryABI),parsed=iface.parseTransaction({data:request.data}),binding=Object.values(config.contracts).find(c=>c.componentId===parsed.args[0]);return iface.encodeFunctionResult(parsed.name,parsed.name==='isActive'?[wrong!=='registryActive']:[[parsed.args[0],wrong==='registryAddress'?address(999):binding.address,codeHash,[1,0,0],2]]);}
    const name=Object.keys(config.contracts).find(name=>config.contracts[name].address===request.to),iface=new Interface(ABIS[name]),parsed=iface.parseTransaction({data:request.data});
    const target=wiring[name]?.[parsed.name];
    if(target)return iface.encodeFunctionResult(parsed.name,[wrong==='wiring'?address(999):config.contracts[target].address]);
    if(parsed.name==='deploymentChainId')return iface.encodeFunctionResult(parsed.name,[wrong==='adapterChain'?1:420]);
    if(parsed.name==='merchants')return iface.encodeFunctionResult(parsed.name,[address(100),b32(4),b32(5),1,true,1]);
    throw new Error('unhandled RPC '+name+'.'+parsed.name);
  }};
  return {config,calls,rpc,setWrong:value=>wrong=value,authority:new RpcAuthority(config,{rpc,now:()=>NOW})};
}
test('production RPC adapter pins EIP-1898 finalized hash, verifies bindings and correctly decodes public merchant getter',async()=>{
  const f=fixture(),snapshot=await f.authority.snapshot(),merchant=await snapshot.merchant(b32(4));assert.equal(merchant.controller,address(100));assert.equal(merchant.active,true);assert.equal(snapshot.chainId,'420');assert.equal(snapshot.finalized,true);
  for(const call of f.calls.filter(call=>['eth_getCode','eth_call'].includes(call.method)))assert.deepEqual(call.args[1],{blockHash:b32(100),requireCanonical:true});
});
for(const cause of ['chain','code','version','registryActive','registryAddress','wiring','adapterChain','finality','stale','outage'])test(`production authority fails closed on ${cause} and never falls back to latest`,async()=>{const f=fixture();f.setWrong(cause);await assert.rejects(()=>f.authority.snapshot(),e=>e.status===503);assert.equal(f.calls.some(c=>JSON.stringify(c.args).includes('latest')),false);});
test('missing manifests, unknown contracts and malformed configuration are refused before service startup',()=>{const f=fixture();delete f.config.contracts.PaymentRegistry420;assert.throws(()=>new RpcAuthority(f.config,{rpc:f.rpc}));f.config.rpcUrl='http://169.254.169.254';assert.throws(()=>new RpcAuthority(f.config,{rpc:f.rpc}));});
test('production contract-wallet verifier requires finalized EIP-1271 magic and bounded gas',async()=>{
  const f=fixture(),original=f.rpc.send,contract=address(700),iface=new Interface(['function isValidSignature(bytes32,bytes) view returns(bytes4)']);let valid=true;
  f.rpc.send=async(method,args)=>{if(method==='eth_call'&&args[0].to===contract){assert.equal(args[0].gas,'0x186a0');assert.deepEqual(args[1],{blockHash:b32(100),requireCanonical:true});return iface.encodeFunctionResult('isValidSignature',[valid?'0x1626ba7e':'0xffffffff']);}return original(method,args);};
  assert.equal(await f.authority.verifyContractSignature(contract,'message','0x1234'),true);valid=false;assert.equal(await f.authority.verifyContractSignature(contract,'message','0x1234'),false);
});
test('canonical snapshot read cannot authorize after its request deadline',async()=>{
  const f=fixture();let clock=NOW;f.authority.now=()=>clock;const source=await f.authority.snapshot();clock+=10001;await assert.rejects(()=>source.merchant(b32(4)),e=>e.code==='authority_deadline');
});
test('all service function bindings exactly match freshly compiled canonical contract ABI',()=>{
  assert.ok(process.env.COMMERCE_ARTIFACT_DIR,'COMMERCE_ARTIFACT_DIR required: run scripts/commerce/qualify-service.py');
  for(const [name,abi] of Object.entries(ABIS)){
    const canonical=new Interface(JSON.parse(readFileSync(join(process.env.COMMERCE_ARTIFACT_DIR,name+'.sol',name+'.json'),'utf8')).abi),used=new Interface(abi);
    for(const fragment of used.fragments){if(fragment.type!=='function')continue;const actual=canonical.getFunction(fragment.format('sighash'));assert.ok(actual,`${name}.${fragment.name} missing`);assert.equal(JSON.stringify(actual.inputs.map(x=>x.format('sighash'))),JSON.stringify(fragment.inputs.map(x=>x.format('sighash'))),name+'.'+fragment.name+' inputs');assert.equal(JSON.stringify(actual.outputs.map(x=>x.format('sighash'))),JSON.stringify(fragment.outputs.map(x=>x.format('sighash'))),name+'.'+fragment.name+' outputs');}
  }
});

test('SDK static merchant/listing encoder exactly matches compiled canonical selectors and arguments',async()=>{const {encodeCommerceMerchantTransaction420}=await import('../../packages/420-sdk/dist/commerce.js');for(const [name,method,args] of [['MerchantRegistry420','register',[b32(1),b32(0),b32(3),address(100)]],['ListingRegistry420','createListing',[b32(1),b32(0),b32(3),b32(4),b32(5),b32(6),b32(7),b32(8),address(100),'100','10',0]],['ListingRegistry420','reviseListing',[b32(1),b32(2),b32(3),b32(4),b32(5),address(100),'100','10',0]]]){const canonical=new Interface(JSON.parse(readFileSync(join(process.env.COMMERCE_ARTIFACT_DIR,name+'.sol',name+'.json'),'utf8')).abi);assert.equal(encodeCommerceMerchantTransaction420(method,args),canonical.encodeFunctionData(method,args));}});
