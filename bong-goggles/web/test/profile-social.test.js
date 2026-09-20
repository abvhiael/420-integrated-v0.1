import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfileProjection,normalizeRelationshipProjection,relationshipActions,socialLists,applyCanonicalRefresh} from '../core/profile-social.js';
import {renderProfileView,renderRelationshipLists} from '../core/profile-ui.js';

const A='0x1111111111111111111111111111111111111111';
const B='0x2222222222222222222222222222222222222222';

test('BG-19.4 normalizes canonical profile projection without inventing fields',()=>{
  const profile=normalizeProfileProjection({account:B,active:true,profileType:'PERSON',handleHash:'0xname',metadataHash:'0xmeta'});
  assert.equal(profile.account,B);
  assert.equal(profile.active,true);
  assert.equal(profile.displayName,null);
  assert.equal(profile.displayNameHash,'0xname');
  assert.equal(profile.canonical,true);
});

test('BG-19.4 friend actions reflect canonical pending and accepted states',()=>{
  const profile=normalizeProfileProjection({account:B,active:true});
  let r=normalizeRelationshipProjection({viewer:A,subject:B,friendState:'pending-incoming'});
  let actions=relationshipActions(profile,r,{connected:true,canWrite:true});
  assert.deepEqual(actions.slice(0,2).map(a=>a.id),['friend-accept','friend-decline']);
  r=normalizeRelationshipProjection({viewer:A,subject:B,friendState:'friends'});
  actions=relationshipActions(profile,r,{connected:true,canWrite:true});
  assert.ok(actions.some(a=>a.id==='remove-friend'));
});

test('BG-19.4 follows support open/pending/accepted presentation',()=>{
  const profile=normalizeProfileProjection({account:B,active:true});
  const pending=normalizeRelationshipProjection({viewer:A,subject:B,followState:'pending-outgoing'});
  assert.ok(relationshipActions(profile,pending,{connected:true,canWrite:true}).some(a=>a.id==='follow-cancel'));
  const following=normalizeRelationshipProjection({viewer:A,subject:B,followState:'following'});
  assert.ok(relationshipActions(profile,following,{connected:true,canWrite:true}).some(a=>a.id==='unfollow'));
});

test('BG-19.4 blocking suppresses ordinary relationship actions',()=>{
  const profile=normalizeProfileProjection({account:B,active:true});
  const blocked=normalizeRelationshipProjection({viewer:A,subject:B,blockedByViewer:true,friendState:'friends',followState:'mutual'});
  assert.deepEqual(relationshipActions(profile,blocked,{connected:true,canWrite:true}).map(a=>a.id),['unblock']);
});

test('BG-19.4 relationship lists are deterministic canonical projections',()=>{
  const lists=socialLists({
    viewer:A,
    profiles:[{account:B,active:true,displayName:'Bob'}],
    relationships:[{viewer:A,subject:B,friendState:'friends',followState:'mutual',muted:true}]
  });
  assert.equal(lists.friends[0].account,B);
  assert.equal(lists.followers[0].account,B);
  assert.equal(lists.following[0].account,B);
  assert.equal(lists.muted[0].account,B);
});

test('BG-19.4 canonical refresh replaces instead of preserving optimistic relationship state',()=>{
  const refreshed=applyCanonicalRefresh(
    {relationship:{friendState:'pending-outgoing'}},
    {profile:{account:B,active:true},relationship:{viewer:A,subject:B,friendState:'none',followState:'none'}}
  );
  assert.equal(refreshed.relationship.friendState,'none');
  assert.equal(refreshed.optimistic,false);
  assert.equal(refreshed.source,'canonical-refresh');
});

test('BG-19.4 profile UI renders profile state and wallet-gated actions',()=>{
  const html=renderProfileView({
    profile:{account:B,active:true,displayName:'Bob'},
    relationship:{viewer:A,subject:B,friendState:'none',followState:'none'},
    viewer:A,
    walletView:{connected:true,canWrite:true}
  });
  assert.match(html,/Bob/);
  assert.match(html,/Add friend/);
  assert.match(html,/Follow/);
  assert.match(html,/Block/);
});

test('BG-19.4 disconnected profile UI leaves write actions disabled',()=>{
  const html=renderProfileView({
    profile:{account:B,active:true},
    relationship:{viewer:A,subject:B},
    viewer:A,
    walletView:{connected:false,canWrite:false}
  });
  assert.match(html,/disabled/);
});

test('BG-19.4 relationship-list UI renders canonical account links',()=>{
  const html=renderRelationshipLists({
    viewer:A,
    profiles:[{account:B,active:true,displayName:'Bob'}],
    relationships:[{viewer:A,subject:B,friendState:'friends'}],
    list:'friends'
  });
  assert.match(html,/Bob/);
  assert.match(html,/data-profile-account/);
});
