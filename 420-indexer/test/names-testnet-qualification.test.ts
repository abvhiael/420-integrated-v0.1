import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOVERNANCE_TIMELOCK_420,
  NAMES_ADDRESS_420,
  NAMES_RUNTIME_HASH_420,
  NAMES_SERVICE_ID_420,
  REGISTRY_ADDRESS_420,
  validateNamesOfficialTestnetManifest420,
  validateNamesReadEvidence420,
  validateNamesWorkflowEvidence420,
  validateNamesServiceEvidence420,
  validateNamesLiveTestnetEvidence420,
  runtimeHash420,
} from '../src/names-testnet-qualification.js';

const ZERO32='0x'+'00'.repeat(32);
const tx=(n:number)=>'0x'+n.toString(16).padStart(64,'0');
const manifest={
  schemaVersion:'1.0.0' as const,
  network:{name:'420 Official Testnet',environment:'testnet' as const,chainId:'420'},
  rpc:{http:['https://rpc.420.example/']},
  services:{indexer:'https://indexer.420.example/'},
  contracts:{
    Names420:{address:NAMES_ADDRESS_420,source:'genesis'},
    ProtocolRegistry:{address:REGISTRY_ADDRESS_420,source:'genesis'},
  }
};

const workflow={
  label:'audit9-qualification.420',
  labelHash:'0x'+'11'.repeat(32),
  owner:'0x1111111111111111111111111111111111111111',
  recipient:'0x2222222222222222222222222222222222222222',
  commitTx:tx(1),registerTx:tx(2),renewTx:tx(3),resolutionTx:tx(4),
  reverseTx:tx(5),transferTx:tx(6),acceptTx:tx(7),
  finalOwner:'0x2222222222222222222222222222222222222222',
  finalResolvedAddress:'0x2222222222222222222222222222222222222222',
  finalProfileId:ZERO32,finalServiceId:ZERO32,reverseAfterTransfer:ZERO32,
};

const read={
  chainId:'420',
  genesisHash:'0x'+'ab'.repeat(32),
  blockNumber:'42',
  names:{
    address:NAMES_ADDRESS_420,
    codeHash:NAMES_RUNTIME_HASH_420,
    systemName:'Names420',
    protocolVersion:3,
    governanceTimelock:GOVERNANCE_TIMELOCK_420,
    mappingRootSlots:{'0':ZERO32,'1':ZERO32,'2':ZERO32},
  },
  registry:{
    address:REGISTRY_ADDRESS_420,
    serviceId:NAMES_SERVICE_ID_420,
    implementation:NAMES_ADDRESS_420,
    revision:1,
    codeHash:NAMES_RUNTIME_HASH_420,
    active:true,
  },
};

const services={
  indexer:{qualified:true,chainId:'420',protocol:'420Names' as const,labelHash:workflow.labelHash,latestEventName:'NameTransferred',latestBlockNumber:'42'},
  search:{qualified:true,labelHash:workflow.labelHash,resolvedOwner:workflow.finalOwner,resolvedAddress:workflow.finalResolvedAddress,source:'420Names canonical public state'},
  wallet:{qualified:true,label:workflow.label,labelHash:workflow.labelHash,resolvedAddress:workflow.finalResolvedAddress},
};

test('accepts a fully bound official testnet manifest',()=>{
  assert.equal(validateNamesOfficialTestnetManifest420(manifest).network.chainId,'420');
});

test('rejects local, insecure, credentialed, missing-service and wrong-address manifests',()=>{
  assert.throws(()=>validateNamesOfficialTestnetManifest420({...manifest,network:{...manifest.network,environment:'local' as any}}),/environment=testnet/);
  assert.throws(()=>validateNamesOfficialTestnetManifest420({...manifest,rpc:{http:['http://rpc.example/']}}),/HTTPS/);
  assert.throws(()=>validateNamesOfficialTestnetManifest420({...manifest,rpc:{http:['https://user:pass@rpc.example/']}}),/credentials/);
  assert.throws(()=>validateNamesOfficialTestnetManifest420({...manifest,services:{} as any}),/Indexer/);
  assert.throws(()=>validateNamesOfficialTestnetManifest420({...manifest,contracts:{...manifest.contracts,Names420:{address:'0x0000000000000000000000000000000000000445',source:'genesis'}}}),/Names420 address mismatch/);
});

test('accepts exact live Names runtime, storage roots, governance and Registry discovery evidence',()=>{
  assert.doesNotThrow(()=>validateNamesReadEvidence420(manifest,read));
});

