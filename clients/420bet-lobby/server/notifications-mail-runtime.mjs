import {readFile} from 'node:fs/promises';
import {createRemoteBetOwnershipResolver} from './ownership-resolver.mjs';
import {create420NotificationsConsentAuthority} from './notifications-consent-authority.mjs';
import {createIndexerEventReader} from './indexer-event-reader.mjs';
import {verifyConfiguredRegistry} from './verify-registry.mjs';
import {openBetDeliveryOutbox} from './notifications-mail-outbox.mjs';
import {create420MailProvider,create420NotificationsProvider} from './notifications-mail-adapters.mjs';
import {createFinalizedBetNotificationPublisher} from './notifications-mail-source.mjs';
const fail=(v,m)=>{if(!v)throw Error('420Bet Notifications/Mail runtime: '+m);};
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
 env=process.env,resolveAudience,checkConsent,authorizeMailActor,notifications,
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
 fail(typeof ownership==='function'&&typeof consent==='function'&&
  typeof authorizeMailActor==='function'&&notifications&&
  ['deliverAuthenticated','readReceipt','cancelDelivery'].every(k=>typeof notifications[k]==='function'),
  'qualified Identity, Notifications, consent and Mail providers required');
 const manifest=JSON.parse(await readFile(env.BET_INDEXER_EVENT_MANIFEST,'utf8'));
 const registry=await verifyRegistry({env,indexerManifest:manifest});
 fail(registry?.result?.qualified===true,'verified Registry unavailable');
 const reader=readerFactory({manifest,fetcher});
 const verifyEvent=async request=>{
  try{
   const before=await reader.readCheckpoint(env.BET_INDEXER_EVENT_CHECKPOINT);
   const observed=await reader.poll(before,{maxBlocks:64});
   if(observed.reorganized)return false;
   const e=request.event;
   return observed.state.events.some(x=>x.chainId===e.chainId&&
    x.blockNumber===e.blockNumber&&x.blockHash===e.blockHash&&
    x.transactionHash===e.transactionHash&&x.logIndex===e.logIndex&&
    TYPE_NAMES[x.type]===request.kind&&
    (!x.account||x.account.toLowerCase()===e.account.toLowerCase()));
  }catch{return false;}
 };
 const providers={
  mail:create420MailProvider({origin:env.BET_MAIL_URL,
   authorizeActor:authorizeMailActor,fetcher}),
  notifications:create420NotificationsProvider(notifications)
 };
 const outbox=await openBetDeliveryOutbox({path:env.BET_DELIVERY_OUTBOX_PATH,
  verifyEvent,checkConsent:consent,providers});
 const publisher=createFinalizedBetNotificationPublisher({
  reader,checkpointPath:env.BET_INDEXER_EVENT_CHECKPOINT,
  verifyRegistry:()=>verifyRegistry({env,indexerManifest:manifest}),
  resolveAudience:ownership,outbox});
 return Object.freeze({outbox,publish:publisher.publish,
  drain:args=>outbox.drain(args),stop:()=>outbox.close()});
}
