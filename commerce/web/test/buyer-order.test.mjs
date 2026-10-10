import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import {submitReviewedMarketOrder} from '../buyer-order.js';
const orderABI=new Interface(['function getOrder(bytes32) view returns(tuple(bytes32 listingId,uint32 listingRevision,address buyer,address seller,uint256 quantity,address paymentAsset,uint256 totalAmount,bytes32 settlementAdapterId,bytes32 paymentRef,bytes32 fulfillmentHash,bytes32 disputeHash,uint8 status,uint64 createdAt,uint64 updatedAt))']);
const listingABI=new Interface(['function getListing(bytes32) view returns(tuple(address seller,bytes32 sellerProfileId,bytes32 itemClass,bytes32 assetRef,bytes32 metadataHash,bytes32 policyId,bytes32 saleMechanism,bytes32 settlementAdapterId,address quoteAsset,uint256 unitPrice,uint256 quantity,uint64 expiresAt,uint32 revision,bool active))']);
const inventoryABI=new Interface(['function available(bytes32) view returns(uint256)']);
const zero='0x'+'0'.repeat(64),id='0x'+'a'.repeat(64),listingId='0x'+'b'.repeat(64),buyer='0x'+'1'.repeat(40),seller='0x'+'2'.repeat(40),asset='0x'+'3'.repeat(40),orderAddress='0x'+'4'.repeat(40),listingAddress='0x'+'5'.repeat(40),inventoryAddress='0x'+'6'.repeat(40);
const plan={orderId:id,state:'ORDER_SIGNATURE_REQUIRED',paymentAllowed:false,reserved:false,expiresAt:40000,intent:{chainId:'420',target:orderAddress,method:'createOrder',requiresWalletAuthorization:true,canonicalAuthority:false,args:[id,listingId,2,'3',asset,'126']}};
function session({available=10n,revision=2,chain='0x1a4',account=buyer,simulation=true}={}){
 const calls=[];
 const row=[zero,0,buyer,seller,0,asset,0,zero,zero,zero,zero,0,0,0];
 const list=[seller,zero,zero,zero,zero,zero,zero,zero,asset,42n,10n,0,revision,true];
 const provider={request:async ({method,params=[]})=>{
   calls.push(method);
   if(method==='eth_chainId')return chain;
   if(method==='eth_accounts')return [account];
   if(method==='eth_sendTransaction')return '0x'+'f'.repeat(64);
   if(method!=='eth_call')throw Error('unexpected_method');
   const tx=params[0];
   if(tx.data.startsWith('0x'+orderABI.getFunction('getOrder').selector.slice(2)))return orderABI.encodeFunctionResult('getOrder',[row]);
   if(tx.data.startsWith('0x'+listingABI.getFunction('getListing').selector.slice(2)))return listingABI.encodeFunctionResult('getListing',[list]);
   if(tx.data.startsWith('0x'+inventoryABI.getFunction('available').selector.slice(2)))return inventoryABI.encodeFunctionResult('available',[available]);
   if(!simulation)throw Error('simulation_failed');
   return '0x';
 }};
 const s={address:buyer,epoch:0,pending:false,provider,config:{chainId:'420',contracts:{OrderRegistry420:{address:orderAddress,verified:true},ListingRegistry420:{address:listingAddress},InventoryReservation420:{address:inventoryAddress}}},verify:async()=>({epoch:0,address:buyer,tag:{blockHash:zero,requireCanonical:true}})};
 return {s,calls};
}
test('verified explicit Market order broadcasts without pretending reservation or payment',async()=>{
 const {s,calls}=session();const outcome=await submitReviewedMarketOrder(s,plan,{now:()=>1000});
 assert.equal(outcome.paid,false);assert.equal(outcome.reserved,false);assert.equal(outcome.status,'BROADCAST_NOT_FINAL');
 assert.equal(calls.filter(c=>c==='eth_sendTransaction').length,1);assert.equal(s.pending,false);
});
test('revised listing, insufficient stock, wrong chain and simulation rejection never send',async()=>{
 for(const input of [{revision:3},{available:2n},{chain:'0x1'},{simulation:false}]){
  const {s,calls}=session(input);await assert.rejects(()=>submitReviewedMarketOrder(s,plan,{now:()=>1000}));
  assert.equal(calls.includes('eth_sendTransaction'),false);assert.equal(s.pending,false);
 }
});
test('expired or payable plan and locked wallet fail before signing',async()=>{
 for(const change of [{expiresAt:1},{paymentAllowed:true},{reserved:true}]){
  const {s,calls}=session();await assert.rejects(()=>submitReviewedMarketOrder(s,{...plan,...change},{now:()=>1000}));
  assert.equal(calls.includes('eth_sendTransaction'),false);
 }
 const {s}=session();s.pending=true;await assert.rejects(()=>submitReviewedMarketOrder(s,plan,{now:()=>1000}));
});
