import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TOKEN_TEMPLATES_420, TOKEN_COMPONENT_ID_420, TOKEN_GENESIS_V3_420, ZERO_WORD,
  encodeTokenCreation420, normalizeTokenDraft420, tokenHashHex420, tokenHashText420,
  tokenSelector420} from '../core/token-sdk.js';
import { normalizeTokenReleaseBinding420, verifyTokenRuntime420, TOKEN_SERVICE_ID_420,
  TOKEN_COMMUNITY_VAULT_ID_420, TOKEN_CREATION_FEE_WEI_420 } from '../core/token-runtime.js';
import { buildTokenDeploymentRequest420, prepareTokenDeploymentHandoff420 } from '../core/token-handoff.js';
import { encodeExecute } from '../core/abi.js';
import {fixture,order,draftFor,abi,word,addr,digest,serviceHash,componentHash,vaultHash,controller,account,state} from './token-test-fixture.js';

test('canonical eight SDK profiles agree with frozen Genesis config, Solidity identity and profile commitments',async()=>{
  const root=new URL('../../../',import.meta.url);
  const config=JSON.parse(await readFile(new URL('contracts/config/420token-genesis.json',root),'utf8'));
  const ids=await readFile(new URL('contracts/src/token/TokenIds420.sol',root),'utf8');
  const catalog=await readFile(new URL('contracts/src/token/TokenTemplateRegistry420.sol',root),'utf8');
  assert.deepEqual(TOKEN_TEMPLATES_420.map(t=>t.key),config.templates);
  assert.equal(config.serviceId,TOKEN_SERVICE_ID_420);
  assert.equal(config.communityTreasuryVaultId,TOKEN_COMMUNITY_VAULT_ID_420);
  assert.equal(BigInt(config.creationFeeNative420)*10n**18n,TOKEN_CREATION_FEE_WEI_420);
  for(const t of TOKEN_TEMPLATES_420){
    assert.ok(ids.includes('420/token/template/'+t.slug+'/v1'));
    assert.ok(catalog.includes('TokenIds420.'+t.key));
    assert.ok(Object.isFrozen(t));
  }
  assert.equal(new Set(TOKEN_TEMPLATES_420.map(t=>t.id)).size,8);
  assert.equal(tokenHashHex420('0x'),'0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
});

test('ERC20 encoding uses exact Solidity ABI words, dynamic offsets, UTF-8 and base-unit supply',()=>{
  const p=TOKEN_TEMPLATES_420[2];
  const draft={template:p.key,userSalt:digest(1),name:'A🌿',symbol:'B',initialSupply:'100',cap:'200'};
  const creation=encodeTokenCreation420(draft);
  const name='41f09f8cbf'.padEnd(64,'0'),symbol='42'.padEnd(64,'0');
  const expected=tokenSelector420('createERC20(bytes32,string,string,uint256,uint256,bytes32)')+
    [word(p.id),word(192),word(256),word(100),word(200),word(digest(1)),word(5),name,word(1),symbol].join('');
  assert.equal(creation.data,expected);
  const config='0x'+[word(128),word(192),word(100),word(200),word(5),name,word(1),symbol].join('');
  assert.equal(creation.configHash,tokenHashHex420(config));
  assert.equal(creation.draft.initialSupply,'100');
  assert.equal(creation.template.capped,true);
});

test('ERC721 and ERC1155 encodings use exact ABI layouts and distinct config hashes',()=>{
  const salt=digest(9);
  const nft=encodeTokenCreation420({template:'ERC721_COLLECTION',userSalt:salt,name:'N',symbol:'S',baseURI:'U'});
  const dynamic=x=>word(1)+x.padEnd(64,'0');
  const tail=dynamic('4e')+dynamic('53')+dynamic('55');
  assert.equal(nft.data,tokenSelector420('createERC721(string,string,string,bytes32)')+
    [word(128),word(192),word(256),word(salt),tail].join(''));
  assert.equal(nft.configHash,tokenHashHex420('0x'+[word(96),word(160),word(224),tail].join('')));
  const multi=encodeTokenCreation420({template:'ERC1155_MULTI',userSalt:salt,uri:'X'});
  assert.equal(multi.data,tokenSelector420('createERC1155(string,bytes32)')+word(64)+word(salt)+dynamic('58'));
  assert.equal(multi.configHash,tokenHashHex420('0x'+word(32)+dynamic('58')));
});

test('all eight drafts are canonical, immutable, JSON-safe and distinguish feature semantics',()=>{
  const {binding}=fixture();
  const results=TOKEN_TEMPLATES_420.map(p=>buildTokenDeploymentRequest420(binding,draftFor(p)));
  assert.equal(new Set(results.map(x=>x.calldataHash)).size,8);
  for(const r of results){
    assert.equal(r.target,binding.factory.address);
    assert.equal(r.value,TOKEN_CREATION_FEE_WEI_420);
    assert.equal(r.configHash,encodeTokenCreation420(JSON.parse(JSON.stringify(r.draft))).configHash);
    assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.draft));
  }
  assert.equal(TOKEN_TEMPLATES_420.filter(p=>p.votes).length,1);
  assert.equal(TOKEN_TEMPLATES_420.filter(p=>p.permit).length,2);
  assert.equal(TOKEN_TEMPLATES_420.filter(p=>p.burnable).length,1);
});

