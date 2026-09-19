import {card,emptyState,escapeHtml,button} from './design-system.js';
import {normalizeInbox,normalizeThread,messagingActions,messagingPresentationState} from './messaging.js';

export function renderInbox({viewer=null,inbox=null,walletView=null}={}){
 if(!walletView?.connected||!viewer)return card({title:'Private messages',body:emptyState({title:'Wallet required',message:'Connect 420Wallet to view your canonical conversation list.'})});
 if(!inbox)return card({title:'Private messages',body:emptyState({title:'Messaging service unavailable',message:'No canonical Messenger inbox projection is available. No local conversation history is synthesized.'})});
 const page=normalizeInbox({viewer,...inbox});
 if(!page.items.length)return card({title:'Private messages',body:emptyState({title:'No conversations',message:'Your canonical inbox contains no current conversations.'})});
 return `<section class="message-inbox" aria-label="Private conversations">${page.items.map(c=>`<a class="message-conversation" href="/messages?conversation=${encodeURIComponent(c.conversationId)}" data-conversation-id="${escapeHtml(c.conversationId)}"><strong>${escapeHtml(c.peer)}</strong><span>${escapeHtml(c.incomingRequest?'Incoming request':c.outgoingRequest?'Request sent':c.state.toLowerCase())}</span>${c.unreadCount?`<span class="message-unread" aria-label="${c.unreadCount} unread">${c.unreadCount}</span>`:''}</a>`).join('')}${page.hasMore?button({label:'More conversations',action:'messages-more',variant:'secondary'}):''}</section>`;
}

export function renderThread({viewer=null,conversation=null,envelopes=[],walletView=null,serviceReady=false,currentEligibility=false,deviceReady=false,epochCurrent=false}={}){
 const status=messagingPresentationState({connected:walletView?.connected===true,serviceReady,eligible:currentEligibility,deviceReady,epochCurrent});
 if(status!=='ready')return card({title:'Private conversation',body:emptyState({title:status.replaceAll('-',' '),message:'Private message content remains unavailable until the current Messenger, block-policy, device and epoch checks pass.'})});
 if(!conversation)return card({title:'Conversation unavailable',body:emptyState({title:'Canonical conversation missing',message:'No conversation was supplied by the qualified messaging service.'})});
 const thread=normalizeThread({conversation,viewer,envelopes,currentEligibility,deviceReady,epochCurrent});
 const actions=messagingActions({conversation,viewer,canWrite:walletView?.canWrite,currentEligibility,deviceReady,epochCurrent});
 return `<section class="message-thread" data-conversation-id="${escapeHtml(thread.conversation.conversationId)}"><header><strong>${escapeHtml(thread.conversation.peer)}</strong><span>${escapeHtml(thread.conversation.state)}</span></header><div class="message-timeline" aria-label="Canonical envelope metadata">${thread.entries.length?thread.entries.map(e=>`<article class="message-envelope" data-message-id="${escapeHtml(e.messageId)}"><span>${e.sender===viewer.toLowerCase()?'Sent':'Received'} · #${e.sequence}</span><small>${e.readAt?'Read':e.deliveredAt?'Delivered':'Committed'}</small><p>Encrypted message content is available only through the qualified device-local decryption path.</p></article>`).join(''):emptyState({title:'No messages yet',message:'No canonical envelopes are available for this conversation.'})}</div><div class="message-actions">${actions.map(a=>button({label:a.id.replaceAll('-',' '),action:`message:${a.id}`,disabled:!a.enabled})).join('')}</div><div class="message-compose"><label for="message-draft">New message</label><textarea id="message-draft" data-message-draft rows="3" autocomplete="off" placeholder="Device-local encryption required" disabled></textarea><p>Message text is never sent to the public indexer, browser telemetry or Wallet transaction calldata. Compose unlocks only after a qualified local encryption adapter is attached.</p></div></section>`;
}

export function renderMessagingRoute({viewer=null,projection=null,walletView=null}={}){
 if(projection?.conversation)return renderThread({viewer,conversation:projection.conversation,envelopes:projection.envelopes??[],walletView,serviceReady:projection.serviceReady===true,currentEligibility:projection.currentEligibility===true,deviceReady:projection.deviceReady===true,epochCurrent:projection.epochCurrent===true});
 return renderInbox({viewer,inbox:projection?.inbox??null,walletView});
}
