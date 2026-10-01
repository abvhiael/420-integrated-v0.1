import {addressWord,bytes32Word,keccak256,uintWord} from './abi.js';
import {normalizeChainId} from './wallet-session.js';

const HEX32=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;

export const BRIDGE_LIFECYCLE_STATES=Object.freeze([
  'DRAFT','SOURCE_READY','SOURCE_SUBMITTED','SOURCE_FINALIZED','PROOF_PENDING','PROOF_AVAILABLE','PROOF_VERIFIED',
  'DESTINATION_READY','DESTINATION_SUBMITTED','DESTINATION_FINALIZED','SETTLED',
  'PAUSED','EXPIRED','PROOF_INVALIDATED','SOURCE_REORGED','DESTINATION_REORGED','REFUND_PENDING','REFUNDED',
  'RETRYABLE','FAILED','INDEXER_DELAYED','INDEXER_CONFLICTING',
]);

export class BridgeLifecycleError extends Error{
  constructor(code,message,details={}){super(message);this.name='BridgeLifecycleError';this.code=code;this.details=Object.freeze({...details});}
}
const fail=(code,message,details={})=>{throw new BridgeLifecycleError(code,message,details);};
function id(value,label){if(typeof value!=='string'||!HEX32.test(value))fail('INVALID_ID',`invalid ${label}`);return value.toLowerCase();}
function account(value,label){if(typeof value!=='string'||!ADDRESS.test(value)||/^0x0{40}$/i.test(value))fail('INVALID_ADDRESS',`invalid ${label}`);return value.toLowerCase();}
function raw(value,label){if(typeof value!=='string'||!/^[1-9][0-9]*$/.test(value))fail('INVALID_AMOUNT',`invalid ${label}`);return BigInt(value).toString();}
function chain(value,label){try{return normalizeChainId(value);}catch{fail('INVALID_CHAIN',`invalid ${label}`);}}
function exact(a,b){return typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();}

export function canonicalBridgeManifest(input={}){
  const sourceChainId=chain(input.sourceChainId,'source chain'),destinationChainId=chain(input.destinationChainId,'destination chain');
  if(sourceChainId===destinationChainId)fail('SAME_CHAIN','bridge chains must differ');
  const manifest=Object.freeze({
    schema:'420-exchange-bridge-manifest-v1',
    routeId:id(input.routeId,'routeId'),
    sourceAdapterId:id(input.sourceAdapterId??input.adapterId,'source adapterId'),
    destinationAdapterId:id(input.destinationAdapterId,'destination adapterId'),
    verifierId:id(input.verifierId,'verifierId'),
    verifierConfigHash:id(input.verifierConfigHash,'verifierConfigHash'),
    manifestId:id(input.manifestId,'manifestId'),
    sourceChainId,destinationChainId,
    sourceAssetId:id(input.sourceAssetId,'sourceAssetId'),
    destinationAssetId:id(input.destinationAssetId,'destinationAssetId'),
    canonicalAssetId:id(input.canonicalAssetId,'canonicalAssetId'),
    sourceGateway:account(input.sourceGateway,'sourceGateway'),
    destinationGateway:account(input.destinationGateway,'destinationGateway'),
    version:Number(input.version),
  });
  if(!Number.isSafeInteger(manifest.version)||manifest.version<1)fail('INVALID_MANIFEST','manifest version must be positive');
  return manifest;
}
export function bridgeManifestFingerprint(manifest){
  const m=canonicalBridgeManifest(manifest);
  const encoded='0x'+[
    bytes32Word(m.routeId),bytes32Word(m.sourceAdapterId),bytes32Word(m.destinationAdapterId),bytes32Word(m.verifierId),
    bytes32Word(m.verifierConfigHash),bytes32Word(m.manifestId),uintWord(BigInt(m.sourceChainId)),uintWord(BigInt(m.destinationChainId)),
    bytes32Word(m.sourceAssetId),bytes32Word(m.destinationAssetId),bytes32Word(m.canonicalAssetId),
    addressWord(m.sourceGateway),addressWord(m.destinationGateway),uintWord(m.version),
  ].join('');
  return keccak256(encoded);
}
export function canonicalBridgeTransfer(input={}){
  const manifest=canonicalBridgeManifest(input.manifest);
  const transfer=Object.freeze({
    schema:'420-exchange-bridge-transfer-v1',manifest,
    manifestFingerprint:bridgeManifestFingerprint(manifest),
    sender:account(input.sender,'sender'),beneficiary:account(input.beneficiary,'beneficiary'),
    amountRaw:raw(input.amountRaw,'amountRaw'),
    replayDomain:id(input.replayDomain,'replayDomain'),
    expiresAt:Number(input.expiresAt),
  });
  if(!Number.isSafeInteger(transfer.expiresAt)||transfer.expiresAt<=0)fail('INVALID_EXPIRY','valid expiry required');
  return transfer;
}
export function bridgeReplayKey(transfer,{sourceMessageId=null}={}){
  const t=canonicalBridgeTransfer(transfer);
  const msg=sourceMessageId===null?'0x'+'00'.repeat(32):id(sourceMessageId,'sourceMessageId');
  return keccak256('0x'+[
    bytes32Word(t.replayDomain),bytes32Word(t.manifestFingerprint),addressWord(t.sender),addressWord(t.beneficiary),
    uintWord(t.amountRaw),bytes32Word(msg),
  ].join(''));
}

