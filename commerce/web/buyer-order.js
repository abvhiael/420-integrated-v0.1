import {Interface} from 'ethers';
import {reviewedOrder} from './public-core.js';
const orderABI=new Interface(['function createOrder(bytes32,bytes32,uint32,uint256,address,uint256)','function getOrder(bytes32) view returns(tuple(bytes32 listingId,uint32 listingRevision,address buyer,address seller,uint256 quantity,address paymentAsset,uint256 totalAmount,bytes32 settlementAdapterId,bytes32 paymentRef,bytes32 fulfillmentHash,bytes32 disputeHash,uint8 status,uint64 createdAt,uint64 updatedAt))']);
const listingABI=new Interface(['function getListing(bytes32) view returns(tuple(address seller,bytes32 sellerProfileId,bytes32 itemClass,bytes32 assetRef,bytes32 metadataHash,bytes32 policyId,bytes32 saleMechanism,bytes32 settlementAdapterId,address quoteAsset,uint256 unitPrice,uint256 quantity,uint64 expiresAt,uint32 revision,bool active))']);
const inventoryABI=new Interface(['function available(bytes32) view returns(uint256)']);
const fail=()=>{throw Error('Order changed, expired or no longer safe to sign');};
export async function submitReviewedMarketOrder(session,plan,{now=Date.now}={}){
 if(!session?.address||session.pending)fail();
 const cfg=session.config, contract=cfg.contracts.OrderRegistry420;
 const details=reviewedOrder(plan,cfg.chainId,now());
 if(!contract?.verified||details.target.toLowerCase()!==contract.address.toLowerCase())fail();
 const args=plan.intent.args;
 if(!/^0x[0-9a-f]{64}$/.test(String(args[1]))||!Number.isInteger(args[2])||args[2]<1||!/^0x[0-9a-f]{40}$/.test(String(args[4]))||BigInt(args[3])<=0n||BigInt(args[5])<=0n)fail();
 const encoded=orderABI.encodeFunctionData('createOrder',args);
 session.pending=true;
 try{
   const checked=await session.verify();
   const request=(method,params)=>session.provider.request({method,params});
   const call=async (address,data)=>request('eth_call',[{to:address,data},checked.tag]);
   const existing=orderABI.decodeFunctionResult('getOrder',await call(contract.address,orderABI.encodeFunctionData('getOrder',[plan.orderId])))[0];
   if(Number(existing.status)!==0)fail();
   const listing=listingABI.decodeFunctionResult('getListing',await call(cfg.contracts.ListingRegistry420.address,listingABI.encodeFunctionData('getListing',[args[1]])))[0];
   const availability=inventoryABI.decodeFunctionResult('available',await call(cfg.contracts.InventoryReservation420.address,inventoryABI.encodeFunctionData('available',[args[1]])))[0];
   if(!listing.active||Number(listing.revision)!==args[2]||listing.quoteAsset.toLowerCase()!==String(args[4]).toLowerCase()||BigInt(listing.unitPrice)*BigInt(args[3])!==BigInt(args[5])||BigInt(availability)<BigInt(args[3]))fail();
   const transaction={from:checked.address,to:contract.address,data:encoded,value:'0x0'};
   await request('eth_call',[transaction,checked.tag]).catch(()=>fail());
   if(checked.epoch!==session.epoch||now()>=plan.expiresAt||checked.address!==session.address)fail();
   if(BigInt(await request('eth_chainId',[]))!==BigInt(cfg.chainId)||(await request('eth_accounts',[]))[0]?.toLowerCase()!==checked.address)fail();
   const hash=await request('eth_sendTransaction',[transaction]);
   if(checked.epoch!==session.epoch||!/^0x[0-9a-f]{64}$/.test(hash))fail();
   return {transactionHash:hash,status:'BROADCAST_NOT_FINAL',paid:false,reserved:false,orderId:plan.orderId};
 }finally{session.pending=false}
}
