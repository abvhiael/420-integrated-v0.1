import {randomBytes} from 'node:crypto';
import {AuthError,record} from './auth.mjs';
import {checkSchema} from './schema.mjs';
import {money} from './fare.mjs';
import {digest,uint,address,bytes32,PAYMENT_STATUSES} from './payment-protocol.mjs';
import {compensation,periodStatement} from './compensation.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const fail=(c,s=409)=>{throw new AuthError(c,s);};
export function createPaymentService({pool,authenticator,authority,clock=()=>Math.floor(Date.now()/1000),isPaused=()=>true}) {
  if(!pool||!authenticator||!authority)fail('PAY_CONFIGURATION_REQUIRED',503);
  const time=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<0)fail('CLOCK_UNAVAILABLE',503);return n;};
  const permit=async(token,action,trip,owner)=>{
    const p=await authenticator.authorize(token,{action,resource:`trip:${trip.id}`});
    if(time()>=p.expiresAt)fail('AUTHORIZATION_EXPIRED',401);
    if(p.role==='rider'&&(p.subject!==trip.riderId||(owner&&p.accountId!==owner)))fail('PAY_SCOPE_DENIED',403);
    if(p.role==='driver'&&(p.subject!==trip.driverId||action!=='pay.read'))fail('PAY_SCOPE_DENIED',403);
    if(!['rider','driver','operator'].includes(p.role))fail('PAY_SCOPE_DENIED',403);return p;
  };
  const context=async(client,tripId)=>{
    if(!id(tripId))fail('INVALID_REQUEST',400);
    const t=(await client.query('SELECT snapshot FROM liftd.trips WHERE trip_id=$1',[tripId])).rows[0]?.snapshot;if(!t)fail('TRIP_UNAVAILABLE',404);
    const q=(await client.query('SELECT q.payload,q.quote_hash FROM liftd.trip_quotes b JOIN liftd.fare_quotes q USING(quote_id) WHERE b.trip_id=$1',[tripId])).rows[0];
    if(!q)fail('EXPLICIT_CONSENT_REQUIRED',403);return{trip:t,quote:{...q.payload,quoteHash:q.quote_hash}};
  };
  const getIntent=async(client,tripId)=>{
    const row=(await client.query("SELECT * FROM liftd.payment_intents WHERE trip_id=$1 AND status<>'SUPERSEDED' FOR UPDATE",[tripId])).rows[0];if(!row)fail('PAY_INTENT_REQUIRED');return row;
  };
  async function tx(token,tripId,commandId,action,request,produce,newRisk=false) {
    if(!id(commandId))fail('INVALID_REQUEST',400);let client;
    try {
      client=await pool.connect();await client.query('BEGIN');await checkSchema(client);await client.query("SET LOCAL lock_timeout='3s'");await client.query("SET LOCAL idle_in_transaction_session_timeout='15s'");
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`liftd:financial:${tripId}`]);
      const ctx=await context(client,tripId),p=await permit(token,action,ctx.trip,ctx.quote.accountId);
      const guard=async()=>{const fresh=await permit(token,action,ctx.trip,ctx.quote.accountId);if(fresh.subject!==p.subject||fresh.accountId!==p.accountId||fresh.role!==p.role)fail('SESSION_BINDING_MISMATCH',403);if(newRisk&&isPaused())fail('SERVICE_PAUSED');};
      await guard();const old=(await client.query('SELECT action,request,result FROM liftd.financial_commands WHERE actor_id=$1 AND command_id=$2',[p.subject,commandId])).rows[0];
      const binding={tripId,...request,accountId:p.accountId};
      if(old){if(old.action!==action||digest(old.request)!==digest(binding))fail('IDEMPOTENCY_CONFLICT');await client.query('COMMIT');return old.result;}
      const result=await produce(client,ctx,p,guard);await guard();
      await client.query('INSERT INTO liftd.financial_commands(actor_id,command_id,action,request,trip_id,result) VALUES($1,$2,$3,$4,$5,$6)',[p.subject,commandId,action,binding,tripId,result]);
      await client.query('COMMIT');return Object.freeze(result);
    }catch(e){if(client){try{await client.query('ROLLBACK');}catch{}}if(e instanceof AuthError)throw e;if(e.code==='23505')fail('FINANCIAL_REPLAY');fail('PAY_UNAVAILABLE',503);}
    finally{client?.release();}
  }
  const eventBinding=row=>({intentId:row.intent_id,intentHash:row.intent_hash,intent:row.payload});
  async function current(client,ctx,row,guard) {
    const e=await authority.event(ctx.trip.riderId,eventBinding(row));
    record(e,['eventId','authorityRevision','type','receiptHash','blockHash','blockNumber','canonical','finality','paymentStatus','paymentId','invoiceId','payer','merchant','asset','amountUnits','tipUnits','registry','recoveryRef','submittedAt','chainId','refundedUnits']);
    bytes32(e.eventId);bytes32(e.receiptHash);bytes32(e.blockHash);
    const i=row.payload;
    if(e.chainId!==i.chainId||e.paymentId!==i.paymentId||e.invoiceId!==i.invoiceId||e.payer!==i.payer||e.merchant!==i.merchant||e.asset!==i.asset||e.amountUnits!==i.amountUnits||e.tipUnits!==i.tipUnits||e.registry!==authority.config.paymentRegistry||!Number.isSafeInteger(e.blockNumber)||e.blockNumber<0||!Number.isSafeInteger(e.authorityRevision)||e.authorityRevision<1)fail('PAY_RECEIPT_BINDING_MISMATCH',403);
    const d=digest(e),prior=(await client.query('SELECT digest FROM liftd.payment_events WHERE event_id=$1',[e.eventId])).rows[0];
    if(prior){if(prior.digest!==d)fail('PAY_EVENT_EQUIVOCATION',403);return row;}
    if(e.authorityRevision<=Number(row.authority_revision))fail('STALE_PAY_PROJECTION',403);
    let status;
    if(e.type==='REORG'||e.type==='FAILED') {
      if((e.type==='REORG'&&e.canonical!==false)||(e.type==='FAILED'&&(e.canonical!==true||e.paymentStatus!==PAYMENT_STATUSES.FAILED)))fail('INVALID_PAY_RECOVERY',403);
      status='RECOVERY_REQUIRED';
    }else if(e.type==='CAPTURE'||e.type==='REFUND_STATE') {
      const refunded=uint(e.refundedUnits);
      if(e.type==='REFUND_STATE'){
        const confirmed=(await client.query("SELECT amount_units FROM liftd.pay_operations WHERE trip_id=$1 AND kind='refund' AND status='FINALIZED'",[ctx.trip.id])).rows.reduce((n,r)=>n+uint(r.amount_units),0n);
        if(!row.captured||refunded===0n||refunded!==confirmed||refunded>uint(i.amountUnits)||e.paymentStatus!==(refunded===uint(i.amountUnits)?PAYMENT_STATUSES.REFUNDED:PAYMENT_STATUSES.PARTIALLY_REFUNDED))fail('REFUND_AUTHORITY_REQUIRED',403);
      }else if(refunded!==0n)fail('REFUND_AUTHORITY_REQUIRED',403);
      if(e.canonical!==true||!['FINALIZED','SETTLED'].includes(e.finality)||(e.type==='CAPTURE'&&![PAYMENT_STATUSES.FINALIZED,PAYMENT_STATUSES.SETTLED].includes(e.paymentStatus)))fail('PAY_FINALITY_REQUIRED',403);
      const consent=(await client.query('SELECT payload FROM liftd.wallet_consents WHERE intent_id=$1',[row.intent_id])).rows[0]?.payload;
      if(!consent)fail('WALLET_CONSENT_REQUIRED',403);
      if(!Number.isSafeInteger(e.submittedAt)||e.submittedAt<consent.acceptedAt||e.submittedAt>=Math.min(consent.expiresAt,i.expiresAt))fail('LATE_PAY_EXECUTION',403);
      if(row.status==='RECOVERY_REQUIRED'&&(!id(e.recoveryRef)))fail('INDEPENDENT_PAY_RECOVERY_REQUIRED',403);
      status='CAPTURED';
    }else fail('INVALID_PAY_EVENT',403);
    await guard();
    const receipt=(await client.query('SELECT owner_id,owner_kind FROM liftd.financial_receipts WHERE receipt_hash=$1',[e.receiptHash])).rows[0];
    if(receipt&&(receipt.owner_id!==row.intent_id||receipt.owner_kind!=='CAPTURE'))fail('RECEIPT_REPLAY',403);
    if(!receipt)await client.query('INSERT INTO liftd.financial_receipts(receipt_hash,owner_id,owner_kind) VALUES($1,$2,$3)',[e.receiptHash,row.intent_id,'CAPTURE']);
    await client.query('INSERT INTO liftd.payment_events(event_id,intent_id,receipt_hash,digest,payload) VALUES($1,$2,$3,$4,$5)',[e.eventId,row.intent_id,e.receiptHash,d,e]);
    await client.query('UPDATE liftd.payment_intents SET status=$1,authority_revision=$2,revision=revision+1,captured=$3 WHERE intent_id=$4',[status,e.authorityRevision,status==='CAPTURED'||row.captured,row.intent_id]);
    return getIntent(client,ctx.trip.id);
  }
  async function buildPlan(client,ctx,row,guard,additionalRefund) {
    if(!['COMPLETED','CANCELLED'].includes(ctx.trip.state))fail('TERMINAL_TRIP_REQUIRED');
    const timing=(await client.query('SELECT * FROM liftd.trip_financial_timing WHERE trip_id=$1',[ctx.trip.id])).rows[0];if(!timing||timing.ended_at===null)fail('ACTUAL_ENGAGEMENT_REQUIRED');
    const assigned=timing.assigned_at===null?null:Number(timing.assigned_at),ended=Number(timing.ended_at);
    let meter={engagedMeters:0,engagedSeconds:0,onlineSeconds:0,periodId:'no_assignment',accountId:null};
    if(ctx.trip.driverId){
      meter=await authority.meter(ctx.trip.driverId,{tripId:ctx.trip.id,quoteHash:ctx.quote.quoteHash,driverId:ctx.trip.driverId,vehicleId:ctx.trip.vehicleId,assignedAt:assigned,endedAt:ended});
      record(meter,['engagedMeters','engagedSeconds','onlineSeconds','periodId','periodStart','periodEnd','accountId','actualRef']);
      for(const k of ['engagedMeters','engagedSeconds','onlineSeconds','periodStart','periodEnd'])money(meter[k]);
      const account=(await client.query('SELECT account_id FROM liftd.driver_availability WHERE driver_id=$1',[ctx.trip.driverId])).rows[0]?.account_id;
      if(meter.accountId!==account||meter.engagedSeconds!==ended-assigned||meter.onlineSeconds<meter.engagedSeconds||meter.periodStart>assigned||meter.periodEnd<ended||!id(meter.periodId)||!id(meter.actualRef))fail('INVALID_ENGAGEMENT',403);
    }
    const meterDigest=digest(meter);
    const first=(await client.query('SELECT payload FROM liftd.payout_projections WHERE trip_id=$1 ORDER BY id ASC LIMIT 1',[ctx.trip.id])).rows[0]?.payload;
    if(first&&first.meterDigest!==meterDigest)fail('METER_EQUIVOCATION',403);
    const rules=await authority.rules(ctx.trip.riderId,{tripId:ctx.trip.id,quoteHash:ctx.quote.quoteHash,periodId:meter.periodId,assignedAt:assigned,endedAt:ended});
    const refunds={fare:0,taxes:0,passThrough:0,tips:0};
    for(const r of (await client.query("SELECT payload FROM liftd.pay_operations WHERE trip_id=$1 AND kind='refund' AND status IN ('FINALIZED','RECOVERY_REQUIRED')",[ctx.trip.id])).rows)for(const k of Object.keys(refunds))refunds[k]=money(BigInt(refunds[k])+BigInt(r.payload.refunds[k]));
    if(additionalRefund)for(const k of Object.keys(refunds))refunds[k]=money(BigInt(refunds[k])+BigInt(additionalRefund[k]));
    const q=ctx.quote.amounts;
    const sum=list=>money(list.reduce((n,l)=>n+BigInt(l.amountCents),0n));
    const plan=compensation({fareCents:q.transportationCents,taxesCents:sum(q.taxes),passThroughCents:sum(q.passThrough),tipCents:row.payload.tipCents,refunds,meter:{...meter,...rules},completed:ctx.trip.state==='COMPLETED',captured:row.captured});
    const payload={...plan,meterDigest,tripId:ctx.trip.id,quoteHash:ctx.quote.quoteHash,intentId:row.intent_id,paymentId:row.payload.paymentId,authorityRevision:Number(row.authority_revision),driverId:ctx.trip.driverId,driverAccountId:meter.accountId,refunds};
    const planHash=digest(payload);await guard();
    await client.query('INSERT INTO liftd.payout_projections(plan_hash,trip_id,payload) VALUES($1,$2,$3) ON CONFLICT(plan_hash) DO NOTHING',[planHash,ctx.trip.id,payload]);
    return {...payload,planHash};
  }
  return Object.freeze({
    lock:async(client,tripId)=>client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`liftd:financial:${tripId}`]),
    async recordLifecycle(client,trip,action,now) {
      if(action==='create')await client.query('INSERT INTO liftd.trip_financial_timing(trip_id,requested_at) VALUES($1,$2)',[trip.id,now]);
      else if(['assign','complete','cancel','expire'].includes(action)) {
        const field=action==='assign'?'assigned_at':'ended_at';await client.query(`UPDATE liftd.trip_financial_timing SET ${field}=$1 WHERE trip_id=$2`,[now,trip.id]);
      }
    },
    async prepare(token,tripId,input) {
      record(input,['commandId','tipCents']);money(input.tipCents);
      return tx(token,tripId,input.commandId,'pay.prepare',{tipCents:input.tipCents},async(client,ctx,p,guard)=>{
        if(p.role!=='rider'||ctx.trip.state==='CANCELLED')fail('PAY_SCOPE_DENIED',403);
        const previous=(await client.query("SELECT * FROM liftd.payment_intents WHERE trip_id=$1 AND status<>'SUPERSEDED' FOR UPDATE",[tripId])).rows[0];
        if(previous){
          const latest=await current(client,ctx,previous,guard);
          const witness=(await client.query("SELECT payload FROM liftd.payment_events WHERE intent_id=$1 ORDER BY (payload->>'authorityRevision')::bigint DESC LIMIT 1",[previous.intent_id])).rows[0]?.payload;
          if(latest.captured||latest.status!=='RECOVERY_REQUIRED'||witness?.type!=='FAILED'||witness.canonical!==true||witness.paymentStatus!==PAYMENT_STATUSES.FAILED)fail('PAY_INTENT_EXISTS');
          await client.query("UPDATE liftd.payment_intents SET status='SUPERSEDED',revision=revision+1 WHERE intent_id=$1",[previous.intent_id]);
        }
        const intentId=randomBytes(24).toString('base64url'),totalCents=money(BigInt(ctx.quote.amounts.totalCents)+BigInt(input.tipCents));
        const binding={intentId,tripId,quoteHash:ctx.quote.quoteHash,accountId:p.accountId,totalCents,tipCents:input.tipCents,currency:'CAD'};
        const i=await authority.prepare(p.subject,binding);await guard();if(i.expiresAt<=time())fail('PAY_INTENT_EXPIRED');
        const payload={...i,tripId,quoteHash:ctx.quote.quoteHash,riderId:p.subject,accountId:p.accountId,tipCents:input.tipCents},intentHash=digest(payload);
        await client.query('INSERT INTO liftd.payment_intents(intent_id,trip_id,intent_hash,payload,status) VALUES($1,$2,$3,$4,$5)',[intentId,tripId,intentHash,payload,'PREPARED']);
        return {intentId,intentHash,status:'PREPARED',...payload};
      },true);
    },
    async consent(token,tripId,input) {
      record(input,['commandId','intentId','intentHash']);
      return tx(token,tripId,input.commandId,'pay.consent',{intentId:input.intentId,intentHash:input.intentHash},async(client,ctx,p,guard)=>{
        if(p.role!=='rider'||ctx.trip.state==='CANCELLED')fail('PAY_SCOPE_DENIED',403);const row=await getIntent(client,tripId);
        if(row.intent_id!==input.intentId||row.intent_hash!==input.intentHash||row.status!=='PREPARED'||row.payload.expiresAt<=time())fail('PAY_INTENT_EXPIRED');
        const consent=await authority.wallet(p.subject,eventBinding(row));await guard();if(consent.expiresAt<=time()||row.payload.expiresAt<=time())fail('WALLET_CONSENT_EXPIRED');
        await client.query('INSERT INTO liftd.wallet_consents(intent_id,payload) VALUES($1,$2)',[row.intent_id,{...consent,acceptedAt:time()}]);
        await client.query("UPDATE liftd.payment_intents SET status='AUTHORIZED',revision=revision+1 WHERE intent_id=$1",[row.intent_id]);return {intentId:row.intent_id,status:'AUTHORIZED'};
      },true);
    },
    async reconcile(token,tripId,input) {
      record(input,['commandId']);return tx(token,tripId,input.commandId,'pay.reconcile',{},async(client,ctx,p,guard)=>{
        const row=await current(client,ctx,await getIntent(client,tripId),guard);return {intentId:row.intent_id,status:row.status,revision:Number(row.revision)};
      });
    },
    async plan(token,tripId,input) {
      record(input,['commandId']);return tx(token,tripId,input.commandId,'pay.reconcile',{purpose:'plan'},async(client,ctx,p,guard)=>{
        if(p.role!=='operator')fail('PAY_SCOPE_DENIED',403);
        let row=await getIntent(client,tripId);if(row.status==='RECOVERY_REQUIRED')fail('PAY_RECOVERY_REQUIRED');
        row=await current(client,ctx,row,guard);if(row.status==='RECOVERY_REQUIRED')fail('PAY_RECOVERY_REQUIRED');return buildPlan(client,ctx,row,guard);
      });
    },
    async reserve(token,tripId,input) {
      record(input,['commandId','kind','amountCents']);money(input.amountCents);
      if(!['refund','driver','platform','passThrough','development'].includes(input.kind)||input.amountCents===0)fail('INVALID_REQUEST',400);
      return tx(token,tripId,input.commandId,'pay.reconcile',{kind:input.kind,amountCents:input.amountCents},async(client,ctx,p,guard)=>{
        if(input.kind!=='refund'&&p.role!=='operator')fail('PAY_SCOPE_DENIED',403);
        let row=await current(client,ctx,await getIntent(client,tripId),guard);if(row.status!=='CAPTURED')fail('PAY_FINALITY_REQUIRED');
        if((await client.query("SELECT 1 FROM liftd.pay_operations WHERE trip_id=$1 AND status='RECOVERY_REQUIRED'",[tripId])).rowCount)fail('PAY_RECOVERY_REQUIRED');
        if(input.kind==='development')fail('CANONICAL_DEVELOPMENT_POLICY_INCOMPATIBLE',403);
        let plan=null,recipient,refunds;
        const existing=(await client.query("SELECT * FROM liftd.pay_operations WHERE trip_id=$1 AND status IN ('RESERVED','FINALIZED','RECOVERY_REQUIRED')",[tripId])).rows;
        if(input.kind==='refund') {
          const refunded=existing.filter(o=>o.kind==='refund').reduce((n,o)=>n+BigInt(o.amount_cents),0n);
          if(BigInt(input.amountCents)+refunded>BigInt(row.payload.totalCents))fail('REFUND_EXCEEDS_CAPTURE');
          recipient=row.payload.payer;
        }else {
          if(isPaused()&&input.kind==='platform')fail('SERVICE_PAUSED');plan=await buildPlan(client,ctx,row,guard);
          const bucket=plan[{driver:'driverCents',platform:'platformCents',passThrough:'passThroughCents'}[input.kind]];
          const used=existing.filter(o=>o.kind===input.kind).reduce((n,o)=>n+BigInt(o.amount_cents),0n);
          if(BigInt(input.amountCents)+used>BigInt(bucket))fail('PAYOUT_EXCEEDS_ENTITLEMENT');
          if(input.kind==='driver')recipient=await authority.beneficiary(ctx.trip.driverId,{tripId,driverId:ctx.trip.driverId,accountId:plan.driverAccountId,chainId:authority.config.chainId});
          else recipient=authority.config[input.kind==='platform'?'platformController':'passThroughController'];
        }
        const operationId=randomBytes(24).toString('base64url'),binding={...eventBinding(row),operationId,kind:input.kind,amountCents:input.amountCents,recipient,planHash:plan?.planHash??null,tripState:ctx.trip.state};
        const op=await authority.operation(ctx.trip.riderId,binding);
        record(op,['payOperationId','amountUnits','approved','recipient','amountCents','kind','refunds','asset','chainId','executor']);bytes32(op.payOperationId);uint(op.amountUnits);
        if(op.asset!==row.payload.asset||op.chainId!==row.payload.chainId||op.executor!==authority.config[input.kind==='refund'?'refundManager':'disbursementRegistry']||op.approved!==true||op.recipient!==recipient||op.kind!==input.kind||op.amountCents!==input.amountCents||uint(op.amountUnits)===0n)fail('PAY_OPERATION_DENIED',403);
        if(input.kind==='refund') {
          record(op.refunds,['fare','taxes','passThrough','tips']);let total=0n;
          for(const k of ['fare','taxes','passThrough','tips'])total+=BigInt(money(op.refunds[k]));if(total!==BigInt(input.amountCents))fail('INVALID_REFUND_ALLOCATION',403);refunds=op.refunds;
          const q=ctx.quote.amounts,max={fare:q.transportationCents,taxes:money(q.taxes.reduce((n,l)=>n+BigInt(l.amountCents),0n)),passThrough:money(q.passThrough.reduce((n,l)=>n+BigInt(l.amountCents),0n)),tips:row.payload.tipCents};
          for(const k of Object.keys(max)){const previous=existing.filter(o=>o.kind==='refund').reduce((n,o)=>n+BigInt(o.payload.refunds[k]),0n);if(previous+BigInt(refunds[k])>BigInt(max[k]))fail('REFUND_EXCEEDS_COMPONENT');}
          if(['COMPLETED','CANCELLED'].includes(ctx.trip.state))plan=await buildPlan(client,ctx,row,guard,refunds);
        }
        const usedUnits=existing.reduce((n,o)=>n+uint(o.amount_units),0n);
        let budget=uint(row.payload.amountUnits);
        for(const f of (await client.query('SELECT payload FROM liftd.settlement_funding WHERE trip_id=$1',[tripId])).rows)budget+=uint(f.payload.amountUnits);
        if(plan&&budget<usedUnits+uint(op.amountUnits)) {
          const past=kind=>existing.filter(o=>o.kind===kind).reduce((n,o)=>n+BigInt(o.amount_cents),0n);
          const excess=(paid,owed)=>paid>BigInt(owed)?paid-BigInt(owed):0n;
          const requiredCents=money(BigInt(plan.platformFundingCents)+excess(past('platform'),plan.platformCents)+excess(past('passThrough'),plan.passThroughCents));
          const requiredUnits=(usedUnits+uint(op.amountUnits)-budget).toString();
          const fund=await authority.funding(ctx.trip.riderId,{tripId,planHash:plan.planHash,requiredCents,requiredUnits,asset:row.payload.asset,chainId:row.payload.chainId});
          if((await client.query('SELECT 1 FROM liftd.financial_receipts WHERE receipt_hash=$1',[fund.receiptHash])).rowCount)fail('RECEIPT_REPLAY',403);
          await client.query('INSERT INTO liftd.financial_receipts(receipt_hash,owner_id,owner_kind) VALUES($1,$2,$3)',[fund.receiptHash,fund.fundingRef,'FUNDING']);
          await client.query('INSERT INTO liftd.settlement_funding(funding_ref,trip_id,payload) VALUES($1,$2,$3)',[fund.fundingRef,tripId,fund]);budget+=uint(fund.amountUnits);
        }
        if(usedUnits+uint(op.amountUnits)>budget)fail('INSUFFICIENT_FINALIZED_ASSET_BUDGET');
        await guard();
        const payload={...op,operationId,tripId,intentId:row.intent_id,planHash:plan?.planHash??null,refunds:refunds??null};
        await client.query('INSERT INTO liftd.pay_operations(operation_id,trip_id,pay_operation_id,kind,recipient,amount_cents,amount_units,payload,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[operationId,tripId,op.payOperationId,input.kind,recipient,input.amountCents,op.amountUnits,payload,'RESERVED']);
        return {operationId,payOperationId:op.payOperationId,status:'RESERVED',recipient,amountCents:input.amountCents,amountUnits:op.amountUnits};
      });
    },
    async reconcileOperation(token,tripId,input) {
      record(input,['commandId','operationId']);if(!id(input.operationId))fail('INVALID_REQUEST',400);
      return tx(token,tripId,input.commandId,'pay.reconcile',{operationId:input.operationId},async(client,ctx,p,guard)=>{
        const row=await getIntent(client,tripId);if(row.status==='RECOVERY_REQUIRED')fail('PAY_RECOVERY_REQUIRED');
        const old=(await client.query('SELECT * FROM liftd.pay_operations WHERE operation_id=$1 AND trip_id=$2 FOR UPDATE',[input.operationId,tripId])).rows[0];if(!old)fail('PAY_OPERATION_REQUIRED');if(old.kind!=='refund'&&p.role!=='operator')fail('PAY_SCOPE_DENIED',403);
        const event=await authority.operation(ctx.trip.riderId,{...eventBinding(row),reconcile:true,operation:old.payload});
        record(event,['eventId','receiptHash','payOperationId','kind','recipient','amountCents','amountUnits','status','canonical','finality','paymentStatus','asset','chainId','executor']);bytes32(event.eventId);bytes32(event.receiptHash);
        if(event.asset!==row.payload.asset||event.chainId!==row.payload.chainId||event.executor!==authority.config[old.kind==='refund'?'refundManager':'disbursementRegistry']||event.payOperationId!==old.pay_operation_id||event.kind!==old.kind||event.recipient!==old.recipient||event.amountCents!==Number(old.amount_cents)||event.amountUnits!==old.amount_units)fail('PAY_OPERATION_BINDING_MISMATCH',403);
        const d=digest(event),seen=(await client.query('SELECT digest FROM liftd.operation_events WHERE event_id=$1',[event.eventId])).rows[0];if(seen){if(seen.digest!==d)fail('PAY_EVENT_EQUIVOCATION',403);return {operationId:old.operation_id,status:old.status};}
        if(event.status==='FINALIZED') {
          if(event.canonical!==true||!['FINALIZED','SETTLED'].includes(event.finality))fail('PAY_FINALITY_REQUIRED');
          if(old.kind==='refund'&&![PAYMENT_STATUSES.REFUNDED,PAYMENT_STATUSES.PARTIALLY_REFUNDED].includes(event.paymentStatus))fail('REFUND_AUTHORITY_REQUIRED');
          if(!['RESERVED','RECOVERY_REQUIRED'].includes(old.status))fail('INVALID_OPERATION_TRANSITION');
        }else if(event.status==='FAILED'){if(old.status!=='RESERVED'||event.canonical!==true)fail('FINALIZED_OPERATION_REQUIRES_RECOVERY');}
        else if(event.status==='RECOVERY_REQUIRED'){if(old.status!=='FINALIZED'||event.canonical!==false)fail('INVALID_OPERATION_TRANSITION');}
        else fail('INVALID_OPERATION_TRANSITION');
        await guard();
        const receipt=(await client.query('SELECT owner_id,owner_kind FROM liftd.financial_receipts WHERE receipt_hash=$1',[event.receiptHash])).rows[0];if(receipt&&(receipt.owner_id!==old.operation_id||receipt.owner_kind!=='OPERATION'))fail('RECEIPT_REPLAY',403);
        if(!receipt)await client.query('INSERT INTO liftd.financial_receipts(receipt_hash,owner_id,owner_kind) VALUES($1,$2,$3)',[event.receiptHash,old.operation_id,'OPERATION']);
        await client.query('INSERT INTO liftd.operation_events(event_id,operation_id,receipt_hash,digest,payload) VALUES($1,$2,$3,$4,$5)',[event.eventId,old.operation_id,event.receiptHash,d,event]);
        await client.query('UPDATE liftd.pay_operations SET status=$1,revision=revision+1 WHERE operation_id=$2',[event.status,old.operation_id]);
        return {operationId:old.operation_id,status:event.status};
      });
    },
    async read(token,tripId) {
      await checkSchema(pool);const ctx=await context(pool,tripId);const p=await permit(token,'pay.read',ctx.trip,ctx.quote.accountId);
      if(p.role==='driver'){
        const account=(await pool.query('SELECT account_id FROM liftd.driver_availability WHERE driver_id=$1',[p.subject])).rows[0]?.account_id;if(account!==p.accountId)fail('PAY_SCOPE_DENIED',403);
        const plan=(await pool.query('SELECT payload FROM liftd.payout_projections WHERE trip_id=$1 ORDER BY id DESC LIMIT 1',[tripId])).rows[0]?.payload;
        if(!plan)return {tripId,status:'AWAITING_PROJECTION'};
        return {tripId,earningsCents:plan.earningsCents,allowanceCents:plan.allowanceCents,tipCents:plan.tipCents,topUpCents:plan.topUpCents,engagedSeconds:plan.engagedSeconds,onlineSeconds:plan.onlineSeconds,periodId:plan.periodId,currency:'CAD'};
      }
      const row=(await pool.query("SELECT intent_id,status,revision,payload FROM liftd.payment_intents WHERE trip_id=$1 AND status<>'SUPERSEDED'",[tripId])).rows[0];
      return row?{intentId:row.intent_id,status:row.status,revision:Number(row.revision),totalCents:row.payload.totalCents,currency:'CAD'}:{tripId,status:'NO_INTENT'};
    },
    async statement(token,driverId,periodId) {
      const p=await authenticator.authorize(token,{action:'pay.statement',resource:`account:${driverId}`});if(p.role!=='driver'||p.subject!==driverId||p.expiresAt<=time())fail('PAY_SCOPE_DENIED',403);
      await checkSchema(pool);
      const rows=(await pool.query("SELECT DISTINCT ON(trip_id) payload FROM liftd.payout_projections WHERE payload->>'driverId'=$1 AND payload->>'driverAccountId'=$2 AND payload->>'periodId'=$3 ORDER BY trip_id,id DESC",[driverId,p.accountId,periodId])).rows;
      return periodStatement(rows.map(r=>r.payload));
    },
  });
}
