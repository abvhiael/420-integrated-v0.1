import { id } from 'ethers';
import type { Hex } from './chain-source.js';
import { ProtocolDecoderRegistry420, type ProtocolEventDescriptor420, type ProtocolFieldKind420 } from './protocol-decoder.js';
const EVENTS = [
 ['TransferCreated', [['transferId','bytes32',true],['routeId','bytes32',true],['assetId','bytes32',true],['amount','uint256',false]]],
 ['OutboundTransferCreated', [['transferId','bytes32',true],['routeId','bytes32',true],['assetId','bytes32',true],['sender','address',false],['recipientHash','bytes32',false],['sourceMessageId','bytes32',false],['amount','uint256',false]]],
 ['SourceTransactionBound', [['transferId','bytes32',true],['sourceTxId','bytes32',true],['evidenceHash','bytes32',false]]],
 ['TransferStatus', [['transferId','bytes32',true],['status','uint8',false]]],
 ['TransferTransition', [['transferId','bytes32',true],['fromStatus','uint8',true],['toStatus','uint8',true],['evidenceHash','bytes32',false],['actor','address',false]]]
] as const;
/** Address must be resolved through the qualified ProtocolRegistry at the indexed deployment. */
export function bridgeTransferDescriptors420(address: Hex): ProtocolEventDescriptor420[] {
 if (!/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/i.test(address)) throw new Error('invalid BridgeTransferRegistry address');
 return EVENTS.map(([eventName, inputs]) => ({protocol:'420Bridge',eventName,contractAddress:address.toLowerCase() as Hex,
 topic0:id(`${eventName}(${inputs.map(input => input[1]).join(',')})`) as Hex,
 fields:inputs.map(([name,kind,indexed]) => ({name,kind:kind as ProtocolFieldKind420,indexed}))}));
}
export function bridgeTransferDecoder420(address: Hex): ProtocolDecoderRegistry420 {
 return new ProtocolDecoderRegistry420(bridgeTransferDescriptors420(address));
}

import { keccak256, Interface } from 'ethers';
import type { ChainSource420 } from './chain-source.js';
import type { IndexerEventEnvelope420 } from './event-stream.js';
import { BRIDGE_STATUS_420 } from './lifecycle-reducer.js';
const REGISTRY_ABI = new Interface(['function resolve(bytes32) view returns(address)','function runtimeCodeHash(bytes32) view returns(bytes32)']);
const TRANSFER_COMPONENT = id('420/APP/420BRIDGE/TRANSFER_REGISTRY');
/** Authenticate historical lifecycle evidence directly; projections and provider
 * labels cannot self-qualify a settlement notification. Errors preserve cursor.
 */
export async function qualifyBridgeNotification420(source: ChainSource420,event: IndexerEventEnvelope420,
 pin:{registry:Hex;registryRuntimeHash:Hex}):Promise<boolean>{
 if(event.protocol!=='420Bridge'||event.authoritative!==false||event.source!=='protocol'||event.streamVersion!=='v1'||!source.finalizedBlockNumber)return false;
 if(event.topic!==`420Bridge.${event.eventName}`)return false;
 const p=event.provenance;
 const eventId=['420evt','v1',p.chainId,p.blockHash.toLowerCase(),p.transactionHash.toLowerCase(),String(p.logIndex)].map((v,i)=>i>1&&i<5?encodeURIComponent(v):v).join(':');
 if(event.id!==eventId)return false;
 if((await source.chainId()).toString()!==p.chainId)return false;
 const n=BigInt(p.blockNumber);
 if(n>await source.finalizedBlockNumber())return false;
 const block=await source.getBlockByNumber(n);
 if(!block||block.hash.toLowerCase()!==p.blockHash.toLowerCase())return false;
 const registryCode=await source.getCode(pin.registry,n);
 if(registryCode==='0x'||keccak256(registryCode)!==pin.registryRuntimeHash.toLowerCase())return false;
 const resolved=await source.call({to:pin.registry,data:REGISTRY_ABI.encodeFunctionData('resolve',[TRANSFER_COMPONENT]) as Hex},n);
 const address=String(REGISTRY_ABI.decodeFunctionResult('resolve',resolved)[0]).toLowerCase() as Hex;
 const runtime=await source.call({to:pin.registry,data:REGISTRY_ABI.encodeFunctionData('runtimeCodeHash',[TRANSFER_COMPONENT]) as Hex},n);
 const transferCode=await source.getCode(address,n);
 if(transferCode==='0x'||keccak256(transferCode)!==String(REGISTRY_ABI.decodeFunctionResult('runtimeCodeHash',runtime)[0]).toLowerCase())return false;
 if(address!==p.contractAddress.toLowerCase())return false;
 const receipt=await source.getTransactionReceipt(p.transactionHash as Hex);
 if(!receipt||receipt.status!==1||receipt.blockHash.toLowerCase()!==p.blockHash.toLowerCase()||receipt.blockNumber!==n)return false;
 const log=receipt.logs.find(l=>l.logIndex===p.logIndex&&l.transactionIndex===p.transactionIndex&&l.transactionHash.toLowerCase()===p.transactionHash.toLowerCase()&&l.blockHash.toLowerCase()===p.blockHash.toLowerCase()&&!l.removed);
 if(!log)return false;
 const decoded=bridgeTransferDecoder420(address).decode(log);
 if(!decoded||decoded.eventName!==event.eventName)return false;
 const actual=Object.fromEntries(Object.entries(decoded.fields).map(([k,v])=>[k,typeof v==='bigint'?v.toString():v]));
 const canonical=(v:Record<string,unknown>)=>JSON.stringify(Object.keys(v).sort().map(k=>[k,v[k]]));
 if(canonical(actual)!==canonical(event.fields))return false;
 const transferId=decoded.fields.transferId;
 if(event.objectKey!==`transferId:${transferId}`)return false;
 const status=decoded.eventName==='TransferStatus'?decoded.fields.status:decoded.eventName==='TransferTransition'?decoded.fields.toStatus:undefined;
 const state=status===undefined?(decoded.eventName==='TransferCreated'||decoded.eventName==='OutboundTransferCreated'?'CREATED':null):BRIDGE_STATUS_420[String(status)];
 if(!state||state!==event.lifecycleState)return false;
 // Recheck canonicality after receipt/code reads to detect a concurrent reorg.
 return (await source.getBlockByNumber(n))?.hash.toLowerCase()===p.blockHash.toLowerCase();
}
