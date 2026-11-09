import {readFile} from 'node:fs/promises';
import {createRemoteBetOwnershipResolver} from './ownership-resolver.mjs';
import {createVerified420MailActorBroker} from './mail-auth-broker.mjs';
import {create420NotificationsConsentAuthority} from './notifications-consent-authority.mjs';
import {create420NotificationsRevocationReader,createBetRevocationConsumer} from './notifications-revocation-consumer.mjs';
import {createIndexerEventReader} from './indexer-event-reader.mjs';
import {verifyConfiguredRegistry} from './verify-registry.mjs';
import {openBetDeliveryOutbox} from './notifications-mail-outbox.mjs';
import {create420MailProvider,create420NotificationsProvider,canonicalBetEventId} from './notifications-mail-adapters.mjs';
import {assertIndexerRegistryBinding} from './registry-verifier.mjs';
import {createFinalizedBetNotificationPublisher} from './notifications-mail-source.mjs';
const fail=(v,m)=>{if(!v)throw Error('420Bet Notifications/Mail runtime: '+m);};
const VERTICAL={'casino-router':'casino','casino-settlement':'casino',
 'poker-ledger':'poker','poker-canonical':'poker','fantasy-contest':'fantasy',
 'sports-tickets':'sportsbook'};
const TYPE_NAMES={WAGER_ACCEPTED:'wager-accepted',WAGER_SETTLED:'wager-settled',
 WAGER_VOIDED:'wager-voided',POKER_HAND_SETTLED:'poker-hand-settled',
 POKER_HAND_CANCELLED:'poker-hand-cancelled',FANTASY_ENTRY_ACCEPTED:'fantasy-entry-accepted',
 FANTASY_POOL_SETTLED:'fantasy-pool-settled',FANTASY_POOL_CANCELLED:'fantasy-pool-cancelled',
 SPORTS_TICKET_FUNDED:'sports-ticket-funded',SPORTS_TICKET_SETTLED:'sports-ticket-settled',
 SPORTS_TICKET_FINALIZED:'sports-ticket-finalized'};
/**
 * Operator-injected service bindings are explicit:
 * - resolveAudience: independent authenticated 420Identity entitlement/ownership resolver
 * - checkConsent: private 420Notifications subscription/tenant consent authority
 * - authorizeMailActor: 420Mail authenticated sender/token broker
 * - notifications: qualified 420Notifications delivery/receipt/cancel adapter callbacks
 * Unconfigured service MUST fail before running any outbound transport.
 */
