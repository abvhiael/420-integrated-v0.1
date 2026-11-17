import type { Sdk420 } from './index.js';
import { createBridgeClient420, type BridgeProvider420, type BridgeClient420 } from './bridge-runtime.js';
export type { BridgeProvider420, BridgeReview420, BridgeReviewInput420, BridgeTransfer420, BridgeClient420 } from './bridge-runtime.js';
/** Uses the identical executable Wallet/Exchange bridge runtime. Registry code
 * pins are trusted release inputs; discovery catalogue flags alone cannot pin code.
 */
export function createBridgeSdk420(input:{sdk:Sdk420;provider:BridgeProvider420;registryCodeHash:string;exchangeQualificationCodeHash?:string;clock?:()=>number}):BridgeClient420 {
 const {sdk}=input;
 const registry=sdk.contract('ProtocolRegistry');
 if(!registry||registry.verified!==true||sdk.contracts.chainId!==sdk.network.chainId)throw new Error('canonical ProtocolRegistry and network required');
 const exchange=sdk.contract('ExchangeBridgeQualification420');
 if(input.exchangeQualificationCodeHash&&(!exchange||exchange.verified!==true))throw new Error('canonical Exchange bridge qualification required');
 return createBridgeClient420({provider:input.provider,chainId:'0x'+sdk.network.chainId.toString(16),registry:registry.address,registryCodeHash:input.registryCodeHash,
 exchangeQualification:input.exchangeQualificationCodeHash?exchange!.address:null,exchangeQualificationCodeHash:input.exchangeQualificationCodeHash??null,...(input.clock?{clock:input.clock}:{})});
}
