import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {derivePaymentId,directSettlementCall,validateIntent,uint,PAYMENT_STATUSES} from '../src/payment-protocol.mjs';
import {compensation,periodStatement} from '../src/compensation.mjs';
import {keccak256Hex} from '../../wallet/web/core/keccak.js';
const address=n=>'0x'+n.toString(16).padStart(40,'0'),b32=n=>'0x'+n.toString(16).padStart(64,'0');
const intent=()=>{const p={invoiceId:b32(1),payQuoteId:b32(2),payerNonce:'0',payer:address(423),controller:address(1),merchant:address(5),asset:address(6),amountUnits:'100000',tipUnits:'0',target:address(7),value:'0',chainId:420};p.paymentId=derivePaymentId(p);p.calldata=directSettlementCall(p);return p;};
test('Pay adapter consumes canonical Wallet Keccak and exact PaymentRegistry identity tuple',()=>{
  assert.equal(keccak256Hex(new Uint8Array()),'0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  const p=intent();assert.equal(p.paymentId.length,66);
  for(const [key,val]of Object.entries({invoiceId:b32(3),payer:address(4),merchant:address(8),asset:address(9),amountUnits:'100001',payQuoteId:b32(9),payerNonce:'1'}))assert.notEqual(derivePaymentId({...p,[key]:val}),p.paymentId);
  const source=readFileSync(new URL('../../contracts/src/pay/PaymentRegistry420.sol',import.meta.url),'utf8');
  const names=source.match(/enum Status\s*\{([^}]+)\}/)[1].split(',').map(s=>s.trim()).filter(Boolean);assert.deepEqual(Object.keys(PAYMENT_STATUSES),names);assert.equal(PAYMENT_STATUSES.FINALIZED,4);assert.equal(PAYMENT_STATUSES.REFUNDED,6);
});
test('exact direct-token call rejects wrong target, recipient, payer, chain, amount and calldata',()=>{
  const p=intent(),config={chainId:420,merchant:p.merchant,asset:p.asset,payRouter:p.target};assert.equal(validateIntent(p,config),p);
  for(const patch of [{chainId:421},{target:address(9)},{merchant:address(9)},{payer:address(9)},{amountUnits:'99999'},{calldata:p.calldata.slice(0,-1)+'f'},{value:'1'}])assert.throws(()=>validateIntent({...p,...patch},config));
  assert.equal(p.calldata.length,2+8+11*64);assert.equal(p.calldata.slice(10+4*64,10+5*64),224n.toString(16).padStart(64,'0'));
  for(const value of ['01','-1','1.1',String(1n<<256n)])assert.throws(()=>uint(value));
});
const meter={engagedMeters:12000,engagedSeconds:1500,onlineSeconds:3600,minimumDriverCentsPerHour:2500,minimumAllowanceCentsPerKm:45,periodId:'period'};
const args={fareCents:3100,taxesCents:0,passThroughCents:0,tipCents:0,meter,completed:true,captured:true};
test('adopted 80/20 and 20% development policy conserves the reference example without commission on allowance',()=>{
  const p=compensation(args);assert.equal(p.allowanceCents,540);assert.equal(p.earningsCents,2048);assert.equal(p.commissionCents,512);assert.equal(p.driverCents,2588);assert.equal(p.developmentCents,102);assert.equal(p.platformCents,410);assert.equal(p.platformFundingCents,0);assert.equal(p.conserved,true);
  assert.equal(p.developmentStatus,'HELD_CANONICAL_10_PERCENT_CEILING');
  const source=readFileSync(new URL('../../contracts/src/revenue/DevelopmentCompensationVault420.sol',import.meta.url),'utf8');assert.match(source,/MAX_COMPENSATION_BPS\s*=\s*1_000/);
});
test('refunds preserve driver earned income, allowance and all collected tips; deficits remain platform obligations',()=>{
  const p=compensation({...args,tipCents:200,refunds:{fare:1000,taxes:0,passThrough:0,tips:200}});
  assert.equal(p.earningsCents,2048);assert.equal(p.allowanceCents,540);assert.equal(p.tipCents,200);assert.equal(p.developmentCents,0);assert.equal(p.platformFundingCents,688);assert.equal(p.conserved,true);
  const uncollected=compensation({...args,captured:false});assert.equal(uncollected.developmentCents,0);assert.equal(uncollected.platformCents,0);assert.equal(uncollected.platformFundingCents,2588);
});
test('actual engagement includes pickup and cancellation, and per-trip ceilings do not claw back pay-period earnings',()=>{
  const cancelled=compensation({...args,completed:false,refunds:{fare:3100,taxes:0,passThrough:0,tips:0}});assert.equal(cancelled.earningsCents,0);assert.equal(cancelled.allowanceCents,540);assert.equal(cancelled.topUpCents,1042);assert.equal(cancelled.driverCents,1582);assert.equal(cancelled.platformFundingCents,1582);
  const statement=periodStatement([cancelled,cancelled]);assert.equal(statement.engagedSeconds,3000);assert.equal(statement.onlineSeconds,7200);assert.equal(statement.topUpsCents,2084);assert.equal(statement.onlineTimeGuarantee,false);
});
test('boundary accounting keeps taxes/pass-through separate and never creates negative earnings/development',()=>{
  for(let refund=0;refund<=3100;refund+=31){const p=compensation({...args,taxesCents:100,passThroughCents:25,refunds:{fare:refund,taxes:0,passThrough:0,tips:0}});assert.equal(p.passThroughCents,125);assert.ok(p.driverCents>=2588);assert.ok(p.developmentCents>=0);assert.equal(p.conserved,true);}
  const p=compensation({...args,meter:{...meter,engagedMeters:100000,engagedSeconds:7200}});assert.equal(p.earningsCents,0);assert.equal(p.allowanceCents,4500);assert.equal(p.topUpCents,5000);assert.equal(p.platformFundingCents,6400);
});