test('rejects wrong chain, runtime, identity, governance, storage and Registry discovery',()=>{
  assert.throws(()=>validateNamesReadEvidence420(manifest,{...read,chainId:'1'}),/chain ID/);
  assert.throws(()=>validateNamesReadEvidence420(manifest,{...read,names:{...read.names,codeHash:'0x'+'12'.repeat(32)}}),/runtime hash/);
  assert.throws(()=>validateNamesReadEvidence420(manifest,{...read,names:{...read.names,systemName:'Wrong'}}),/systemName/);
  assert.throws(()=>validateNamesReadEvidence420(manifest,{...read,names:{...read.names,protocolVersion:2}}),/protocolVersion/);
  assert.throws(()=>validateNamesReadEvidence420(manifest,{...read,names:{...read.names,governanceTimelock:'0x3333333333333333333333333333333333333333'}}),/governance/);
  assert.throws(()=>validateNamesReadEvidence420(manifest,{...read,names:{...read.names,mappingRootSlots:{...read.names.mappingRootSlots,'1':'0x'+'01'.repeat(32)}}}),/slot 1/);
  assert.throws(()=>validateNamesReadEvidence420(manifest,{...read,registry:{...read.registry,implementation:'0x3333333333333333333333333333333333333333'}}),/does not discover/);
  assert.throws(()=>validateNamesReadEvidence420(manifest,{...read,registry:{...read.registry,active:false}}),/must be active/);
});

test('accepts complete commit/register/renew/resolution/reverse/transfer journey',()=>{
  assert.doesNotThrow(()=>validateNamesWorkflowEvidence420(workflow));
});

test('rejects incomplete or semantically stale lifecycle evidence',()=>{
  assert.throws(()=>validateNamesWorkflowEvidence420({...workflow,acceptTx:'0x1234'}),/acceptTx/);
  assert.throws(()=>validateNamesWorkflowEvidence420({...workflow,finalOwner:workflow.owner}),/final owner/);
  assert.throws(()=>validateNamesWorkflowEvidence420({...workflow,finalResolvedAddress:workflow.owner}),/reset resolution to recipient/);
  assert.throws(()=>validateNamesWorkflowEvidence420({...workflow,finalProfileId:'0x'+'01'.repeat(32)}),/profileId/);
  assert.throws(()=>validateNamesWorkflowEvidence420({...workflow,reverseAfterTransfer:workflow.labelHash}),/reverse mapping/);
});

test('accepts Indexer Search and Wallet agreement with canonical post-transfer state',()=>{
  assert.doesNotThrow(()=>validateNamesServiceEvidence420(workflow,services,'420'));
});

test('rejects stale or contradictory derived-service evidence',()=>{
  assert.throws(()=>validateNamesServiceEvidence420(workflow,{...services,indexer:{...services.indexer,chainId:'1'}},'420'),/Indexer chain ID/);
  assert.throws(()=>validateNamesServiceEvidence420(workflow,{...services,indexer:{...services.indexer,latestEventName:'ResolutionUpdated'}},'420'),/latest Names lifecycle/);
  assert.throws(()=>validateNamesServiceEvidence420(workflow,{...services,search:{...services.search,resolvedOwner:workflow.owner}}),/Search owner/);
  assert.throws(()=>validateNamesServiceEvidence420(workflow,{...services,wallet:{...services.wallet,resolvedAddress:workflow.owner}}),/Wallet resolution/);
});

test('binds live evidence to the exact repository SHA and rejects local-example provenance',()=>{
  const evidence={
    schema:'420-names-live-testnet-qualification-v1' as const,
    phase:'NAMES-AUDIT-9' as const,
    status:'PASS' as const,
    repositorySha:'a'.repeat(40),
    manifestPath:'developer-hub/manifests/testnet.json',
    read,workflow,services,
  };
  assert.equal(validateNamesLiveTestnetEvidence420(manifest,evidence,'a'.repeat(40)).status,'PASS');
  assert.throws(()=>validateNamesLiveTestnetEvidence420(manifest,{...evidence,repositorySha:'b'.repeat(40)},'a'.repeat(40)),/SHA mismatch/);
  assert.throws(()=>validateNamesLiveTestnetEvidence420(manifest,{...evidence,manifestPath:'developer-hub/manifests/local.example.json'}),/official testnet/);
});

test('runtime hash helper fails closed on empty code and hashes real runtime bytes',()=>{
  assert.throws(()=>runtimeHash420('0x'),/runtime bytecode/);
  assert.match(runtimeHash420('0x6000'),/^0x[0-9a-f]{64}$/);
});
