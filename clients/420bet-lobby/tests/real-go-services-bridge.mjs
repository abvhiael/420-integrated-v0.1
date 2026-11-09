// Cross-language Level 2: exercise actual Go HTTP handlers on ephemeral loopback
// servers, never fixtures pretending to be 420Mail or 420Notifications.
import assert from 'node:assert/strict';
import {openBetDeliveryOutbox} from '../server/notifications-mail-outbox.mjs';
import {create420MailProvider,create420NotificationsProvider} from '../server/notifications-mail-adapters.mjs';
import {createVerified420MailActorBroker} from '../server/mail-auth-broker.mjs';
import {create420NotificationsConsentAuthority} from '../server/notifications-consent-authority.mjs';
import {create420NotificationsRevocationReader,createBetRevocationConsumer} from '../server/notifications-revocation-consumer.mjs';
import {createGo420NotificationsAdapter} from '../server/notifications-go-provider.mjs';
const config=process.env;
const actualMail=config.LOCAL_GO_MAIL_URL,actualNotify=config.LOCAL_GO_NOTIFICATIONS_URL;
assert(actualMail?.startsWith('http://127.0.0.1:')||actualMail?.startsWith('http://[::1]:'));
assert(actualNotify?.startsWith('http://127.0.0.1:')||actualNotify?.startsWith('http://[::1]:'));
const mailOrigin='https://mail.local-qualification.invalid/';
const notifyOrigin='https://notifications.local-qualification.invalid/';
const proxy=async(uri,options)=>{
 const url=uri.replace('https://mail.local-qualification.invalid',actualMail)
  .replace('https://notifications.local-qualification.invalid',actualNotify);
 assert(url.startsWith(actualMail)||url.startsWith(actualNotify));
 const response=await fetch(url,options);
 if(!response.ok){
  const path=new URL(url).pathname;
  process.stderr.write('Go HTTP boundary rejected '+(options?.method??'GET')+' '+path+' status='+response.status+'\\n');
 }
 return response;
};
const mailBroker=createVerified420MailActorBroker({
 origin:mailOrigin,sender:'sender-id',serviceToken:config.LOCAL_GO_MAIL_TOKEN,fetcher:proxy});
const mail=create420MailProvider({origin:mailOrigin,
 authorizeActor:mailBroker.authorizeActor,fetcher:proxy});
const goNotifications=createGo420NotificationsAdapter({
 origin:notifyOrigin,serviceToken:config.LOCAL_GO_NOTIFICATION_DELIVERY_TOKEN,fetcher:proxy});
const notifications=create420NotificationsProvider(goNotifications);
const consent=create420NotificationsConsentAuthority({
 origin:notifyOrigin,bearerToken:config.LOCAL_GO_CONSENT_READ_TOKEN,fetcher:proxy});
const readRevocations=create420NotificationsRevocationReader({
 origin:notifyOrigin,bearerToken:config.LOCAL_GO_CONSENT_READ_TOKEN,fetcher:proxy});
const A='0x'+'a'.repeat(40),H=n=>'0x'+n.toString(16).padStart(64,'0');
function request(channel){
 return {tenant:'420bet',userId:'subject-1',channel,
  subscriptionId:channel==='mail'?'sub-mail':'sub-push',
  recipient:channel==='mail'?'recipient-1':'route-1',
  policyVersion:'p1',source:'420Indexer-finalized',kind:'wager-settled',
  finality:'finalized',event:{chainId:'420',gameId:'casino-dice',account:A,
   blockNumber:'24',blockHash:H(25),transactionHash:H(26),logIndex:'0'}};
}
const outboxArgs={path:config.LOCAL_GO_OUTBOX_PATH,verifyEvent:async()=>true,
 checkConsent:consent,providers:{mail,notifications},baseBackoffMs:50};
