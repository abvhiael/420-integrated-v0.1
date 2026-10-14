import {quoteFixture} from './quote-fixture.mjs';
import {createPayAuthority} from '../../src/pay-authority.mjs';
import {createPaymentService} from '../../src/payments.mjs';
import {createTripService} from '../../src/service.mjs';
import {createHttpHandler} from '../../src/http.mjs';
import {derivePaymentId,directSettlementCall,digest} from '../../src/payment-protocol.mjs';
export const addr=n=>'0x'+n.toString(16).padStart(40,'0');
export const hex=v=>'0x'+digest(v);
export const paymentConfig={chainId:420,merchant:addr(5),asset:addr(6),payRouter:addr(7),paymentRegistry:addr(8),refundManager:addr(9),settlementRouter:addr(10),developmentVault:addr(11),platformController:addr(12),passThroughController:addr(13),disbursementRegistry:addr(14)};
export function paymentFixture(pool,pairs,controls) {
  const base=quoteFixture(pool,pairs,controls);let seq=0;
  const resolver=(i,purpose,fn)=>base.transport(i,purpose,r=>({sub:r.subject,nonce:r.nonce,binding:digest(r.binding),...fn(r.binding)}));
  const prepare=resolver(10,'liftd_pay_intent',b=>{
    const i={invoiceId:hex(['invoice',b.intentId]),payQuoteId:'0x'+b.quoteHash,payerNonce:'0',payer:addr(423),controller:addr(1),merchant:paymentConfig.merchant,asset:paymentConfig.asset,amountUnits:String(b.totalCents*100),tipUnits:String(b.tipCents*100),target:paymentConfig.payRouter,value:'0',chainId:420,currency:'CAD',totalCents:b.totalCents,expiresAt:controls.now+30};
    i.paymentId=derivePaymentId(i);i.calldata=directSettlementCall(i);return{intent:{...i,...(controls.intentPatch??{})}};
  });
  const wallet=resolver(9,'liftd_wallet_consent',b=>({approved:controls.walletApproved??true,payer:b.intent.payer,controller:b.intent.controller,authorizationEpoch:0,...(controls.walletPatch??{})}));
  const event=resolver(10,'liftd_pay_event',b=>({event:{eventId:hex([b.intentId,'capture',controls.payRevision??1]),authorityRevision:controls.payRevision??1,type:'CAPTURE',receiptHash:hex([b.intentId,'capture-receipt',controls.payRevision??1]),blockHash:hex('block'),blockNumber:100,canonical:true,finality:'FINALIZED',paymentStatus:4,paymentId:b.intent.paymentId,invoiceId:b.intent.invoiceId,payer:b.intent.payer,merchant:b.intent.merchant,asset:b.intent.asset,amountUnits:b.intent.amountUnits,tipUnits:b.intent.tipUnits,registry:paymentConfig.paymentRegistry,recoveryRef:null,submittedAt:100,chainId:420,...(controls.eventPatch??{})}}));
  const operation=resolver(10,'liftd_pay_operation',b=>{
    if(b.reconcile)return{operation:{eventId:hex([b.operation.operationId,controls.operationStatus??'FINALIZED']),receiptHash:hex([b.operation.operationId,'receipt',controls.operationStatus??'FINALIZED']),payOperationId:b.operation.payOperationId,kind:b.operation.kind,recipient:b.operation.recipient,amountCents:b.operation.amountCents,amountUnits:b.operation.amountUnits,status:controls.operationStatus??'FINALIZED',canonical:(controls.operationStatus??'FINALIZED')!=='RECOVERY_REQUIRED',finality:'FINALIZED',paymentStatus:7,asset:paymentConfig.asset,chainId:420,executor:paymentConfig[b.operation.kind==='refund'?'refundManager':'disbursementRegistry'],...(controls.operationEventPatch??{})}};
    const refunds=controls.refunds??(b.tripState==='CANCELLED'?{fare:b.amountCents,taxes:0,passThrough:0,tips:0}:{fare:b.amountCents,taxes:0,passThrough:0,tips:0});
    return{operation:{payOperationId:hex(b.operationId),amountUnits:String(b.amountCents*100),approved:true,recipient:b.recipient,amountCents:b.amountCents,kind:b.kind,refunds:b.kind==='refund'?refunds:null,asset:paymentConfig.asset,chainId:420,executor:paymentConfig[b.kind==='refund'?'refundManager':'disbursementRegistry'],...(controls.operationPatch??{})}};
  });
  const meter=resolver(11,'liftd_trip_meter',b=>({meter:{engagedMeters:controls.actualMeters??2300,engagedSeconds:b.endedAt-b.assignedAt,onlineSeconds:10000,periodId:'period_1',periodStart:0,periodEnd:10000,accountId:`${b.driverId}_account`,actualRef:`actual_${b.tripId}`,...(controls.meterPatch??{})}}));
  const rules=resolver(6,'liftd_compensation_rules',()=>({rules:{minimumDriverCentsPerHour:2500,minimumAllowanceCentsPerKm:45,rulesRef:'compensation_1'}}));
  const funding=resolver(8,'liftd_settlement_funding',b=>({funding:{fundingRef:`fund_${b.tripId}_${++seq}`,payer:'liftd-platform',amountCents:b.requiredCents,amountUnits:(BigInt(b.requiredCents)*100n>BigInt(b.requiredUnits)?BigInt(b.requiredCents)*100n:BigInt(b.requiredUnits)).toString(),reserved:true,canonical:true,finality:'FINALIZED',receiptHash:hex([b.tripId,seq]),asset:paymentConfig.asset,chainId:420,recipient:paymentConfig.merchant,...(controls.fundingPatch??{})}}));
  const beneficiary=resolver(9,'liftd_payout_binding',()=>({controller:addr(24),active:true,...(controls.beneficiaryPatch??{})}));
  const resolvers={prepare,wallet,event,operation,meter,rules,funding,beneficiary};
  const authorities={prepare:base.roots[10],wallet:base.roots[9],event:base.roots[10],operation:base.roots[10],meter:base.roots[11],rules:base.roots[6],funding:base.roots[8],beneficiary:base.roots[9]};
  const authority=createPayAuthority({config:paymentConfig,authorities,resolvers,clock:base.clock});
  const paymentService=createPaymentService({pool,authenticator:base.authenticator,authority,clock:base.clock,isPaused:()=>controls.paused??false});
  const service=createTripService({authenticator:base.authenticator,store:base.tripStore,privateLocationStore:base.privateStore,eligibilityAdapter:base.eligibilityAdapter,dispatchAdapter:base.dispatchAdapter,quoteService:base.quoteService,paymentService,clock:base.clock,isPaused:()=>controls.paused??false});
  const handler=createHttpHandler(service,base.locationService,base.dispatchAdapter,base.quoteService,paymentService);
  const create=async(trip)=>{const result=await base.prepare(trip);await base.consent(result.token,result.quote);await service.create(result.token,{id:trip,riderId:'rider_fare',routeRef:result.route.routeRef,quoteId:result.quote.quoteId,commandId:base.cid()});return result;};
  const transition=(role,subject,trip,action,revision,key=base.cid())=>service.transition(base.token(role,subject,trip),trip,{action,expectedRevision:revision,commandId:key});
  const rider=trip=>base.token('rider','rider_fare',trip),operator=trip=>base.token('operator','operator_pay',trip);
  const prepareIntent=(trip,tipCents=0,key=base.cid())=>paymentService.prepare(rider(trip),trip,{commandId:key,tipCents});
  const authorize=async(trip,intent)=>paymentService.consent(rider(trip),trip,{commandId:base.cid(),intentId:intent.intentId,intentHash:intent.intentHash});
  const capture=trip=>paymentService.reconcile(operator(trip),trip,{commandId:base.cid()});
  const plan=trip=>paymentService.plan(operator(trip),trip,{commandId:base.cid()});
  const reserve=(trip,kind,amountCents,key=base.cid())=>paymentService.reserve(operator(trip),trip,{commandId:key,kind,amountCents});
  const reconcileOperation=(trip,operation)=>paymentService.reconcileOperation(operator(trip),trip,{commandId:base.cid(),operationId:operation.operationId});
  const complete=async(trip,driver='driver_pay')=>{
    await base.online(driver,`vehicle_${driver}`);await transition('operator','operator_pay',trip,'match',0);controls.now=110;await transition('driver',driver,trip,'arrive',1);await transition('driver',driver,trip,'start',2);controls.now=200;await transition('driver',driver,trip,'complete',3);
  };
  return {...base,paymentService,service,handler,create,transition,rider,operator,prepareIntent,authorize,capture,plan,reserve,reconcileOperation,complete};
}