export async function createBetNotificationsMailRuntime({
 env=process.env,resolveAudience,checkConsent,readRevocations,authorizeMailActor,notifications,
 fetcher=fetch,verifyRegistry=verifyConfiguredRegistry,
 readerFactory=createIndexerEventReader
}={}){
 fail(typeof env.BET_INDEXER_EVENT_MANIFEST==='string'&&
  typeof env.BET_INDEXER_EVENT_CHECKPOINT==='string'&&
  typeof env.BET_DELIVERY_OUTBOX_PATH==='string'&&
  typeof env.BET_MAIL_URL==='string','missing approved paths or Mail endpoint');
 const ownership=resolveAudience??(env.BET_OWNERSHIP_AUTHORITY_URL&&env.BET_OWNERSHIP_AUTHORITY_TOKEN&&
  env.BET_OWNERSHIP_CHAIN_ID?createRemoteBetOwnershipResolver({
   origin:env.BET_OWNERSHIP_AUTHORITY_URL,bearerToken:env.BET_OWNERSHIP_AUTHORITY_TOKEN,
   chainId:env.BET_OWNERSHIP_CHAIN_ID,fetcher}):null);
 const consent=checkConsent??(env.BET_NOTIFICATIONS_CONSENT_URL&&env.BET_NOTIFICATIONS_CONSENT_TOKEN?
  create420NotificationsConsentAuthority({origin:env.BET_NOTIFICATIONS_CONSENT_URL,
   bearerToken:env.BET_NOTIFICATIONS_CONSENT_TOKEN,fetcher}):null);
 const verifiedMail=authorizeMailActor?null:
  (env.BET_MAIL_SENDER_ID&&env.BET_MAIL_ACTOR_TOKEN?
   createVerified420MailActorBroker({origin:env.BET_MAIL_URL,
    sender:env.BET_MAIL_SENDER_ID,serviceToken:env.BET_MAIL_ACTOR_TOKEN,fetcher}):null);
 const mailBroker=authorizeMailActor??verifiedMail?.authorizeActor??null;
 fail(typeof ownership==='function'&&typeof consent==='function'&&
  typeof mailBroker==='function'&&notifications&&
  ['deliverAuthenticated','readReceipt','cancelDelivery'].every(k=>typeof notifications[k]==='function'),
  'qualified Identity, Notifications, consent and Mail providers required');
 // Verify the actual authenticated 420Mail actor before opening delivery state.
 if(verifiedMail)await verifiedMail.checkReadiness();
 const manifest=JSON.parse(await readFile(env.BET_INDEXER_EVENT_MANIFEST,'utf8'));
 const registry=await verifyRegistry({env,indexerManifest:manifest});
 fail(registry?.result?.qualified===true,'verified Registry unavailable');
 const reader=readerFactory({manifest,fetcher});
 const verifyEvent=async request=>{
  try{
   const before=await reader.readCheckpoint(env.BET_INDEXER_EVENT_CHECKPOINT);
   const observed=await reader.poll(before,{maxBlocks:64});
   if(observed.reorganized)throw Error('canonical source reorganized during verification');
   const e=request.event;
   return observed.state.events.some(x=>x.chainId===e.chainId&&
    x.blockNumber===e.blockNumber&&x.blockHash===e.blockHash&&
    x.transactionHash===e.transactionHash&&x.logIndex===e.logIndex&&
    TYPE_NAMES[x.type]===request.kind&&
    (!x.account||x.account.toLowerCase()===e.account.toLowerCase()));
  }catch{
   // No stale original can escape if the chain changes between the publisher
   // scan and per-recipient verification. Freeze all transports durably.
   await outbox.haltForReorg();
   return false;
  }
 };
 const providers={
  mail:create420MailProvider({origin:env.BET_MAIL_URL,
   authorizeActor:mailBroker,fetcher}),
  notifications:create420NotificationsProvider(notifications)
 };
 const outbox=await openBetDeliveryOutbox({path:env.BET_DELIVERY_OUTBOX_PATH,
  verifyEvent,checkConsent:consent,providers});
 const revocations=readRevocations??(env.BET_NOTIFICATIONS_CONSENT_URL&&env.BET_NOTIFICATIONS_CONSENT_TOKEN?
  create420NotificationsRevocationReader({origin:env.BET_NOTIFICATIONS_CONSENT_URL,
   bearerToken:env.BET_NOTIFICATIONS_CONSENT_TOKEN,fetcher}):null);
 fail(typeof revocations==='function','trusted revocation feed required');
 const revocationConsumer=createBetRevocationConsumer({readRevocations:revocations,outbox});
 const publisher=createFinalizedBetNotificationPublisher({
  reader,checkpointPath:env.BET_INDEXER_EVENT_CHECKPOINT,
  persistCheckpoint:reader.persistCheckpoint,
  verifyRegistry:()=>verifyRegistry({env,indexerManifest:manifest}),
  resolveAudience:ownership,outbox});
 const interval=Number(env.BET_REVOCATION_POLL_MS??1000);
 fail(Number.isSafeInteger(interval)&&interval>=250&&interval<=60000,
  'invalid revocation poll interval');
 // Startup must catch up before any new recipient delivery. Thereafter the
 // monitor independently reconciles revocations, even while traffic is idle.
 await revocationConsumer.sync();
 let polling=null,stopped=false,lastRevocationFailure=false;
 const sync=async args=>{
  if(polling)return polling;
  polling=(async()=>{
   const result=await revocationConsumer.sync(args);
   const remoteRetry=await outbox.retryRemoteCancellations();
   lastRevocationFailure=false;
   return {...result,remoteRetry};
  })();
  try{return await polling;}catch(error){lastRevocationFailure=true;throw error;}
  finally{polling=null;}
 };
 const timer=setInterval(()=>{if(!stopped)void sync().catch(()=>{
  // Preserve fail-closed state and retry at the next poll without logging secrets.
  lastRevocationFailure=true;
 });},interval);
 timer.unref?.();
 // Recover from finalized-source reorganization by independently rebuilding
 // the complete verified canonical event set before releasing the outbox.
 async function recoverReorganization(){
  const state=await outbox.summary();
  fail(state.halted||state.replayPending,'no canonical recovery required');
  fail(typeof reader.persistCheckpoint==='function','durable canonical checkpoint writer required');
  const fresh=await verifyRegistry({env,indexerManifest:manifest});
  fail(fresh?.result?.qualified===true&&fresh.config,'unqualified recovery Registry');
  assertIndexerRegistryBinding(reader.config,fresh.config);
  let canonical=await reader.readCheckpoint(env.BET_INDEXER_EVENT_CHECKPOINT);
  let complete=false;
  for(let i=0;i<512;i++){
   const scanned=await reader.poll(canonical,{maxBlocks:64});
   canonical=scanned.state;
   if(scanned.complete===true){complete=true;break;}
   fail(scanned.scanned>0,'canonical replay did not progress');
  }
  fail(complete,'canonical replay incomplete; deliveries remain halted');
  const reconfirm=await verifyRegistry({env,indexerManifest:manifest});
  fail(reconfirm?.result?.qualified===true&&reconfirm.config,
   'recovery Registry approval changed');
  assertIndexerRegistryBinding(reader.config,reconfirm.config);
  fail(JSON.stringify(fresh.config)===JSON.stringify(reconfirm.config),
   'recovery Registry identity changed during replay');
  const canonicalIds=new Set();
  for(const event of canonical.events){
   const source=reader.config.contracts.find(x=>x.address===event.contract&&x.role===event.role);
   const kind=TYPE_NAMES[event.type],vertical=VERTICAL[event.role];
   if(!source||!kind||!vertical)continue;
   const games=reconfirm.config.games.filter(game=>game.vertical===vertical&&
    (!event.gameVersionId||game.gameVersionId===event.gameVersionId));
   for(const game of games)canonicalIds.add(canonicalBetEventId({
    chainId:event.chainId,gameId:game.id,transactionHash:event.transactionHash,
    logIndex:event.logIndex,type:kind,blockHash:event.blockHash
   }));
  }
  // The durable cursor is advanced first while outbox remains halted/pending.
  // If the process dies before full reprojection, replayPending survives.
  await reader.persistCheckpoint(env.BET_INDEXER_EVENT_CHECKPOINT,canonical);
  const reconciliation=await outbox.reconcileCanonicalReplay({
   canonicalEventIds:[...canonicalIds],
   verifyCanonicalRebuild:async()=>true
  });
  const projected=await publisher.replayCanonicalEvents(canonical.events);
  await outbox.finishCanonicalReplay();
  return Object.freeze({...reconciliation,projected:projected.queued,
   skipped:projected.skipped,canonicalEvents:canonical.events.length});
 }
 return Object.freeze({outbox,
  revocationHealth:()=>({failed:lastRevocationFailure,stopped}),
  // Always catch up revoked subscriptions before publishing or dispatching.
  syncRevocations:args=>sync(args),
  recoverReorganization,
  publish:async args=>{
   await sync();
   const status=await outbox.summary();
   if(status.halted||status.replayPending){const r=await recoverReorganization();
    return {reorganized:true,halted:false,queued:r.projected,recovered:true};}
   const published=await publisher.publish(args);
   if(published.reorganized){const r=await recoverReorganization();
    return {reorganized:true,halted:false,queued:r.projected,recovered:true};}
   return published;
  },
  drain:async args=>{await sync();return outbox.drain(args);},
  // Invoke only from a trusted, authenticated 420Notifications revocation controller.
  revokeSubscription:scope=>outbox.revokeSubscription(scope),
  stop:async()=>{stopped=true;clearInterval(timer);if(polling)await polling.catch(()=>{});await outbox.close();}});
}