let outbox;
try{
 await mailBroker.checkReadiness();
 const unauth=await fetch(actualMail+'/v1/auth/actor',{headers:{'X-Test-Actor':'sender-id'}});
 assert.equal(unauth.status,401,'Mail trusted a spoofed identity header');
 const wrongMail=await fetch(actualMail+'/v1/auth/actor',{
  headers:{Authorization:'Bearer incorrect-token','X-Test-Actor':'sender-id'}});
 assert.equal(wrongMail.status,401,'Mail accepted an unapproved credential');
 const wrongSender=createVerified420MailActorBroker({origin:mailOrigin,
  sender:'attacker',serviceToken:config.LOCAL_GO_MAIL_TOKEN,fetcher:proxy});
 await assert.rejects(wrongSender.checkReadiness(),/does not match/);
 const writeWithReader=await fetch(actualNotify+'/v1/420bet/subscriptions/revoke',{
  method:'POST',headers:{Authorization:'Bearer '+config.LOCAL_GO_CONSENT_READ_TOKEN,
  'Content-Type':'application/json'},body:'{}'});
 assert.equal(writeWithReader.status,403,'Notifications read token authorized consent mutation');
 await assert.rejects(consent({tenant:'another',userId:'subject-1',subscriptionId:'sub-mail',
  recipient:'recipient-1',channel:'mail',kind:'wager-settled',policyVersion:'p1'}),/scope/);
 outbox=await openBetDeliveryOutbox(outboxArgs);
 const oldMail=await outbox.enqueue(request('mail'));
 const oldPush=await outbox.enqueue(request('notifications'));
 const delivered=await outbox.drain();
 assert.equal(delivered.delivered,1,'real Go Mail outbox was not delivered: '+JSON.stringify({
  result:delivered,mail:await outbox.get(oldMail.key),push:await outbox.get(oldPush.key)}));
 assert.equal(delivered.pending,1,'Go Notifications forged a delivered receipt');
 assert.equal((await outbox.get(oldMail.key)).status,'delivered');
 assert.equal((await outbox.get(oldPush.key)).status,'pending_receipt');
 await outbox.close();
 outbox=await openBetDeliveryOutbox(outboxArgs);
 assert.equal((await outbox.get(oldMail.key)).status,'delivered');
 assert.equal((await outbox.get(oldPush.key)).status,'pending_receipt');
 const revokeBody={check:{tenant:'420bet',userId:'subject-1',
  subscriptionId:'sub-push',recipient:'route-1',channel:'notifications',
  kind:'wager-settled',policyVersion:'p1'},expectedRevision:1};
 const revoke=await fetch(actualNotify+'/v1/420bet/subscriptions/revoke',{
  method:'POST',headers:{Authorization:'Bearer '+config.LOCAL_GO_CONSENT_WRITE_TOKEN,
   'Content-Type':'application/json'},body:JSON.stringify(revokeBody)});
 assert.equal(revoke.status,200,'actual Go consent revocation was refused');
 const consumer=createBetRevocationConsumer({readRevocations,outbox});
 const observed=await consumer.sync();
 assert.equal(observed.processed,1);
 assert.equal(await outbox.getRevocationCursor(),1);
 assert.equal((await outbox.get(oldPush.key)).status,'cancelled');
 assert.equal((await outbox.get(oldPush.key)).remoteCancellationPending,false);
 await assert.rejects(outbox.enqueue(request('notifications')),/consent denied|withdrawn/);
 assert.equal((await outbox.get(oldMail.key)).status,'delivered',
  'unrelated Mail delivery was cancelled');
 await assert.rejects(goNotifications.readReceipt({tenant:'420bet',userId:'forged-user',
  deliveryId:(await outbox.get(oldPush.key)).receipt.externalId,
  idempotencyKey:oldPush.key}),/unavailable/);
 assert.equal((await consumer.sync()).processed,0,'revocation was replayed twice');
 const summary=await outbox.summary();
 assert.equal(summary.byStatus.delivered,1);
 assert.equal(summary.byStatus.cancelled,1);
 process.stdout.write(JSON.stringify({passed:true,mailStatus:'delivered',
  notificationStatus:'cancelled',revocationCursor:await outbox.getRevocationCursor()})+'\n');
}finally{if(outbox)await outbox.close();}
