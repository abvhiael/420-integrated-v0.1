import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOVERNANCE_TIMELOCK_420,
  IDENTITY_ADDRESS_420,
  IDENTITY_RUNTIME_HASH_420,
  validateIdentityOfficialTestnetManifest420,
  validateIdentityReadEvidence420,
  validateIdentityLifecycleEvidence420,
  validateIdentityServiceEvidence420,
  validateIdentityRecoveryEvidence420,
  validateIdentityLiveTestnetEvidence420,
  identityRuntimeHash420,
} from '../src/identity-testnet-qualification.js';

const ZERO32='0x'+'00'.repeat(32);
const tx=(n:number)=>'0x'+n.toString(16).padStart(64,'0');
const addr=(n:number)=>'0x'+n.toString(16).padStart(40,'0');
const b32=(n:number)=>'0x'+n.toString(16).padStart(64,'0');

const manifest={
  schemaVersion:'1.0.0' as const,
  network:{name:'420 Official Testnet',environment:'testnet' as const,chainId:'420'},
  rpc:{http:['https://rpc.420.example/']},
  services:{
    indexer:'https://indexer.420.example/',
    search:'https://search.420.example/',
    explorer:'https://explorer.420.example/',
  },
  contracts:{Identity420:{address:IDENTITY_ADDRESS_420,source:'genesis'}},
};

const read={
  chainId:'420',
  genesisHash:b32(100),
  blockNumber:'4200',
  identity:{
    address:IDENTITY_ADDRESS_420,
    codeHash:IDENTITY_RUNTIME_HASH_420,
    systemName:'Identity420',
    protocolVersion:3,
    governanceTimelock:GOVERNANCE_TIMELOCK_420,
    storageSlots:{'0':ZERO32,'1':ZERO32,'2':ZERO32,'3':ZERO32},
  },
};

const lifecycle={
  profileId:b32(1),owner:addr(1),recipient:addr(2),issuerId:b32(2),issuerController:addr(3),
  credentialId:b32(3),credentialType:b32(4),
  createProfileTx:tx(1),updateProfileTx:tx(2),transferNominationTx:tx(3),transferAcceptanceTx:tx(4),
  issuerConfigureTx:tx(5),credentialIssueTx:tx(6),credentialRejectTx:tx(7),credentialReissueTx:tx(8),
  credentialRevokeTx:tx(9),expiryCredentialId:b32(5),expiryIssueTx:tx(10),expiryObservedInvalid:true,
  issuerDeactivateTx:tx(11),issuerReactivateTx:tx(12),
  negativeUnauthorizedProfileTxRejected:true,
  negativeUnauthorizedIssuerTxRejected:true,
  negativeUnauthorizedRevocationRejected:true,
  finalProfileController:addr(2),finalProfileActive:true,
  rejectedCredentialValid:false,revokedCredentialValid:false,issuerActiveAfterRecovery:true,
};

const services={
  wallet:{qualified:true,profileId:lifecycle.profileId,controller:lifecycle.finalProfileController,rejectedCredentialValid:false,revokedCredentialValid:false},
  indexer:{
    qualified:true,chainId:'420',protocol:'420Identity' as const,
    profileObjectKey:'profileId:'+lifecycle.profileId,
    issuerObjectKey:'issuerId:'+lifecycle.issuerId,
    credentialObjectKey:'credentialId:'+lifecycle.credentialId,
    latestProfileEvent:'ProfileControllerTransferred',
    latestIssuerEvent:'IssuerSet',
    latestCredentialEvent:'CredentialRevoked',
    latestBlockNumber:'4200',
  },
  search:{
    qualified:true,profileId:lifecycle.profileId,active:true,controller:lifecycle.finalProfileController,
    source:'420Identity canonical public state',privatePayloadExposed:false,
  },
  explorer:{
    qualified:true,identityAddress:IDENTITY_ADDRESS_420,transactionHash:lifecycle.credentialRevokeTx,
    blockNumber:'4200',canonicalAuthority:false,
  },
};

