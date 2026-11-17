export interface BridgeProvider420 { request(input:{method:string;params?:readonly unknown[]}):Promise<unknown>; }
export interface BridgeReviewInput420 { routeId:string;exchangeAssetId?:string|null;amountRaw:string;recipientBytes:string;feeValueWei?:string;extra?:string;validForMs?:number; }
export interface BridgeReview420 { readonly routeId:string;readonly assetId:string;readonly amountRaw:string;readonly recipientBytes:string;readonly sourceNetworkId:string;readonly destinationNetworkId:string;readonly expiresAt:number;readonly transaction:Readonly<{chainId:string;from:string;to:string;data:string;value:string}>;readonly risk:Readonly<{remainingRaw:string;estimateOnly:true}>; }
export interface BridgeTransfer420 {readonly transferId:string;readonly status:number;readonly finalized:boolean;readonly blockHash:string;readonly amountRaw:string;}
export interface BridgeClient420 {
 connect():Promise<string>;switchChain():Promise<string>;snapshot(routeId:string,exchangeAssetId?:string|null):Promise<Readonly<Record<string,unknown>>>;
 review(input:BridgeReviewInput420):Promise<BridgeReview420>;
 submit(review:BridgeReview420,confirm:(review:BridgeReview420)=>Promise<boolean>):Promise<string>;
 transfer(transferId:string):Promise<BridgeTransfer420>;
}
export function createBridgeClient420(input:{provider:BridgeProvider420;chainId:string;registry:string;registryCodeHash:string;exchangeQualification?:string|null;exchangeQualificationCodeHash?:string|null;clock?:()=>number}):BridgeClient420;
