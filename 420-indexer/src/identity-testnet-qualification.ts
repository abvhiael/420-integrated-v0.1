import { getBytes, Interface, keccak256 } from 'ethers';

export const IDENTITY_TESTNET_SCHEMA_420 = '420-identity-live-testnet-qualification-v1';
export const IDENTITY_ADDRESS_420 = '0x0000000000000000000000000000000000000436';
export const GOVERNANCE_TIMELOCK_420 = '0x0000000000000000000000000000000000000429';
export const IDENTITY_RUNTIME_HASH_420 = '0xda0fcd565d7aea6590b3e0ec468f7b99af50138b62527e770ca367a57e6cfd86';

const HEX32=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const ZERO32='0x'+'00'.repeat(32);

export interface IdentityOfficialManifest420 {
  schemaVersion:'1.0.0';
  network:{name:string;environment:'testnet';chainId:string};
  rpc:{http:string[];websocket?:string[]};
  services:{indexer:string;search?:string;explorer?:string;[key:string]:string|undefined};
  contracts:{
    Identity420:{address:string;source:string;version?:string};
    Names420?:{address:string;source:string;version?:string};
    [key:string]:{address:string;source:string;version?:string}|undefined;
  };
}

export interface IdentityReadEvidence420 {
  chainId:string;
  genesisHash:string;
  blockNumber:string;
  identity:{
    address:string;
    codeHash:string;
    systemName:string;
    protocolVersion:number;
    governanceTimelock:string;
    storageSlots:Record<string,string>;
  };
}

export interface IdentityLifecycleEvidence420 {
  profileId:string;
  owner:string;
  recipient:string;
  issuerId:string;
  issuerController:string;
  credentialId:string;
  credentialType:string;
  createProfileTx:string;
  updateProfileTx:string;
  transferNominationTx:string;
  transferAcceptanceTx:string;
  issuerConfigureTx:string;
  credentialIssueTx:string;
  credentialRejectTx:string;
  credentialReissueTx:string;
  credentialRevokeTx:string;
  expiryCredentialId:string;
  expiryIssueTx:string;
  expiryObservedInvalid:boolean;
  issuerDeactivateTx:string;
  issuerReactivateTx:string;
  negativeUnauthorizedProfileTxRejected:boolean;
  negativeUnauthorizedIssuerTxRejected:boolean;
  negativeUnauthorizedRevocationRejected:boolean;
  finalProfileController:string;
  finalProfileActive:boolean;
  rejectedCredentialValid:boolean;
  revokedCredentialValid:boolean;
  issuerActiveAfterRecovery:boolean;
}

export interface IdentityServiceEvidence420 {
  wallet:{
    qualified:boolean;
    profileId:string;
    controller:string;
    rejectedCredentialValid:boolean;
    revokedCredentialValid:boolean;
  };
  indexer:{
    qualified:boolean;
    chainId:string;
    protocol:'420Identity';
    profileObjectKey:string;
    issuerObjectKey:string;
    credentialObjectKey:string;
    latestProfileEvent:string;
    latestIssuerEvent:string;
    latestCredentialEvent:string;
    latestBlockNumber:string;
  };
  search:{
    qualified:boolean;
    profileId:string;
    active:boolean;
    controller:string;
    source:string;
    privatePayloadExposed:boolean;
  };
  explorer:{
    qualified:boolean;
    identityAddress:string;
    transactionHash:string;
    blockNumber:string;
    canonicalAuthority:boolean;
  };
}

export interface IdentityRecoveryEvidence420 {
  restart:{
    qualified:boolean;
    checkpointBefore:string;
    checkpointAfter:string;
    replayGap:number;
    repeatRestartProcessedZero:boolean;
  };
  reorg:{
    qualified:boolean;
    recoveredDepth:number;
    finalCheckpoint:string;
    deepReorgRejectedWithoutMutation:boolean;
  };
  dependencyFailure:{
    qualified:boolean;
    wrongChainRejected:boolean;
    staleIndexerRejected:boolean;
    searchUnavailableFailsClosed:boolean;
    explorerUnavailableNonAuthoritative:boolean;
    walletWrongChainRejected:boolean;
  };
}

export interface IdentityLiveTestnetEvidence420 {
  schema:typeof IDENTITY_TESTNET_SCHEMA_420;
  phase:'ID-AUDIT-9';
  status:'PASS';
  repositorySha:string;
  manifestPath:string;
  read:IdentityReadEvidence420;
  lifecycle:IdentityLifecycleEvidence420;
  services:IdentityServiceEvidence420;
  recovery:IdentityRecoveryEvidence420;
}

