import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFeedPage,createFeedCursorRequest,prepareComposerDraft,composerCanonicalAction,
  publicationState,prepareInteraction,canonicalRefreshFeed,normalizeMediaUploadState
} from '../core/feed-publishing.js';
import {renderComposer,renderFeed,renderStories} from '../core/feed-ui.js';

const A='0x1111111111111111111111111111111111111111';
const O='0x'+'a'.repeat(64);
const H='0x'+'b'.repeat(64);
const M='0x'+'c'.repeat(64);

test('BG-19.5 normalizes canonical feed pages and filters unavailable objects',()=>{
  const page=normalizeFeedPage({feedClass:'HOME',items:[
    {objectId:O,author:A,status:'ACTIVE',contentHash:H,version:1},
    {objectId:'0x'+'d'.repeat(64),author:A,status:'DELETED',version:1}
  ],hasMore:true});
  assert.equal(page.items.length,1);
  assert.equal(page.items[0].canonical,true);
  assert.equal(page.hasMore,true);
});

test('BG-19.5 feed cursor requests are bounded and non-authoritative',()=>{
  assert.deepEqual(createFeedCursorRequest({feedClass:'HOME',limit:20}),{feedClass:'HOME',cursor:null,limit:20,authoritative:false});
  assert.throws(()=>createFeedCursorRequest({limit:101}),/invalid feed limit/);
});

test('BG-19.5 composer validates comment, repost, quote and media semantics',()=>{
  const post=prepareComposerDraft({author:A,text:'hello',contentHash:H,audienceType:'PUBLIC'});
  assert.equal(composerCanonicalAction(post),'BongGogglesSocialObjectRegistry420.publish');
  assert.throws(()=>prepareComposerDraft({author:A,objectType:'COMMENT',text:'reply'}),/comment parent/);
  const repost=prepareComposerDraft({author:A,objectType:'REPOST',sourceObjectId:O});
  assert.equal(composerCanonicalAction(repost),'BongGogglesSocialObjectRegistry420.repost');
  const quote=prepareComposerDraft({author:A,objectType:'QUOTE_POST',sourceObjectId:O,text:'quote',contentHash:H,mediaRoot:M});
  assert.equal(composerCanonicalAction(quote),'BongGogglesSocialObjectRegistry420.quotePost');
});

test('BG-19.5 publication state never treats pending Wallet submission as canonical',()=>{
  const draft=prepareComposerDraft({author:A,text:'hello',contentHash:H});
  assert.equal(publicationState({draft,transaction:{status:'pending'}}).canonical,false);
  assert.equal(publicationState({draft,transaction:{status:'rejected'}}).status,'rejected');
  assert.equal(publicationState({draft,transaction:{status:'reverted'}}).status,'reverted');
  const confirmed=publicationState({draft,projection:{objectId:O,author:A,status:'ACTIVE',version:1}});
  assert.equal(confirmed.canonical,true);
  assert.equal(confirmed.status,'confirmed');
});

test('BG-19.5 interactions map only to qualified canonical actions',()=>{
  assert.equal(prepareInteraction({actor:A,objectId:O,kind:'reaction',reactionType:'LIKE'}).canonicalAction,'BongGogglesReactionRegistry420.setReaction');
  assert.equal(prepareInteraction({actor:A,objectId:O,kind:'comment'}).canonicalAction,'BongGogglesSocialObjectRegistry420.publish');
  assert.equal(prepareInteraction({actor:A,objectId:O,kind:'repost'}).canonicalAction,'BongGogglesSocialObjectRegistry420.repost');
  assert.equal(prepareInteraction({actor:A,objectId:O,kind:'tag',tagTarget:A,tagTargetType:'PROFILE'}).canonicalAction,'BongGogglesTagRegistry420.createTag');
  assert.throws(()=>prepareInteraction({actor:A,objectId:O,kind:'like-locally'}),/unsupported interaction/);
});

test('BG-19.5 canonical refresh replaces optimistic feed state',()=>{
  const next={feedClass:'HOME',items:[{objectId:O,author:A,status:'ACTIVE',version:1}]};
  const refreshed=canonicalRefreshFeed({items:[{fake:true}]},next);
  assert.equal(refreshed.optimistic,false);
  assert.equal(refreshed.source,'canonical-refresh');
  assert.equal(refreshed.items.length,1);
});

test('BG-19.5 media upload state distinguishes transport from canonical readiness',()=>{
  assert.equal(normalizeMediaUploadState({stage:'uploading',progress:42}).ready,false);
  assert.equal(normalizeMediaUploadState({stage:'ready',progress:100,mediaRoot:M}).ready,true);
  assert.throws(()=>normalizeMediaUploadState({stage:'ready',progress:101,mediaRoot:M}),/upload progress/);
});

test('BG-19.5 composer disables publication without qualified Wallet write access',()=>{
  const html=renderComposer({walletView:{connected:false,canWrite:false}});
  assert.match(html,/Review in 420Wallet/);
  assert.match(html,/disabled/);
  assert.match(html,/does not become canonical/);
});

test('BG-19.5 feed UI exposes provenance, media and interactions',()=>{
  const html=renderFeed({page:{feedClass:'HOME',items:[{objectId:O,author:A,status:'ACTIVE',contentHash:H,mediaRoot:M,sourceObjectId:'0x'+'d'.repeat(64),version:2}]}});
  assert.match(html,/Qualified media manifest/);
  assert.match(html,/Source:/);
  assert.match(html,/React/);
  assert.match(html,/Comment/);
  assert.match(html,/Repost/);
});

test('BG-19.5 story strip renders canonical story objects only when supplied',()=>{
  const html=renderStories({items:[{objectId:O,author:A}]});
  assert.match(html,/data-story-id/);
  assert.equal(renderStories({items:[]}), '');
});