const recovery={
  restart:{qualified:true,checkpointBefore:'4190',checkpointAfter:'4200',replayGap:10,repeatRestartProcessedZero:true},
  reorg:{qualified:true,recoveredDepth:2,finalCheckpoint:'4200',deepReorgRejectedWithoutMutation:true},
  dependencyFailure:{
    qualified:true,wrongChainRejected:true,staleIndexerRejected:true,searchUnavailableFailsClosed:true,
    explorerUnavailableNonAuthoritative:true,walletWrongChainRejected:true,
  },
};

test('accepts fully bound official Identity testnet manifest',()=>{
  assert.equal(validateIdentityOfficialTestnetManifest420(manifest).network.chainId,'420');
});

test('rejects local, insecure, credentialed, missing-service and wrong-address manifests',()=>{
  assert.throws(()=>validateIdentityOfficialTestnetManifest420({...manifest,network:{...manifest.network,environment:'local' as any}}),/environment=testnet/);
  assert.throws(()=>validateIdentityOfficialTestnetManifest420({...manifest,rpc:{http:['http://rpc.example/']}}),/HTTPS/);
  assert.throws(()=>validateIdentityOfficialTestnetManifest420({...manifest,rpc:{http:['https://u:p@rpc.example/']}}),/credentials/);
  assert.throws(()=>validateIdentityOfficialTestnetManifest420({...manifest,services:{...manifest.services,search:undefined} as any}),/search service/);
  assert.throws(()=>validateIdentityOfficialTestnetManifest420({...manifest,contracts:{Identity420:{address:addr(9),source:'genesis'}}}),/Identity420 address mismatch/);
});

test('accepts exact live Identity runtime, chain identity, storage witness and governance binding',()=>{
  assert.doesNotThrow(()=>validateIdentityReadEvidence420(manifest,read));
});

test('rejects wrong chain, runtime, contract identity/version, governance and malformed storage witness',()=>{
  assert.throws(()=>validateIdentityReadEvidence420(manifest,{...read,chainId:'1'}),/chain ID/);
  assert.throws(()=>validateIdentityReadEvidence420(manifest,{...read,identity:{...read.identity,codeHash:b32(9)}}),/runtime hash/);
  assert.throws(()=>validateIdentityReadEvidence420(manifest,{...read,identity:{...read.identity,systemName:'Wrong'}}),/systemName/);
  assert.throws(()=>validateIdentityReadEvidence420(manifest,{...read,identity:{...read.identity,protocolVersion:2}}),/protocolVersion/);
  assert.throws(()=>validateIdentityReadEvidence420(manifest,{...read,identity:{...read.identity,governanceTimelock:addr(9)}}),/governance binding/);
  assert.throws(()=>validateIdentityReadEvidence420(manifest,{...read,identity:{...read.identity,storageSlots:{'bad':ZERO32}}}),/storage witness/);
});

test('accepts representative profile issuer credential negative expiry revoke and recovery lifecycle',()=>{
  assert.doesNotThrow(()=>validateIdentityLifecycleEvidence420(lifecycle));
});

test('rejects missing authorization expiry revocation and issuer-recovery evidence',()=>{
  assert.throws(()=>validateIdentityLifecycleEvidence420({...lifecycle,negativeUnauthorizedProfileTxRejected:false}),/unauthorized profile/);
  assert.throws(()=>validateIdentityLifecycleEvidence420({...lifecycle,negativeUnauthorizedIssuerTxRejected:false}),/unauthorized issuer/);
  assert.throws(()=>validateIdentityLifecycleEvidence420({...lifecycle,negativeUnauthorizedRevocationRejected:false}),/unauthorized credential revocation/);
  assert.throws(()=>validateIdentityLifecycleEvidence420({...lifecycle,expiryObservedInvalid:false}),/expired credential/);
  assert.throws(()=>validateIdentityLifecycleEvidence420({...lifecycle,rejectedCredentialValid:true}),/subject-rejected/);
  assert.throws(()=>validateIdentityLifecycleEvidence420({...lifecycle,revokedCredentialValid:true}),/revoked credential/);
  assert.throws(()=>validateIdentityLifecycleEvidence420({...lifecycle,issuerActiveAfterRecovery:false}),/issuer must be reactivated/);
});