export function createMemoryReplayGuard(){
  const consumed=new Set();
  return Object.freeze({
    async isConsumed(key){return consumed.has(id(key,'replay key'));},
    async consume(key){const k=id(key,'replay key');if(consumed.has(k))return false;consumed.add(k);return true;},
  });
}

export function createProofProviderAdapter(fetchProof){
  if(typeof fetchProof!=='function')fail('PROOF_PROVIDER_REQUIRED','proof provider function required');
  return Object.freeze({
    async request(binding){
      const result=await fetchProof(Object.freeze({...binding}));
      if(!result||typeof result!=='object')fail('PROOF_UNAVAILABLE','proof provider returned no proof');
      return Object.freeze({...result});
    },
  });
}
export function createProofVerifierAdapter(verifyProof){
  if(typeof verifyProof!=='function')fail('PROOF_VERIFIER_REQUIRED','proof verifier function required');
  return Object.freeze({
    async verify(input){
      const result=await verifyProof(Object.freeze({...input}));
      if(!result||typeof result!=='object'||result.valid!==true)fail('PROOF_VERIFICATION_FAILED',String(result?.reason??'proof verifier rejected proof'));
      return Object.freeze({...result});
    },
  });
}
export function createMemoryBridgeLifecycleStore(){
  const records=new Map();
  return Object.freeze({
    save(key,snapshot){records.set(id(key,'lifecycle key'),structuredClone(snapshot));return true;},
    load(key){const value=records.get(id(key,'lifecycle key'));return value?structuredClone(value):null;},
  });
}
export function validateBridgeProof({proof,transfer,sourceTxHash,sourceBlockHash,sourceMessageId}={}){
  const t=canonicalBridgeTransfer(transfer),m=t.manifest;
  if(!proof||proof.schema!=='420-exchange-bridge-proof-v1')fail('PROOF_INVALID','unsupported proof schema');
  const bound={
    sourceChainId:chain(proof.sourceChainId,'proof source chain'),destinationChainId:chain(proof.destinationChainId,'proof destination chain'),
    sourceTxHash:id(proof.sourceTxHash,'proof source tx'),sourceBlockHash:id(proof.sourceBlockHash,'proof source block'),
    sourceMessageId:id(proof.sourceMessageId,'proof source message'),routeId:id(proof.routeId,'proof route'),
    sourceAdapterId:id(proof.sourceAdapterId,'proof source adapter'),destinationAdapterId:id(proof.destinationAdapterId,'proof destination adapter'),
    verifierId:id(proof.verifierId,'proof verifier'),manifestFingerprint:id(proof.manifestFingerprint,'proof manifest fingerprint'),
    beneficiary:account(proof.beneficiary,'proof beneficiary'),amountRaw:raw(proof.amountRaw,'proof amount'),
    sourceAssetId:id(proof.sourceAssetId,'proof source asset'),destinationAssetId:id(proof.destinationAssetId,'proof destination asset'),
    replayDomain:id(proof.replayDomain,'proof replay domain'),
  };
  if(
    bound.sourceChainId!==m.sourceChainId||bound.destinationChainId!==m.destinationChainId||
    !exact(bound.sourceTxHash,sourceTxHash)||!exact(bound.sourceBlockHash,sourceBlockHash)||!exact(bound.sourceMessageId,sourceMessageId)||
    !exact(bound.routeId,m.routeId)||!exact(bound.sourceAdapterId,m.sourceAdapterId)||!exact(bound.destinationAdapterId,m.destinationAdapterId)||
    !exact(bound.verifierId,m.verifierId)||!exact(bound.manifestFingerprint,t.manifestFingerprint)||
    !exact(bound.beneficiary,t.beneficiary)||bound.amountRaw!==t.amountRaw||
    !exact(bound.sourceAssetId,m.sourceAssetId)||!exact(bound.destinationAssetId,m.destinationAssetId)||!exact(bound.replayDomain,t.replayDomain)
  ) fail('PROOF_BINDING_MISMATCH','proof does not bind the reviewed bridge transfer');
  if(typeof proof.proofBytes!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(proof.proofBytes))fail('PROOF_INVALID','nonempty proof bytes required');
  if(proof.invalidated===true)fail('PROOF_INVALIDATED','proof provider marked proof invalidated');
  return Object.freeze({...bound,proofBytes:proof.proofBytes.toLowerCase(),proofId:id(proof.proofId,'proofId')});
}