test('draft validation rejects noncanonical templates, cap misuse, unsafe numeric values and oversized or malformed fields',()=>{
  const valid=draftFor();
  for(const [patch,pattern] of [
    [{template:'custom'},/unknown/],[{cap:'1'},/cap/],[{initialSupply:1.5},/exact integer/],
    [{initialSupply:Number.MAX_SAFE_INTEGER+1},/exact integer/],[{initialSupply:'1e18'},/exact integer/],
    [{initialSupply:-1n},/range/],[{initialSupply:1n<<256n},/range/],[{userSalt:'0x12'},/bytes32/],
    [{name:'\ud800'},/Unicode/],[{name:'x'.repeat(4050)},/Wallet limit/],[{bytecode:'0x60'},/unexpected/],
    [{template:'ERC20_CAPPED',cap:'0'},/cap/],[{template:'ERC20_CAPPED',cap:'99'},/cap/],
  ])assert.throws(()=>encodeTokenCreation420({...valid,...patch}),pattern);
  assert.equal(normalizeTokenDraft420({...valid,initialSupply:(1n<<256n)-1n}).initialSupply,((1n<<256n)-1n).toString());
});

test('real TOKEN-AUDIT-4 Registry dependency commitment is reproduced exactly by the SDK',async()=>{
  const e=JSON.parse(await readFile(new URL('../../../docs/audit/420TOKEN-AUDIT-4-QUALIFICATION.json',import.meta.url),'utf8'));
  const report=e.qualification.report, local=report.localResult;
  const deps=Object.fromEntries(order.map(n=>[n,{address:local.addresses[n],codeHash:local.runtimeCodeHashes[n]}]));
  const b={serviceId:TOKEN_SERVICE_ID_420,componentId:TOKEN_COMPONENT_ID_420,chainId:31337,version:1,
    genesisHash:digest(1),genesisConfigHash:TOKEN_GENESIS_V3_420,
    factory:deps.TokenFactory420,templateRegistry:deps.TokenTemplateRegistry420,
    communityTreasuryVault:deps.AssetVault420,communityTreasuryVaultId:TOKEN_COMMUNITY_VAULT_ID_420,
    registry:deps.ProtocolRegistry,governanceTimelock:deps.GovernanceTimelock,
    vaultGraph:Object.fromEntries(order.slice(2,8).map(n=>[n,deps[n]])),
    vaultRegistration:{creator:addr(1),policyIds:['AUTHORIZATION','ASSET','RELEASE','ACCOUNTING'].map(x=>tokenHashText420('420/token/local/'+x)),
      beneficiarySetId:ZERO_WORD,metadataHash:tokenHashText420('local/token/vault/metadata'),
      manifestHash:tokenHashText420('local/token/vault/manifest')},
    release:{metadataHash:report.metadataHash,manifestHash:report.manifestHash,interfaceHash:report.interfaceHash,
      dependencyRoot:local.dependencyRoot}};
  assert.equal(normalizeTokenReleaseBinding420(b).release.dependencyRoot,local.dependencyRoot);
  b.release.dependencyRoot=digest(2);
  assert.throws(()=>normalizeTokenReleaseBinding420(b),/dependency root/);
});

test('runtime verifies all dependencies, active Registry records, every template and canonical block',async()=>{
  const {provider,binding,calls}=fixture();
  const runtime=await verifyTokenRuntime420(provider,binding);
  assert.equal(runtime.templates.length,8);
  assert.ok(runtime.templates.every(t=>t.enabled));
  assert.equal(runtime.verificationBlock.number,'0x10');
  assert.equal(calls.filter(x=>x[0]==='eth_getCode').length,10);
  assert.ok(calls.filter(x=>x[0]==='eth_getCode'||x[0]==='eth_call').every(x=>x[1][1]==='0x10'));
  assert.ok(Object.isFrozen(runtime.dependencies)&&Object.isFrozen(runtime.vaultRegistration.policyIds));
});

test('every frozen profile prepares exact SmartAccount calldata, fee, configuration and explicit-review state',async()=>{
  const {provider,binding,calls}=fixture();
  for(const p of TOKEN_TEMPLATES_420){
    const r=buildTokenDeploymentRequest420(binding,draftFor(p));
    const prepared=await prepareTokenDeploymentHandoff420(provider,controller,state,binding,r);
    assert.equal(prepared.controller,controller);
    assert.equal(prepared.smartAccount,account);
    assert.equal(prepared.transaction.to,account);
    assert.equal(prepared.transaction.value,'0x0');
    assert.equal(prepared.transaction.data,encodeExecute(binding.factory.address,r.value,r.data));
    assert.equal(prepared.expectedChainId,420);
    assert.equal(prepared.configHash,r.configHash);
    assert.equal(prepared.confirmationRequired,true);
    assert.equal(prepared.simulation.passed,true);
    assert.ok(Object.isFrozen(prepared.transaction));
  }
  assert.equal(calls.filter(x=>x[0]==='eth_estimateGas').length,8);
  assert.ok(calls.every(x=>['eth_chainId','eth_getBlockByNumber','eth_getCode','eth_call','eth_estimateGas'].includes(x[0])));
});

