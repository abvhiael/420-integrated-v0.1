const ID=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const STATES=new Set(['REQUESTED','ACTIVE','CLOSED']);
const FORBIDDEN=/(plaintext|ciphertext|messageBody|body|privateKey|secret|token|cookie|sessionKey|signedUrl|providerUrl|payloadBytes|decryptionKey)/i;
function address(value,field){if(typeof value!=='string'||!ADDRESS.test(value))throw new Error(`invalid ${field}`);return value.toLowerCase();}
function id(value,field){if(typeof value!=='string'||!ID.test(value))throw new Error(`invalid ${field}`);return value.toLowerCase();}
function count(value,field){const n=Number(value??0);if(!Number.isSafeInteger(n)||n<0)throw new Error(`invalid ${field}`);return n;}
function state(value){const v=typeof value==='number'?({1:'REQUESTED',2:'ACTIVE',3:'CLOSED'}[value]):String(value??'').toUpperCase();if(!STATES.has(v))throw new Error('invalid conversation state');return v;}
function assertPublicMetadata(value,path='projection'){
 if(Array.isArray(value)){value.forEach((v,i)=>assertPublicMetadata(v,`${path}[${i}]`));return;}
 if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){if(FORBIDDEN.test(k))throw new Error(`private field in ${path}.${k}`);assertPublicMetadata(v,`${path}.${k}`);}
}
export function normalizeConversation(record,viewer){
 assertPublicMetadata(record);
 const account=address(viewer,'viewer'),a=address(record.a,'a'),b=address(record.b,'b');
 if(a===b||(account!==a&&account!==b))throw new Error('viewer is not a participant');
 const requestedBy=address(record.requestedBy??record.requested_by,'requestedBy');
 if(requestedBy!==a&&requestedBy!==b)throw new Error('requester is not a participant');
 const s=state(record.state);
 return Object.freeze({conversationId:id(record.conversationId??record.conversation_id,'conversationId'),peer:account===a?b:a,state:s,requestedBy,incomingRequest:s==='REQUESTED'&&requestedBy!==account,outgoingRequest:s==='REQUESTED'&&requestedBy===account,unreadCount:count(record.unreadCount,'unreadCount'),lastMessageAt:count(record.lastMessageAt,'lastMessageAt'),authoritative:false});
}
export function normalizeInbox({viewer,items=[],cursor=null,hasMore=false}={}){
 if(!Array.isArray(items))throw new Error('invalid inbox');
 const normalized=items.map(item=>normalizeConversation(item,viewer));
 normalized.sort((a,b)=>Number(b.incomingRequest)-Number(a.incomingRequest)||b.lastMessageAt-a.lastMessageAt||a.conversationId.localeCompare(b.conversationId));
 return Object.freeze({items:Object.freeze(normalized),cursor,hasMore:hasMore===true,authoritative:false});
}
export function normalizeThread({conversation,viewer,envelopes=[],currentEligibility=false,deviceReady=false,epochCurrent=false}={}){
 const c=normalizeConversation(conversation,viewer);
 if(!Array.isArray(envelopes))throw new Error('invalid envelopes');
 const eligible=c.state==='ACTIVE'&&currentEligibility===true&&deviceReady===true&&epochCurrent===true;
 if(!eligible&&envelopes.length)throw new Error('private thread authorization unavailable');
 const seen=new Set();
 const entries=envelopes.map(e=>{
  assertPublicMetadata(e);
  const messageId=id(e.messageId??e.message_id,'messageId');
  if(seen.has(messageId))throw new Error('duplicate message identity');seen.add(messageId);
  if(id(e.conversationId??e.conversation_id,'conversationId')!==c.conversationId)throw new Error('envelope conversation mismatch');
  const sender=address(e.sender,'sender');if(sender!==c.peer&&sender!==address(viewer,'viewer'))throw new Error('envelope participant mismatch');
  const deliveredAt=count(e.deliveredAt,'deliveredAt'),readAt=count(e.readAt,'readAt');
  if(readAt&&!deliveredAt)throw new Error('read receipt requires delivery');
  return Object.freeze({messageId,sender,sequence:count(e.sequence,'sequence'),committedAt:count(e.committedAt,'committedAt'),deliveredAt,readAt,authoritative:false});
 });
 entries.sort((a,b)=>a.sequence-b.sequence||a.messageId.localeCompare(b.messageId));
 return Object.freeze({conversation:c,entries:Object.freeze(entries),eligible,authoritative:false});
}
export function messagingActions({conversation,viewer,canWrite=false,currentEligibility=false,deviceReady=false,epochCurrent=false}={}){
 const c=normalizeConversation(conversation,viewer);
 const allowed=canWrite===true&&currentEligibility===true;
 if(c.state==='CLOSED')return Object.freeze([]);
 if(c.incomingRequest)return Object.freeze([{id:'accept-request',enabled:allowed,canonicalAction:'MessengerConversationRegistry420.acceptConversation'}]);
 if(c.outgoingRequest)return Object.freeze([{id:'request-pending',enabled:false}]);
 return Object.freeze([{id:'send',enabled:allowed&&deviceReady===true&&epochCurrent===true,canonicalAction:'MessengerEnvelopeRegistry420.commitEnvelope'},{id:'close',enabled:allowed,canonicalAction:'MessengerConversationRegistry420.closeConversation'}]);
}
export function prepareMessagingIntent({kind,conversationId,actor,sequence=null,epochCommitment=null}={}){
 const map={'accept-request':'MessengerConversationRegistry420.acceptConversation',send:'MessengerEnvelopeRegistry420.commitEnvelope',close:'MessengerConversationRegistry420.closeConversation',acknowledge:'MessengerReceiptRegistry420.acknowledge'};
 if(!map[kind])throw new Error('unsupported messaging action');
 if(kind==='send'&&(!Number.isSafeInteger(sequence)||sequence<1||!epochCommitment))throw new Error('canonical sequence and current epoch required');
 return Object.freeze({schema:'bg-messaging-intent-v1',kind,conversationId:id(conversationId,'conversationId'),actor:address(actor,'actor'),sequence,epochCommitment:epochCommitment?id(epochCommitment,'epochCommitment'):null,canonicalAction:map[kind],requiresWalletApproval:true,authoritative:false});
}
export function messagingPresentationState({connected=false,serviceReady=false,deviceReady=false,epochCurrent=false,eligible=false}={}){
 if(!connected)return 'wallet-required';if(!serviceReady)return 'service-unavailable';if(!eligible)return 'access-denied';if(!deviceReady)return 'device-not-ready';if(!epochCurrent)return 'epoch-stale';return 'ready';
}