function fail(message:string):never{throw new Error(message);}
function lowerAddress(value:string,label:string):string{
  if(!ADDRESS.test(value))fail(label+' must be an EVM address');
  return value.toLowerCase();
}
function positiveDecimal(value:string,label:string):bigint{
  if(!/^[1-9][0-9]*$/.test(value))fail(label+' must be a positive decimal integer');
  return BigInt(value);
}
function requireHttps(value:string,label:string):void{
  let u:URL;try{u=new URL(value);}catch{fail(label+' must be an absolute URL');}
  if(u.protocol!=='https:')fail(label+' must use HTTPS');
  if(u.username||u.password)fail(label+' must not embed credentials');
}
function txHash(value:string,label:string):void{
  if(!HEX32.test(value))fail(label+' must be a 32-byte transaction hash');
}
function bytes32(value:string,label:string):string{
  if(!HEX32.test(value))fail(label+' must be bytes32');
  return value.toLowerCase();
}

export function validateIdentityOfficialTestnetManifest420(manifest:IdentityOfficialManifest420):IdentityOfficialManifest420{
  if(!manifest||typeof manifest!=='object')fail('official testnet manifest missing');
  if(manifest.schemaVersion!=='1.0.0')fail('unsupported official testnet manifest schema');
  if(manifest.network?.environment!=='testnet')fail('ID-AUDIT-9 requires environment=testnet');
  positiveDecimal(manifest.network.chainId,'manifest chainId');
  if(!Array.isArray(manifest.rpc?.http)||manifest.rpc.http.length===0)fail('official testnet manifest requires RPC');
  manifest.rpc.http.forEach((url,i)=>requireHttps(url,'RPC['+i+']'));
  for(const service of ['indexer','search','explorer'] as const){
    const value=manifest.services?.[service];
    if(!value)fail('official testnet manifest requires '+service+' service');
    requireHttps(value,service);
  }
  const identity=lowerAddress(manifest.contracts?.Identity420?.address??'','manifest Identity420 address');
  if(identity!==IDENTITY_ADDRESS_420)fail('official testnet manifest Identity420 address mismatch');
  return structuredClone(manifest);
}

export function validateIdentityReadEvidence420(manifest:IdentityOfficialManifest420,evidence:IdentityReadEvidence420):void{
  const validated=validateIdentityOfficialTestnetManifest420(manifest);
  if(positiveDecimal(evidence.chainId,'observed chainId')!==positiveDecimal(validated.network.chainId,'manifest chainId'))fail('live chain ID does not match official manifest');
  if(!HEX32.test(evidence.genesisHash))fail('live genesis hash is invalid');
  positiveDecimal(evidence.blockNumber,'observed blockNumber');
  const identity=evidence.identity;
  if(lowerAddress(identity.address,'observed Identity420 address')!==IDENTITY_ADDRESS_420)fail('Identity420 address mismatch');
  if(identity.codeHash.toLowerCase()!==IDENTITY_RUNTIME_HASH_420)fail('Identity420 runtime hash mismatch');
  if(identity.systemName!=='Identity420')fail('Identity420 systemName mismatch');
  if(identity.protocolVersion!==3)fail('Identity420 protocolVersion mismatch');
  if(lowerAddress(identity.governanceTimelock,'Identity governance timelock')!==GOVERNANCE_TIMELOCK_420)fail('Identity420 governance binding mismatch');
  for(const [slot,value] of Object.entries(identity.storageSlots)){
    if(!/^[0-9]+$/.test(slot)||!HEX32.test(value))fail('Identity420 storage witness malformed');
  }
}