export function reconcileBridgeProjection({transfer,sourceTxHash=null,destinationTxHash=null,records=[]}={}){
  const t=canonicalBridgeTransfer(transfer);
  if(!Array.isArray(records))fail('INDEX_DATA_INVALID','bridge indexed records must be an array');
  const relevant=records.filter(r=>exact(r?.manifestFingerprint,t.manifestFingerprint)||exact(r?.replayDomain,t.replayDomain));
  const active=relevant.filter(r=>r.active!==false),orphaned=relevant.filter(r=>r.active===false);
  const conflicts=[];
  for(const r of active){
    if(r.beneficiary&& !exact(r.beneficiary,t.beneficiary))conflicts.push('beneficiary-conflict');
    if(r.amountRaw!==undefined&&String(r.amountRaw)!==t.amountRaw)conflicts.push('amount-conflict');
    if(r.routeId&&!exact(r.routeId,t.manifest.routeId))conflicts.push('route-conflict');
    if(r.destinationAssetId&&!exact(r.destinationAssetId,t.manifest.destinationAssetId))conflicts.push('destination-asset-conflict');
  }
  if(sourceTxHash&&orphaned.some(r=>exact(r.txHash,sourceTxHash)))conflicts.push('source-reorg');
  if(destinationTxHash&&orphaned.some(r=>exact(r.txHash,destinationTxHash)))conflicts.push('destination-reorg');
  return Object.freeze({
    status:conflicts.length?'CONFLICTING':active.length?'CANONICAL':'UNINDEXED',
    records:Object.freeze(relevant),activeRecords:Object.freeze(active),orphanedRecords:Object.freeze(orphaned),
    conflicts:Object.freeze([...new Set(conflicts)]),
  });
}

