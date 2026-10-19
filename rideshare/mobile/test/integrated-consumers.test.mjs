import test from 'node:test';import assert from 'node:assert/strict';
import {createMobileIntegratedConsumers,safePushEnvelope,validatePaymentProjection} from '../src/integrated-consumers.mjs';
import {createMobileServiceApi} from '../src/service-api.mjs';
const trip={id:'trip1',riderId:'rider1',driverId:'driver1',state:'ASSIGNED',revision:1};
let current={role:'rider',subject:'rider1',accountId:'account1',sessionId:'session1'};
const session={getStatus:()=>current,withFreshRole:async(role,fn)=>{if(role!==current.role)throw Error('ROLE_DENIED');return fn(current);}};
const build=(api={},permission={request:async()=>true},extras={})=>createMobileIntegratedConsumers({session,api,permission,commandId:()=> 'command1',clock:()=>100,...extras});
test('push payload contains only canonical status and refuses private fields',()=>{
 assert.deepEqual(safePushEnvelope({type:'liftd.trip.status',tripId:'trip1',state:'ASSIGNED',revision:1}),{type:'liftd.trip.status',tripId:'trip1',state:'ASSIGNED',revision:1});
 for(const extra of [{latitude:49},{incident:'private'},{identity:'Alice'},{token:'secret'},{routeRef:'route1'}])assert.throws(()=>safePushEnvelope({type:'liftd.trip.status',tripId:'trip1',state:'ASSIGNED',revision:1,...extra}),/UNSAFE_NOTIFICATION/);
});
test('Pay rider no-intent and reorg revision handling, refund and stale rejection',()=>{
 assert.equal(validatePaymentProjection({tripId:'trip1',status:'NO_INTENT'},trip).status,'NO_INTENT');
 const old={intentId:'intent1',status:'SETTLED',revision:4,totalCents:500,currency:'CAD'};
 assert.equal(validatePaymentProjection({...old,status:'REORGED',revision:5},trip,old).status,'REORGED');
 assert.equal(validatePaymentProjection({...old,status:'REFUNDED',revision:6},trip,old).status,'REFUNDED');
 assert.throws(()=>validatePaymentProjection({...old,revision:3},trip,old),/STALE/);
 assert.throws(()=>validatePaymentProjection({...old,revision:4,totalCents:600},trip,old),/STALE/);
});
test('no implicit payment, Wallet can prepare but cannot submit automatically',async()=>{
 let count=0;const c=build({preparePayment:async()=>{count++;return {intentId:'intent1'};}});
 await assert.rejects(c.requestWalletIntent(trip,false),/EXPLICIT_WALLET_CONSENT_REQUIRED/);assert.equal(count,0);
 await c.requestWalletIntent(trip,true);assert.equal(count,1);
 let prepared=0;const result=await c.prepareWalletOperation(trip,{intent:{},wallet:{},consent:true,expectedIntentHash:'hash1',sessionKey:'session1',prepare:async({consent})=>{assert.equal(consent,true);prepared++;return {prepared:true};}});
 assert.equal(result.prepared,true);assert.equal(prepared,1);
});
test('denied role never reaches services',async()=>{
 let calls=0;current={role:'driver',subject:'driver1',accountId:'account1',sessionId:'session1'};
 const c=build({preparePayment:async()=>{calls++;}});
 await assert.rejects(c.requestWalletIntent(trip,true),/WALLET_DENIED/);assert.equal(calls,0);
 current={role:'rider',subject:'rider1',accountId:'account1',sessionId:'session1'};
});
test('travel requires explicit consent, signed SDK verification and excludes booking',async()=>{
 let calls=0;const travelSdk={prepare:async()=>{calls++;return {version:'1.0',handoffId:'handoff1',tripId:'trip1',tripRevision:1,expiresAt:130,context:{service:'LIFTd',kind:'travel_ground_connection',status:'preview_only',market:'CA-BC-Vancouver'}};},verify:async()=>({version:'1.0',handoffId:'handoff1',tripId:'trip1',tripRevision:1,expiresAt:130,context:{service:'LIFTd',kind:'travel_ground_connection',status:'preview_only',market:'CA-BC-Vancouver'}})};
 const c=build({},undefined,{travelSdk});
 await assert.rejects(c.travelPreview(trip,false),/TRAVEL_CONSENT_REQUIRED/);assert.equal(calls,0);
 const p=await c.travelPreview(trip,true);assert.equal(p.bookingEnabled,false);assert.equal(p.transactionEnabled,false);
});
test('notifications require explicit user permission; denial cannot register or confirm delivery',async()=>{
 let prompts=0;const c=build({}, {request:async()=>{prompts++;return false;}});
 await assert.rejects(c.requestNotifications(trip,false),/NOTIFICATION_PERMISSION_DENIED/);assert.equal(prompts,0);
 await assert.rejects(c.requestNotifications(trip,true),/NOTIFICATION_PERMISSION_DENIED/);assert.equal(prompts,1);
});
test('messages require active trip membership, preserve idempotency on failed send',async()=>{
 let n=0;const c=build({sendMessage:async(_s,_t,v)=>{n++;if(n===1)throw Error('OFFLINE');assert.equal(v.commandId,'command1');return {messageId:'msg1',status:'ACCEPTED'};}});
 await assert.rejects(c.sendMessage({...trip,state:'CANCELLED'},'Hi'),/MESSAGE_DENIED/);
 await assert.rejects(c.sendMessage(trip,'At pickup'),/OFFLINE/);
 await assert.rejects(c.sendMessage(trip,'Different'),/MESSAGE_RECONCILIATION_REQUIRED/);
 assert.equal((await c.sendMessage(trip,'At pickup')).status,'ACCEPTED');
});
test('service API rejects untrusted origins and absent auth before transmission',async()=>{
 for(const origin of ['http://example.org/','https://user:password@example.org/','https://example.org/path/'])assert.throws(()=>createMobileServiceApi({approvedOrigin:origin,tokenProvider:async()=>null}),/UNAPPROVED_ORIGIN/);
 let count=0;const api=createMobileServiceApi({approvedOrigin:'https://example.org/',tokenProvider:async()=>null,fetchImpl:async()=>{count++;}});
 await assert.rejects(api.readMessages({},'trip1'),/SESSION_UNAVAILABLE/);assert.equal(count,0);
});