export function validateIdentityLifecycleEvidence420(flow:IdentityLifecycleEvidence420):void{
  const profileId=bytes32(flow.profileId,'profileId');
  const issuerId=bytes32(flow.issuerId,'issuerId');
  const credentialId=bytes32(flow.credentialId,'credentialId');
  const expiryId=bytes32(flow.expiryCredentialId,'expiryCredentialId');
  if(profileId===ZERO32||issuerId===ZERO32||credentialId===ZERO32||expiryId===ZERO32)fail('Identity lifecycle IDs must be nonzero');
  bytes32(flow.credentialType,'credentialType');
  const owner=lowerAddress(flow.owner,'profile owner');
  const recipient=lowerAddress(flow.recipient,'profile recipient');
  lowerAddress(flow.issuerController,'issuer controller');
  if(owner===recipient)fail('controller transfer requires distinct accounts');
  const txs={
    createProfileTx:flow.createProfileTx,updateProfileTx:flow.updateProfileTx,
    transferNominationTx:flow.transferNominationTx,transferAcceptanceTx:flow.transferAcceptanceTx,
    issuerConfigureTx:flow.issuerConfigureTx,credentialIssueTx:flow.credentialIssueTx,
    credentialRejectTx:flow.credentialRejectTx,credentialReissueTx:flow.credentialReissueTx,
    credentialRevokeTx:flow.credentialRevokeTx,expiryIssueTx:flow.expiryIssueTx,
    issuerDeactivateTx:flow.issuerDeactivateTx,issuerReactivateTx:flow.issuerReactivateTx,
  };
  for(const [key,value] of Object.entries(txs))txHash(value,key);
  if(!flow.negativeUnauthorizedProfileTxRejected)fail('unauthorized profile mutation was not proven rejected');
  if(!flow.negativeUnauthorizedIssuerTxRejected)fail('unauthorized issuer mutation was not proven rejected');
  if(!flow.negativeUnauthorizedRevocationRejected)fail('unauthorized credential revocation was not proven rejected');
  if(lowerAddress(flow.finalProfileController,'final profile controller')!==recipient)fail('final profile controller mismatch');
  if(flow.finalProfileActive!==true)fail('final profile must be active');
  if(flow.rejectedCredentialValid!==false)fail('subject-rejected credential must be invalid');
  if(flow.revokedCredentialValid!==false)fail('revoked credential must be invalid');
  if(flow.expiryObservedInvalid!==true)fail('expired credential invalidity not observed');
  if(flow.issuerActiveAfterRecovery!==true)fail('issuer must be reactivated after compromise/deactivation drill');
}

export function validateIdentityServiceEvidence420(flow:IdentityLifecycleEvidence420,services:IdentityServiceEvidence420,expectedChainId:string):void{
  const profile=flow.profileId.toLowerCase(),issuer=flow.issuerId.toLowerCase(),credential=flow.credentialId.toLowerCase();
  if(!services.wallet?.qualified)fail('Wallet Identity qualification missing');
  if(services.wallet.profileId.toLowerCase()!==profile)fail('Wallet profileId mismatch');
  if(lowerAddress(services.wallet.controller,'Wallet controller')!==lowerAddress(flow.finalProfileController,'final profile controller'))fail('Wallet controller disagrees with chain');
  if(services.wallet.rejectedCredentialValid!==false||services.wallet.revokedCredentialValid!==false)fail('Wallet credential validity disagreement');

  if(!services.indexer?.qualified)fail('Indexer Identity qualification missing');
  if(positiveDecimal(services.indexer.chainId,'Indexer chainId')!==positiveDecimal(expectedChainId,'expected chainId'))fail('Indexer chain ID disagrees with live chain');
  if(services.indexer.protocol!=='420Identity')fail('Indexer protocol mismatch');
  if(services.indexer.profileObjectKey!=='profileId:'+profile)fail('Indexer profile object key mismatch');
  if(services.indexer.issuerObjectKey!=='issuerId:'+issuer)fail('Indexer issuer object key mismatch');
  if(services.indexer.credentialObjectKey!=='credentialId:'+credential)fail('Indexer credential object key mismatch');
  if(!['ProfileUpdated','ProfileControllerTransferred'].includes(services.indexer.latestProfileEvent))fail('Indexer latest profile event mismatch');
  if(services.indexer.latestIssuerEvent!=='IssuerSet')fail('Indexer latest issuer event mismatch');
  if(!['CredentialRevoked','CredentialRejected'].includes(services.indexer.latestCredentialEvent))fail('Indexer latest credential event mismatch');
  positiveDecimal(services.indexer.latestBlockNumber,'Indexer latest block');

  if(!services.search?.qualified)fail('Search Identity qualification missing');
  if(services.search.profileId.toLowerCase()!==profile)fail('Search profileId mismatch');
  if(!services.search.active)fail('Search final active profile missing');
  if(lowerAddress(services.search.controller,'Search controller')!==lowerAddress(flow.finalProfileController,'final profile controller'))fail('Search controller disagreement');
  if(!services.search.source.includes('420Identity'))fail('Search provenance must identify 420Identity');
  if(services.search.privatePayloadExposed)fail('Search exposed private Identity payload');

  if(!services.explorer?.qualified)fail('Explorer Identity qualification missing');
  if(lowerAddress(services.explorer.identityAddress,'Explorer Identity address')!==IDENTITY_ADDRESS_420)fail('Explorer Identity address mismatch');
  txHash(services.explorer.transactionHash,'Explorer transaction hash');
  positiveDecimal(services.explorer.blockNumber,'Explorer block number');
  if(services.explorer.canonicalAuthority)fail('Explorer must remain non-authoritative');
}