test('accepts Wallet Indexer Search and Explorer agreement with same deployment',()=>{
  assert.doesNotThrow(()=>validateIdentityServiceEvidence420(lifecycle,services,'420'));
});

test('rejects stale contradictory or authoritative derived-service evidence',()=>{
  assert.throws(()=>validateIdentityServiceEvidence420(lifecycle,{...services,indexer:{...services.indexer,chainId:'1'}},'420'),/Indexer chain ID/);
  assert.throws(()=>validateIdentityServiceEvidence420(lifecycle,{...services,indexer:{...services.indexer,credentialObjectKey:'issuerId:'+lifecycle.issuerId}},'420'),/credential object key/);
  assert.throws(()=>validateIdentityServiceEvidence420(lifecycle,{...services,search:{...services.search,privatePayloadExposed:true}},'420'),/private Identity payload/);
  assert.throws(()=>validateIdentityServiceEvidence420(lifecycle,{...services,wallet:{...services.wallet,controller:lifecycle.owner}},'420'),/Wallet controller/);
  assert.throws(()=>validateIdentityServiceEvidence420(lifecycle,{...services,explorer:{...services.explorer,canonicalAuthority:true}},'420'),/non-authoritative/);
});

test('accepts restart reorg and dependency-failure evidence and rejects missing fail-closed properties',()=>{
  assert.doesNotThrow(()=>validateIdentityRecoveryEvidence420(recovery));
  assert.throws(()=>validateIdentityRecoveryEvidence420({...recovery,restart:{...recovery.restart,repeatRestartProcessedZero:false}}),/idempotent/);
  assert.throws(()=>validateIdentityRecoveryEvidence420({...recovery,reorg:{...recovery.reorg,recoveredDepth:0}}),/recovery depth/);
  assert.throws(()=>validateIdentityRecoveryEvidence420({...recovery,reorg:{...recovery.reorg,deepReorgRejectedWithoutMutation:false}}),/deep reorg/);
  assert.throws(()=>validateIdentityRecoveryEvidence420({...recovery,dependencyFailure:{...recovery.dependencyFailure,wrongChainRejected:false}}),/wrong-chain/);
  assert.throws(()=>validateIdentityRecoveryEvidence420({...recovery,dependencyFailure:{...recovery.dependencyFailure,walletWrongChainRejected:false}}),/Wallet wrong-chain/);
});

test('binds PASS evidence to exact repository SHA and rejects local provenance',()=>{
  const evidence={
    schema:'420-identity-live-testnet-qualification-v1' as const,phase:'ID-AUDIT-9' as const,status:'PASS' as const,
    repositorySha:'a'.repeat(40),manifestPath:'developer-hub/manifests/testnet.json',
    read,lifecycle,services,recovery,
  };
  assert.equal(validateIdentityLiveTestnetEvidence420(manifest,evidence,'a'.repeat(40)).status,'PASS');
  assert.throws(()=>validateIdentityLiveTestnetEvidence420(manifest,{...evidence,repositorySha:'b'.repeat(40)},'a'.repeat(40)),/SHA mismatch/);
  assert.throws(()=>validateIdentityLiveTestnetEvidence420(manifest,{...evidence,manifestPath:'developer-hub/manifests/local.example.json'}),/official testnet/);
});

test('runtime hash helper rejects empty code and hashes actual runtime bytes',()=>{
  assert.throws(()=>identityRuntimeHash420('0x'),/runtime bytecode/);
  assert.match(identityRuntimeHash420('0x6000'),/^0x[0-9a-f]{64}$/);
});
