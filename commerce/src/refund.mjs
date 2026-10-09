import {requireThat,bytes32,wallet} from './security.mjs';

// Pure eligibility planning only. Pay governance alone may apply and record a refund.
// No merchant signature, HTTP request or returned proposal creates a refund.
export function canonicalRefundProposal({paymentId,orderId,payer,asset,payment,requestedAmount,reasonHash}) {
 bytes32(paymentId);bytes32(orderId);bytes32(reasonHash);
 requireThat(payment&&[4,5,7].includes(Number(payment.status)),'refund_payment_state',409);
 requireThat(wallet(payment.payer)===wallet(payer),'refund_recipient_mismatch',409);
 requireThat(wallet(payment.settlementAsset)===wallet(asset),'refund_asset_mismatch',409);
 const maximum=BigInt(payment.settlementAmount)+BigInt(payment.tipAmount);
 const refunded=BigInt(payment.refundedAmount);
 requireThat(maximum>0n&&refunded>=0n&&refunded<=maximum,'refund_accounting_invalid',503);
 requireThat(typeof requestedAmount==='string'&&/^[1-9][0-9]{0,77}$/.test(requestedAmount)&&BigInt(requestedAmount)<2n**256n,'refund_amount_invalid');
 const amount=BigInt(requestedAmount);
 requireThat(amount<=maximum-refunded,'refund_exceeds_available',409);
 return {paymentId,orderId,recipient:wallet(payer),settlementAsset:wallet(asset),amount:amount.toString(),previousRefunded:refunded.toString(),refundableMaximum:maximum.toString(),remainingAfterProposal:(maximum-refunded-amount).toString(),reasonHash,requiresGovernanceApproval:true,executed:false,transferExecuted:false,canonicalAuthorization:'PaymentRegistry420.applyRefund',canonicalEvidence:'RefundManager420.recordRefund',status:'AWAITING_GENESIS_GOVERNANCE'};
}
