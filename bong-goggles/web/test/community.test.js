import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePage,normalizeGroup,normalizeGroupMember,normalizeEvent,normalizeRsvp,
  communityActions,prepareCommunityIntent,normalizeCommunityDirectory,canViewGroup,applyCommunityRefresh
} from '../core/community.js';
import {renderCommunityRoute,renderGroupDetail,renderEventDetail} from '../core/community-ui.js';

const A='0x1111111111111111111111111111111111111111';
const B='0x2222222222222222222222222222222222222222';
const X='0x'+'a'.repeat(64);
const Y='0x'+'b'.repeat(64);
const Z='0x'+'c'.repeat(64);

test('BG-19.6 normalizes canonical Page, Group, member, Event and RSVP projections',()=>{
  assert.equal(normalizePage({pageId:X,profileAccount:B,owner:A,active:true}).canonical,true);
  assert.equal(normalizeGroup({groupId:Y,owner:A,privacy:'PUBLIC',joinPolicy:'OPEN',active:true}).joinPolicy,'OPEN');
  assert.equal(normalizeGroupMember({groupId:Y,account:B,state:'ACTIVE',role:'MEMBER'}).state,'ACTIVE');
  assert.equal(normalizeEvent({eventId:Z,owner:A,hostType:'PROFILE',hostAccount:A,visibility:'PUBLIC',startsAt:10,endsAt:20,active:true}).startsAt,10);
  assert.equal(normalizeRsvp({eventId:Z,account:B,state:'GOING'}).state,'GOING');
});

test('BG-19.6 open and approval groups expose contract-supported join flows',()=>{
  const open=normalizeGroup({groupId:Y,owner:A,privacy:'PUBLIC',joinPolicy:'OPEN',active:true});
  let actions=communityActions({kind:'group',record:open,viewer:B,walletView:{connected:true,canWrite:true}});
  assert.equal(actions[0].id,'group-join');
  assert.equal(actions[0].label,'Join group');
  const approval=normalizeGroup({groupId:Y,owner:A,privacy:'PUBLIC',joinPolicy:'APPROVAL_REQUIRED',active:true});
  actions=communityActions({kind:'group',record:approval,viewer:B,walletView:{connected:true,canWrite:true}});
  assert.equal(actions[0].label,'Request to join');
});

test('BG-19.6 pending member can cancel and active member can leave',()=>{
  const group=normalizeGroup({groupId:Y,owner:A,privacy:'PUBLIC',joinPolicy:'APPROVAL_REQUIRED',active:true});
  const pending=normalizeGroupMember({groupId:Y,account:B,state:'PENDING',role:'NONE'});
  assert.equal(communityActions({kind:'group',record:group,member:pending,viewer:B,walletView:{connected:true,canWrite:true}})[0].label,'Cancel join request');
  const active=normalizeGroupMember({groupId:Y,account:B,state:'ACTIVE',role:'MEMBER'});
  assert.equal(communityActions({kind:'group',record:group,member:active,viewer:B,walletView:{connected:true,canWrite:true}})[0].label,'Leave group');
});

test('BG-19.6 private groups fail closed without active membership',()=>{
  const group=normalizeGroup({groupId:Y,owner:A,privacy:'PRIVATE',joinPolicy:'APPROVAL_REQUIRED',active:true});
  assert.equal(canViewGroup(group,null),false);
  assert.equal(canViewGroup(group,{groupId:Y,account:B,state:'PENDING',role:'NONE'}),false);
  assert.equal(canViewGroup(group,{groupId:Y,account:B,state:'ACTIVE',role:'MEMBER'}),true);
});

test('BG-19.6 blocked relationships suppress community actions',()=>{
  const group=normalizeGroup({groupId:Y,owner:A,privacy:'PUBLIC',joinPolicy:'OPEN',active:true});
  assert.deepEqual(communityActions({kind:'group',record:group,viewer:B,walletView:{connected:true,canWrite:true},blocked:true}).map(x=>x.id),['blocked']);
});

test('BG-19.6 event RSVP is intent and invite-only event exposes no RSVP controls',()=>{
  const publicEvent=normalizeEvent({eventId:Z,owner:A,hostType:'PROFILE',hostAccount:A,visibility:'PUBLIC',startsAt:10,endsAt:20,active:true});
  assert.equal(communityActions({kind:'event',record:publicEvent,viewer:B,walletView:{connected:true,canWrite:true}}).filter(x=>x.id.startsWith('rsvp:')).length,3);
  const invite=normalizeEvent({eventId:Z,owner:A,hostType:'PROFILE',hostAccount:A,visibility:'INVITE_ONLY',startsAt:10,endsAt:20,active:true});
  assert.equal(communityActions({kind:'event',record:invite,viewer:B,walletView:{connected:true,canWrite:true}}).filter(x=>x.id.startsWith('rsvp:')).length,0);
});

test('BG-19.6 community intents map only to qualified registry calls',()=>{
  const intent=prepareCommunityIntent({kind:'group',action:'join',actor:B,recordId:Y});
  assert.equal(intent.canonicalAction,'BongGogglesCommunityRegistry420.joinGroup');
  assert.equal(intent.requiresWalletApproval,true);
  assert.throws(()=>prepareCommunityIntent({kind:'group',action:'invite',actor:B,recordId:Y}),/unsupported community action/);
});

test('BG-19.6 directories filter inactive records and order events chronologically',()=>{
  const dir=normalizeCommunityDirectory({
    pages:[{pageId:X,profileAccount:B,owner:A,active:true}],
    groups:[{groupId:Y,owner:A,privacy:'PUBLIC',joinPolicy:'OPEN',active:false}],
    events:[
      {eventId:Z,owner:A,hostType:'PROFILE',hostAccount:A,visibility:'PUBLIC',startsAt:20,endsAt:30,active:true},
      {eventId:'0x'+'d'.repeat(64),owner:A,hostType:'PROFILE',hostAccount:A,visibility:'PUBLIC',startsAt:10,endsAt:15,active:true}
    ]
  });
  assert.equal(dir.pages.length,1);
  assert.equal(dir.groups.length,0);
  assert.equal(dir.events[0].startsAt,10);
});

test('BG-19.6 canonical refresh never carries optimistic state forward',()=>{
  const refreshed=applyCommunityRefresh({group:{groupId:Y,owner:A,privacy:'PUBLIC',joinPolicy:'OPEN',active:true}});
  assert.equal(refreshed.optimistic,false);
  assert.equal(refreshed.source,'canonical-refresh');
});

test('BG-19.6 route UI fails closed when canonical directory is absent',()=>{
  const html=renderCommunityRoute({kind:'pages'});
  assert.match(html,/Canonical directory unavailable/);
});

test('BG-19.6 group and event detail expose canonical policy language',()=>{
  const groupHtml=renderGroupDetail({group:{groupId:Y,owner:A,privacy:'PUBLIC',joinPolicy:'OPEN',active:true},viewer:B,walletView:{connected:true,canWrite:true}});
  assert.match(groupHtml,/Join group/);
  assert.match(groupHtml,/Canonical group feed/);
  const eventHtml=renderEventDetail({event:{eventId:Z,owner:A,hostType:'PROFILE',hostAccount:A,visibility:'PUBLIC',startsAt:10,endsAt:20,active:true},viewer:B,walletView:{connected:true,canWrite:true}});
  assert.match(eventHtml,/not attendance proof/);
  assert.match(eventHtml,/GOING/);
});