export function validateIdentityRecoveryEvidence420(recovery:IdentityRecoveryEvidence420):void{
  if(!recovery.restart?.qualified)fail('Indexer restart qualification missing');
  positiveDecimal(recovery.restart.checkpointBefore,'restart checkpointBefore');
  positiveDecimal(recovery.restart.checkpointAfter,'restart checkpointAfter');
  if(!Number.isSafeInteger(recovery.restart.replayGap)||recovery.restart.replayGap<0)fail('restart replay gap invalid');
  if(!recovery.restart.repeatRestartProcessedZero)fail('repeated restart was not idempotent');

  if(!recovery.reorg?.qualified)fail('Indexer reorg qualification missing');
  if(!Number.isSafeInteger(recovery.reorg.recoveredDepth)||recovery.reorg.recoveredDepth<=0)fail('bounded reorg recovery depth missing');
  positiveDecimal(recovery.reorg.finalCheckpoint,'reorg final checkpoint');
  if(!recovery.reorg.deepReorgRejectedWithoutMutation)fail('deep reorg fail-closed/no-mutation evidence missing');

  const dep=recovery.dependencyFailure;
  if(!dep?.qualified)fail('dependency-failure qualification missing');
  if(!dep.wrongChainRejected)fail('wrong-chain dependency was not rejected');
  if(!dep.staleIndexerRejected)fail('stale Indexer dependency was not rejected');
  if(!dep.searchUnavailableFailsClosed)fail('Search dependency failure did not fail closed');
  if(!dep.explorerUnavailableNonAuthoritative)fail('Explorer outage authority boundary not proven');
  if(!dep.walletWrongChainRejected)fail('Wallet wrong-chain dependency was not rejected');
}

export function validateIdentityLiveTestnetEvidence420(
  manifest:IdentityOfficialManifest420,
  evidence:IdentityLiveTestnetEvidence420,
  expectedRepositorySha?:string,
):IdentityLiveTestnetEvidence420{
  if(evidence.schema!==IDENTITY_TESTNET_SCHEMA_420||evidence.phase!=='ID-AUDIT-9'||evidence.status!=='PASS')fail('unsupported Identity live-testnet evidence identity');
  if(!/^[0-9a-f]{40}$/i.test(evidence.repositorySha))fail('evidence repository SHA invalid');
  if(expectedRepositorySha&&evidence.repositorySha.toLowerCase()!==expectedRepositorySha.toLowerCase())fail('evidence repository SHA mismatch');
  if(!evidence.manifestPath||evidence.manifestPath.includes('local.example'))fail('evidence must reference official testnet manifest');
  validateIdentityReadEvidence420(manifest,evidence.read);
  validateIdentityLifecycleEvidence420(evidence.lifecycle);
  validateIdentityServiceEvidence420(evidence.lifecycle,evidence.services,evidence.read.chainId);
  validateIdentityRecoveryEvidence420(evidence.recovery);
  return structuredClone(evidence);
}

export const IdentityReadInterfaces420=Object.freeze({
  identity:new Interface([
    'function systemName() view returns (string)',
    'function protocolVersion() view returns (uint32)',
    'function governanceTimelock() view returns (address)',
    'function profiles(bytes32) view returns (address controller,address pendingController,bytes32 metadataHash,bytes32 primaryName,uint64 createdAt,uint64 updatedAt,bool active)',
    'function issuers(bytes32) view returns (address controller,bytes32 metadataHash,uint8 trustClass,bool active)',
    'function credentials(bytes32) view returns (bytes32 issuerId,bytes32 subjectProfileId,bytes32 credentialType,bytes32 claimHash,uint64 issuedAt,uint64 expiresAt,uint64 revokedAt,bool subjectRejected)',
    'function credentialValid(bytes32) view returns (bool)',
  ]),
});

export function identityRuntimeHash420(code:string):string{
  if(!/^0x(?:[0-9a-fA-F]{2})+$/.test(code)||/^0x0*$/i.test(code))fail('deployed runtime bytecode missing or malformed');
  return keccak256(getBytes(code));
}