export class BridgeLifecycleController{
  constructor({transfer,proofProvider,proofVerifier,replayGuard=createMemoryReplayGuard(),projectionReader=null,stateStore=createMemoryBridgeLifecycleStore(),clock=()=>Math.floor(Date.now()/1000)}={}){
    this.transfer=canonicalBridgeTransfer(transfer);
    if(!proofProvider||typeof proofProvider.request!=='function')fail('PROOF_PROVIDER_REQUIRED','provider-neutral proof provider required');
    if(!proofVerifier||typeof proofVerifier.verify!=='function')fail('PROOF_VERIFIER_REQUIRED','provider-neutral proof verifier required');
    if(!replayGuard||typeof replayGuard.isConsumed!=='function'||typeof replayGuard.consume!=='function')fail('REPLAY_GUARD_REQUIRED','replay guard required');
    if(projectionReader!==null&&typeof projectionReader!=='function')fail('PROJECTION_READER_INVALID','projection reader must be a function');
    if(!stateStore||typeof stateStore.save!=='function'||typeof stateStore.load!=='function')fail('STATE_STORE_REQUIRED','bridge lifecycle state store required');
    this.proofProvider=proofProvider;this.proofVerifier=proofVerifier;this.replayGuard=replayGuard;this.projectionReader=projectionReader;this.stateStore=stateStore;this.clock=clock;
    this.lifecycleKey=keccak256('0x'+bytes32Word(this.transfer.manifestFingerprint)+bytes32Word(this.transfer.replayDomain)+addressWord(this.transfer.sender)+addressWord(this.transfer.beneficiary));
    this.state='DRAFT';this.history=[];this.source=null;this.proof=null;this.destination=null;this.settlement=null;
    this.persist();
  }
  persist(){this.stateStore.save(this.lifecycleKey,this.snapshot());return this.snapshot();}
  transition(state,details={}){if(!BRIDGE_LIFECYCLE_STATES.includes(state))fail('STATE_INVALID','invalid bridge lifecycle state');this.state=state;this.history.push(Object.freeze({state,...details}));return this.persist();}
  snapshot(){return Object.freeze({state:this.state,transfer:this.transfer,source:this.source,proof:this.proof,destination:this.destination,settlement:this.settlement,history:Object.freeze([...this.history])});}
  assertState(...states){if(!states.includes(this.state))fail('STATE_MISMATCH',`bridge state ${this.state} invalid for operation`);}
  assertNotExpired(){if(!Number.isSafeInteger(this.clock())||this.clock()>=this.transfer.expiresAt){this.transition('EXPIRED');fail('TRANSFER_EXPIRED','bridge transfer expired');}}
  prepareSource(){this.assertState('DRAFT','RETRYABLE');this.assertNotExpired();return this.transition('SOURCE_READY',{manifestFingerprint:this.transfer.manifestFingerprint});}
  sourceSubmitted({txHash}={}){this.assertState('SOURCE_READY');this.source=Object.freeze({txHash:id(txHash,'source tx')});return this.transition('SOURCE_SUBMITTED',{txHash:this.source.txHash});}
  sourceFinalized({txHash,blockHash,messageId}={}){
    this.assertState('SOURCE_SUBMITTED');this.assertNotExpired();
    if(!exact(txHash,this.source?.txHash))fail('SOURCE_TX_MISMATCH','finality tx differs from submitted source tx');
    this.source=Object.freeze({...this.source,blockHash:id(blockHash,'source block'),messageId:id(messageId,'source message'),finalized:true});
    return this.transition('SOURCE_FINALIZED',{messageId:this.source.messageId});
  }
  sourceReorged(){this.assertState('SOURCE_SUBMITTED','SOURCE_FINALIZED','PROOF_PENDING','PROOF_AVAILABLE','PROOF_VERIFIED','DESTINATION_READY');this.proof=null;this.transition('SOURCE_REORGED');return this.transition('RETRYABLE',{reason:'source-reorg'});}
  pause(reason='bridge-paused'){if(['SETTLED','REFUNDED','FAILED'].includes(this.state))fail('STATE_MISMATCH','terminal bridge cannot be paused');return this.transition('PAUSED',{reason});}
  resume(){this.assertState('PAUSED');this.assertNotExpired();return this.transition(this.source?.finalized?'SOURCE_FINALIZED':'SOURCE_READY',{resumed:true});}
  async requestProof(){
    this.assertState('SOURCE_FINALIZED','RETRYABLE');this.assertNotExpired();
    if(!this.source?.finalized)fail('SOURCE_FINALITY_REQUIRED','proof requires finalized source');
    this.transition('PROOF_PENDING');
    const m=this.transfer.manifest;
    const result=await this.proofProvider.request(Object.freeze({
      schema:'420-exchange-bridge-proof-request-v1',manifestFingerprint:this.transfer.manifestFingerprint,
      routeId:m.routeId,sourceAdapterId:m.sourceAdapterId,destinationAdapterId:m.destinationAdapterId,verifierId:m.verifierId,
      sourceChainId:m.sourceChainId,destinationChainId:m.destinationChainId,sourceTxHash:this.source.txHash,sourceBlockHash:this.source.blockHash,
      sourceMessageId:this.source.messageId,beneficiary:this.transfer.beneficiary,amountRaw:this.transfer.amountRaw,
      sourceAssetId:m.sourceAssetId,destinationAssetId:m.destinationAssetId,replayDomain:this.transfer.replayDomain,
    }));
    this.proof=validateBridgeProof({proof:result,transfer:this.transfer,sourceTxHash:this.source.txHash,sourceBlockHash:this.source.blockHash,sourceMessageId:this.source.messageId});
    return this.transition('PROOF_AVAILABLE',{proofId:this.proof.proofId});
  }
  async verifyProof(){
    this.assertState('PROOF_AVAILABLE');this.assertNotExpired();
    if(this.proof.invalidated===true){this.transition('PROOF_INVALIDATED');fail('PROOF_INVALIDATED','proof invalidated');}
    const verdict=await this.proofVerifier.verify(Object.freeze({
      schema:'420-exchange-bridge-proof-verification-v1',proof:this.proof,transfer:this.transfer,source:this.source,
      verifierId:this.transfer.manifest.verifierId,verifierConfigHash:this.transfer.manifest.verifierConfigHash,
      manifestFingerprint:this.transfer.manifestFingerprint,
    }));
    if(verdict.invalidated===true){this.transition('PROOF_INVALIDATED',{reason:'verifier-invalidated'});fail('PROOF_INVALIDATED','proof verifier invalidated proof');}
    return this.transition('PROOF_VERIFIED',{proofId:this.proof.proofId,verifierId:this.transfer.manifest.verifierId,verificationId:verdict.verificationId??null});
  }
  invalidateProof(reason='proof-invalidated'){this.assertState('PROOF_PENDING','PROOF_AVAILABLE','PROOF_VERIFIED','DESTINATION_READY');this.proof=null;return this.transition('PROOF_INVALIDATED',{reason});}
  async prepareDestination(){
    this.assertState('PROOF_VERIFIED');this.assertNotExpired();
    const key=bridgeReplayKey(this.transfer,{sourceMessageId:this.source.messageId});
    if(await this.replayGuard.isConsumed(key))fail('REPLAY','bridge replay domain/message already consumed');
    this.destination=Object.freeze({replayKey:key});
    return this.transition('DESTINATION_READY',{replayKey:key});
  }
  destinationSubmitted({txHash}={}){this.assertState('DESTINATION_READY');this.destination=Object.freeze({...this.destination,txHash:id(txHash,'destination tx')});return this.transition('DESTINATION_SUBMITTED',{txHash:this.destination.txHash});}
  destinationFinalized({txHash,blockHash,transferId}={}){
    this.assertState('DESTINATION_SUBMITTED');this.assertNotExpired();
    if(!exact(txHash,this.destination?.txHash))fail('DESTINATION_TX_MISMATCH','finality tx differs from destination submission');
    this.destination=Object.freeze({...this.destination,blockHash:id(blockHash,'destination block'),transferId:id(transferId,'destination transfer'),finalized:true});
    return this.transition('DESTINATION_FINALIZED',{transferId:this.destination.transferId});
  }
  destinationReorged(){this.assertState('DESTINATION_SUBMITTED','DESTINATION_FINALIZED','SETTLED');this.settlement=null;this.transition('DESTINATION_REORGED');return this.transition('RETRYABLE',{reason:'destination-reorg'});}
  async confirmSettlement({beneficiary,amountRaw,destinationAssetId,transferId,paid}={}){
    this.assertState('DESTINATION_FINALIZED');this.assertNotExpired();
    if(!exact(beneficiary,this.transfer.beneficiary)||String(amountRaw)!==this.transfer.amountRaw||!exact(destinationAssetId,this.transfer.manifest.destinationAssetId)||!exact(transferId,this.destination.transferId)||paid!==true)fail('SETTLEMENT_MISMATCH','destination payout differs from reviewed beneficiary/asset/amount');
    if(!(await this.replayGuard.consume(this.destination.replayKey)))fail('REPLAY','bridge replay already consumed');
    this.settlement=Object.freeze({beneficiary:account(beneficiary,'beneficiary'),amountRaw:this.transfer.amountRaw,destinationAssetId:id(destinationAssetId,'destinationAssetId'),transferId:id(transferId,'transferId'),paid:true});
    return this.transition('SETTLED',{beneficiary:this.settlement.beneficiary,amountRaw:this.settlement.amountRaw});
  }
  refundPending(reason='recovery'){if(['SETTLED','REFUNDED'].includes(this.state))fail('STATE_MISMATCH','settled/refunded transfer cannot enter refund');return this.transition('REFUND_PENDING',{reason});}
  refunded({refundId}={}){this.assertState('REFUND_PENDING');return this.transition('REFUNDED',{refundId:id(refundId,'refundId')});}
  retry(reason='retryable'){if(['SETTLED','REFUNDED'].includes(this.state))fail('STATE_MISMATCH','terminal transfer cannot retry');return this.transition('RETRYABLE',{reason});}
  async reconcile(){
    if(!this.projectionReader)return Object.freeze({status:'UNAVAILABLE',conflicts:Object.freeze([]),records:Object.freeze([])});
    const records=await this.projectionReader({transfer:this.transfer,source:this.source,destination:this.destination});
    const result=reconcileBridgeProjection({transfer:this.transfer,sourceTxHash:this.source?.txHash??null,destinationTxHash:this.destination?.txHash??null,records});
    if(result.status==='CONFLICTING')this.transition('INDEXER_CONFLICTING',{conflicts:result.conflicts});
    else if(result.status==='UNINDEXED'&&['SOURCE_FINALIZED','DESTINATION_FINALIZED','SETTLED'].includes(this.state))this.transition('INDEXER_DELAYED');
    return result;
  }
}
