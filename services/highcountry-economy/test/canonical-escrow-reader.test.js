import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CanonicalEscrowReader} from '../src/canonical-escrow-reader.js';
const seller='0x'+'a'.repeat(40),buyer='0x'+'b'.repeat(40),escrow='0x'+'c'.repeat(40),issuer='0x'+'d'.repeat(40);
const listing='0x'+'1'.repeat(64),asset='0x'+'3'.repeat(64),operation='0x'+'2'.repeat(64);
function setup(status=1){
 const state={status,chainId:420,tip:10n,settled:false,closed:false};
 const row=()=>({owner:seller,asset,quantity:2n,expiresAt:999999n,status:state.status});
 const listed={blockNumber:4n,args:{listingId:listing,owner:seller,asset,quantity:2n}};
 const settled={blockNumber:8n,args:{listingId:listing,operationId:operation,buyer}};
 const closed={blockNumber:9n,args:{listingId:listing,status:state.status}};
 const client={
  getChainId:async()=>state.chainId,
  getBlockNumber:async()=>state.tip,
  readContract:async q=>q.functionName==='listing'?row():operation,
  getContractEvents:async q=>q.eventName==='EscrowListed'?[listed]:
   q.eventName==='EscrowSettled'?(state.settled?[settled]:[]):
   q.eventName==='EscrowClosed'?(state.closed?[{...closed,args:{...closed.args,status:state.status}}]:[]):[]
 };
 return {state,reader:new CanonicalEscrowReader({client,escrow,issuer,chainId:420})};
}
test('chain verified finalized canonical escrow receipt',async()=>{
 const {reader}=setup();
 const receipt=await reader.lockedEscrowReceipt(listing,3);
 assert.equal(receipt.receiptId,listing);
 assert.equal(receipt.owner,seller);assert.equal(receipt.quantity,2);
 assert.equal(await reader.expectedTransferOperation(listing,buyer),operation);
});
test('chain and confirmation checks fail closed',async()=>{
 const {state,reader}=setup();
 state.chainId=1;
 await assert.rejects(reader.lockedEscrowReceipt(listing,1));
 state.chainId=420;state.tip=4n;
 assert.equal(await reader.lockedEscrowReceipt(listing,3),null);
 assert.equal(await reader.lockedEscrowReceipt('forged',1),null);
});
test('settlement proof and irreversible cancellation proof are disjoint',async()=>{
 const {state,reader}=setup(2);state.settled=true;
 const result=await reader.confirmedReservedTransfer(operation,2);
 assert.equal(result.operationId,operation);
 assert.equal(result.sourceReceiptId,listing);
 assert.equal(result.from,seller);assert.equal(result.to,buyer);
 assert.equal(await reader.proveUnexecutedAndCancelled(operation,listing,buyer,1),false);
 state.status=3;state.settled=false;state.closed=true;
 assert.equal(await reader.proveUnexecutedAndCancelled(operation,listing,buyer,2),true);
 assert.equal(await reader.confirmedReservedTransfer(operation,1),null);
 state.tip=9n;
 assert.equal(await reader.proveUnexecutedAndCancelled(operation,listing,buyer,2),false);
});
