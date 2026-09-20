import { buildBridgeOutboundTransaction } from './execution.js';
import { preflightExchangeTransaction } from './preflight.js';
import { WalletSession, normalizeChainId } from './wallet-session.js';
import { submitPreflightedTransaction } from './wallet-execution.js';
import { inspectTransactionLifecycle } from './transaction-lifecycle.js';
import { bytes32Word, dynamicBytes, functionSelector, keccak256 } from './abi.js';

const OUTBOUND_TOPIC=keccak256('OutboundInitiated(bytes32,bytes32,bytes32)');
const INBOUND_TOPIC=keccak256('InboundAccepted(bytes32,bytes32)');
const HEX32=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
export class BridgeQualificationError extends Error {
  constructor(code,message,details={}) { super(message); this.name='BridgeQualificationError'; this.code=code; this.details=details; }
}
function requireHex(value, pattern, label) {
  if(typeof value!=='string'||!pattern.test(value)) throw new BridgeQualificationError('INVALID_INPUT',`invalid ${label}`);
  return value.toLowerCase();
}
function exactBigInt(value,label) {
  if(typeof value!=='string'||!/^\d+$/.test(value)||BigInt(value)<=0n) throw new BridgeQualificationError('INVALID_INPUT',`invalid ${label}`);
  return BigInt(value);
}
function eventFromReceipt(receipt,topic,contract,label) {
  const logs=(receipt?.logs??[]).filter(log=>String(log.address??'').toLowerCase()===contract.toLowerCase() && String(log.topics?.[0]??'').toLowerCase()===topic);
  if(logs.length!==1) throw new BridgeQualificationError('EVENT_EVIDENCE_MISSING',`expected exactly one ${label} event`,{count:logs.length});
  return logs[0];
}
function parseOutbound(receipt,router,routeId,adapterId) {
  const log=eventFromReceipt(receipt,OUTBOUND_TOPIC,router,'OutboundInitiated');
  if(String(log.topics?.[1]??'').toLowerCase()!==routeId || String(log.topics?.[2]??'').toLowerCase()!==adapterId || !HEX32.test(log.data??'')) throw new BridgeQualificationError('OUTBOUND_EVENT_MISMATCH','outbound event does not match reviewed route and adapter');
  const messageId=log.data.toLowerCase();
  if(/^0x0{64}$/.test(messageId)) throw new BridgeQualificationError('INVALID_MESSAGE','outbound message ID is zero');
  return messageId;
}
function parseInbound(receipt,router,adapterId) {
  const log=eventFromReceipt(receipt,INBOUND_TOPIC,router,'InboundAccepted');
  if(String(log.topics?.[2]??'').toLowerCase()!==adapterId || !HEX32.test(log.topics?.[1]??'')) throw new BridgeQualificationError('INBOUND_EVENT_MISMATCH','inbound adapter or transfer ID mismatch');
  return log.topics[1].toLowerCase();
}
async function finalized(provider,txHash,{maxAttempts=60,sleep=async()=>{},pollMs=5000}={}) {
  if(!Number.isInteger(maxAttempts)||maxAttempts<1) throw new BridgeQualificationError('INVALID_POLICY','maxAttempts must be positive');
  for(let i=0;i<maxAttempts;i++) {
    const observation=await inspectTransactionLifecycle({provider,txHash,minConfirmations:2});
    if(['REVERTED','REORGED'].includes(observation.state)) throw new BridgeQualificationError('TRANSACTION_FAILED',`transaction ${observation.state}`,{txHash});
    if(observation.state==='FINALIZED') return observation;
    if(i<maxAttempts-1) await sleep(pollMs);
  }
  throw new BridgeQualificationError('FINALITY_TIMEOUT','transaction did not reach finalized state',{txHash});
}
async function accountSession(provider,expectedChainId) {
  const account=requireHex((await provider.request({method:'eth_accounts'}))?.[0],ADDRESS,'provider account');
  if(normalizeChainId(await provider.request({method:'eth_chainId'}))!==normalizeChainId(expectedChainId)) throw new BridgeQualificationError('CHAIN_MISMATCH','provider is on wrong chain');
  const session=new WalletSession(); session.connected({account,chainId:expectedChainId});
  return {account,session};
}
function ensureResolved(runtime,label) {
  if(runtime?.deployment?.status!=='RESOLVED'||runtime.deployment.environment!=='testnet') throw new BridgeQualificationError('DEPLOYMENT_UNRESOLVED',`resolved ${label} testnet runtime required`);
  requireHex(runtime.contracts?.GatewayRouter420,ADDRESS,`${label} gateway`);
}
function encodeAcceptInbound(adapterId,proof) {
  if(typeof proof!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(proof)) throw new BridgeQualificationError('PROOF_REQUIRED','nonempty adapter proof bytes required');
  return functionSelector('acceptInbound(bytes32,bytes)')+bytes32Word(adapterId)+(64n).toString(16).padStart(64,'0')+dynamicBytes(proof);
}
export async function qualifyLiveTestnetBridge({
  sourceProvider,destinationProvider,sourceRuntime,destinationRuntime,reviewedIntent,execution,
  sourceFreshness,sourceAuthorizationChecks=[],sourceAllowanceChecks=[],sourceStaticCalls=[],
  proofProvider,destinationAdapterId,expectedTransferId=null,maxAttempts=60,sleep,pollMs=5000,
}={}) {
  ensureResolved(sourceRuntime,'source'); ensureResolved(destinationRuntime,'destination');
  if(normalizeChainId(sourceRuntime.network.chainId)===normalizeChainId(destinationRuntime.network.chainId)) throw new BridgeQualificationError('SAME_CHAIN','source and destination chains must differ');
  if(typeof proofProvider!=='function') throw new BridgeQualificationError('PROOF_PROVIDER_REQUIRED','external source-bound proof provider required');
  if(!Array.isArray(sourceAuthorizationChecks)||sourceAuthorizationChecks.length===0) throw new BridgeQualificationError('AUTHORIZATION_REQUIRED','explicit source authorization required');
  const adapterId=requireHex(execution?.adapterId,HEX32,'outbound adapter ID');
  const routeId=requireHex(execution?.routeId,HEX32,'outbound route ID');
  requireHex(destinationAdapterId,HEX32,'destination adapter ID');
  if(expectedTransferId!==null) requireHex(expectedTransferId,HEX32,'expected destination transfer ID');
  const source=await accountSession(sourceProvider,sourceRuntime.network.chainId);
  if(!sourceAuthorizationChecks.some(c=>String(c.principal??'').toLowerCase()===source.account&&c.action==='BRIDGE_WITHDRAW'&&String(c.subjectId??'').toLowerCase()===String(execution.assetId).toLowerCase()&&BigInt(c.amountRaw)===exactBigInt(execution.amountRaw,'outbound amount'))) throw new BridgeQualificationError('AUTHORIZATION_MISMATCH','authorization must match source account, asset and amount');
  for(const c of sourceAllowanceChecks) if(String(c.owner??'').toLowerCase()!==source.account) throw new BridgeQualificationError('ALLOWANCE_MISMATCH','allowance owner differs from live source account');
  const transaction=buildBridgeOutboundTransaction({runtime:sourceRuntime,account:source.account,reviewedIntent,execution});
  const preflight=await preflightExchangeTransaction({provider:sourceProvider,transaction,runtime:sourceRuntime,freshness:sourceFreshness,authorizationChecks:sourceAuthorizationChecks,allowanceChecks:sourceAllowanceChecks,staticCalls:sourceStaticCalls});
  const submitted=await submitPreflightedTransaction({provider:sourceProvider,session:source.session,expectedChainId:sourceRuntime.network.chainId,expectedGeneration:source.session.generation,transaction,preflight});
  const sourceFinality=await finalized(sourceProvider,submitted.txHash,{maxAttempts,sleep,pollMs});
  const sourceMessageId=parseOutbound(sourceFinality.receipt.raw,sourceRuntime.contracts.GatewayRouter420,routeId,adapterId);
  const destination=await accountSession(destinationProvider,destinationRuntime.network.chainId);
  const proofResult=await proofProvider({sourceChainId:normalizeChainId(sourceRuntime.network.chainId),sourceTxHash:submitted.txHash,sourceMessageId,sourceBlockHash:sourceFinality.receipt.blockHash,destinationChainId:normalizeChainId(destinationRuntime.network.chainId),destinationAdapterId:destinationAdapterId.toLowerCase()});
  if(proofResult?.sourceTxHash?.toLowerCase()!==submitted.txHash||proofResult?.sourceMessageId?.toLowerCase()!==sourceMessageId||proofResult?.destinationAdapterId?.toLowerCase()!==destinationAdapterId.toLowerCase()) throw new BridgeQualificationError('PROOF_BINDING_MISMATCH','proof metadata does not bind source message and destination adapter');
  const inbound={kind:'BRIDGE',chainId:destinationRuntime.network.chainId,request:{from:destination.account,to:destinationRuntime.contracts.GatewayRouter420,data:encodeAcceptInbound(destinationAdapterId,proofResult.proof),value:'0x0'}};
  const inboundPreflight=await preflightExchangeTransaction({provider:destinationProvider,transaction:inbound,runtime:destinationRuntime});
  const inboundSubmission=await submitPreflightedTransaction({provider:destinationProvider,session:destination.session,expectedChainId:destinationRuntime.network.chainId,expectedGeneration:destination.session.generation,transaction:inbound,preflight:inboundPreflight});
  const destinationFinality=await finalized(destinationProvider,inboundSubmission.txHash,{maxAttempts,sleep,pollMs});
  const transferId=parseInbound(destinationFinality.receipt.raw,destinationRuntime.contracts.GatewayRouter420,destinationAdapterId.toLowerCase());
  if(expectedTransferId!==null&&transferId!==expectedTransferId.toLowerCase()) throw new BridgeQualificationError('TRANSFER_ID_MISMATCH','destination transfer ID differs from canonical expected transfer');
  return Object.freeze({qualified:true,sourceChainId:normalizeChainId(sourceRuntime.network.chainId),destinationChainId:normalizeChainId(destinationRuntime.network.chainId),sourceTxHash:submitted.txHash,sourceMessageId,sourceBlockHash:sourceFinality.receipt.blockHash,destinationTxHash:inboundSubmission.txHash,destinationBlockHash:destinationFinality.receipt.blockHash,destinationTransferId:transferId,sourceState:sourceFinality.state,destinationState:destinationFinality.state,sourceAccount:source.account,destinationAccount:destination.account});
}
