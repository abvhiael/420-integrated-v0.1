import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalRefundProposal} from '../src/refund.mjs';
import {b32,buyer,address} from './fixtures.mjs';
const setup=(override={})=>({paymentId:b32(901),orderId:b32(902),payer:buyer.address,asset:address(100),payment:{payer:buyer.address.toLowerCase(),settlementAsset:address(100).toLowerCase(),settlementAmount:'100',tipAmount:'5',refundedAmount:'20',status:7,...override},requestedAmount:'85',reasonHash:b32(903)});
test('COM-6A Pay accounting allows exact remaining refund but does not authorize transfer',()=>{
 const p=canonicalRefundProposal(setup());assert.equal(p.refundableMaximum,'105');assert.equal(p.previousRefunded,'20');assert.equal(p.remainingAfterProposal,'0');assert.equal(p.requiresGovernanceApproval,true);assert.equal(p.transferExecuted,false);assert.equal(p.status,'AWAITING_GENESIS_GOVERNANCE');
});
test('COM-6A rejects duplicate/excessive/zero/overflow/cross-asset/cross-payer/unsettled and accounting corruption',()=>{
 for(const amount of ['86','0','-1','1.1','01',String(2n**256n)])assert.throws(()=>canonicalRefundProposal({...setup(),requestedAmount:amount}));
 for(const p of [{status:2},{status:8},{refundedAmount:'106'},{refundedAmount:'-1'},{payer:address(44)},{settlementAsset:address(45)}])assert.throws(()=>canonicalRefundProposal(setup(p)));
 assert.throws(()=>canonicalRefundProposal({...setup(),reasonHash:b32(0)}));
});
test('COM-6A proposal is pure and cannot itself change canonical Pay refunded amount',()=>{
 const v=setup();const before=JSON.stringify(v.payment);canonicalRefundProposal(v);canonicalRefundProposal(v);assert.equal(JSON.stringify(v.payment),before);
});