test('runtime rejects wrong chain, wrong genesis, absent code, wrong code and reorganized snapshots',async()=>{
  for(const [mutate,pattern] of [
    [f=>{f.control.chain='0x1'},/chain/],[f=>{f.control.genesisHash=digest(9)},/genesis/],
    [f=>{f.codes.delete(f.binding.factory.address)},/runtime code mismatch/],
    [f=>{f.codes.set(f.binding.communityTreasuryVault.address,'0x6000')},/runtime code mismatch/],
    [f=>{f.control.canonicalHash=digest(9)},/reorganized/]
  ]){
    const f=fixture();mutate(f);
    await assert.rejects(verifyTokenRuntime420(f.provider,f.binding),pattern);
  }
});

test('runtime rejects wrong service, component, release commitments, immutables, Vault registration and template profiles',async()=>{
  for(const [mutate,pattern] of [
    [f=>f.set(f.binding.registry.address,'getService(bytes32)',abi(f.binding.factory.address,f.binding.factory.codeHash,f.binding.release.metadataHash,1,1000,0),['bytes32'],[serviceHash]),/Registry service/],
    [f=>f.set(f.binding.registry.address,'component(bytes32)',abi(componentHash,f.binding.factory.address,f.binding.factory.codeHash,1,0,0,3),['bytes32'],[componentHash]),/Registry component/],
    [f=>f.set(f.binding.registry.address,'getRegistrationProfile(bytes32,uint32)',abi(3,digest(1),f.binding.release.dependencyRoot,f.binding.release.interfaceHash),['bytes32','uint256'],[serviceHash,1]),/release commitments/],
    [f=>f.set(f.binding.factory.address,'communityTreasuryVault()',abi(addr(99))),/immutable mismatch/],
    [f=>f.set(f.binding.vaultGraph.VaultRegistry420.address,'getVault(bytes32)',f.vaultRecord().slice(0,-128)+word(2)+word(1),['bytes32'],[vaultHash]),/registered community Vault/],
    [f=>f.set(f.binding.vaultGraph.VaultAccounting420.address,'registry()',abi(addr(99))),/immutable mismatch/],
    [f=>f.enable(TOKEN_TEMPLATES_420[0],true,digest(9)),/template profile mismatch/],
    [f=>f.set(f.binding.registry.address,'resolveActive(bytes32)',abi(addr(99),1),['bytes32'],[serviceHash]),/service resolution/],
    [f=>f.set(f.binding.factory.address,'CREATION_FEE()',abi(41n*10n**18n)),/dependency mismatch/],
    [f=>f.set(f.binding.registry.address,'getService(bytes32)','0x1234',['bytes32'],[serviceHash]),/malformed/],
  ]){
    const f=fixture();mutate(f);
    await assert.rejects(verifyTokenRuntime420(f.provider,f.binding),pattern);
  }
});

test('disabled templates are visible but cannot be prepared; a disable during simulation rejects the handoff',async()=>{
  const f=fixture(),p=TOKEN_TEMPLATES_420[0],r=buildTokenDeploymentRequest420(f.binding,draftFor(p));
  f.enable(p,false);
  assert.equal((await verifyTokenRuntime420(f.provider,f.binding)).templates[0].enabled,false);
  await assert.rejects(prepareTokenDeploymentHandoff420(f.provider,controller,state,f.binding,r),/disabled/);
  assert.equal(f.calls.filter(x=>x[0]==='eth_estimateGas').length,0);
  f.enable(p,true);
  f.control.onEstimate=()=>f.enable(p,false);
  await assert.rejects(prepareTokenDeploymentHandoff420(f.provider,controller,state,f.binding,r),/disabled during simulation/);
});

test('SmartAccount simulation, gas failures, ownership and chain changes remain fail-closed',async()=>{
  const f=fixture(),r=buildTokenDeploymentRequest420(f.binding,draftFor());
  await assert.rejects(prepareTokenDeploymentHandoff420(f.provider,controller,{...state,expectedChainId:1},f.binding,r),/chain differs/);
  await assert.rejects(prepareTokenDeploymentHandoff420(f.provider,controller,{...state,controllerIsOwner:false},f.binding,r),/owner/);
  f.control.simulationError='revert';
  await assert.rejects(prepareTokenDeploymentHandoff420(f.provider,controller,state,f.binding,r),/simulation reverted/);
  f.control.simulationError=null;f.control.estimateError='out of gas';
  await assert.rejects(prepareTokenDeploymentHandoff420(f.provider,controller,state,f.binding,r),/gas estimation failed/);
  f.control.estimateError=null;f.control.onEstimate=()=>{f.control.chain='0x1'};
  await assert.rejects(prepareTokenDeploymentHandoff420(f.provider,controller,state,f.binding,r),/chain/);
});
