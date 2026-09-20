import {escapeHtml,button,card,emptyState,skeleton} from './design-system.js';
import {normalizeFeedPage,publicationState} from './feed-publishing.js';

function objectBody(item){
  return `<article class="feed-object" data-object-id="${escapeHtml(item.objectId)}">
    <header class="feed-object__header">
      <span class="profile-avatar profile-avatar--small" aria-hidden="true">${escapeHtml(item.author.slice(2,4).toUpperCase())}</span>
      <div><strong>${escapeHtml(item.author)}</strong><small>${escapeHtml(item.objectType)} · v${item.version}</small></div>
      <span class="feed-label">${escapeHtml(item.promotionLabel)}</span>
    </header>
    <div class="feed-object__body">
      ${item.contentHash?`<p>Content: <code>${escapeHtml(item.contentHash)}</code></p>`:'<p>Canonical social object</p>'}
      ${item.mediaRoot?`<div class="media-placeholder" data-media-root="${escapeHtml(item.mediaRoot)}">Qualified media manifest</div>`:''}
      ${item.sourceObjectId?`<p class="provenance">Source: ${escapeHtml(item.sourceObjectId)}</p>`:''}
    </div>
    <footer class="feed-actions">
      ${button({label:'React',action:`react:${item.objectId}`,variant:'ghost'})}
      ${button({label:'Comment',action:`comment:${item.objectId}`,variant:'ghost'})}
      ${button({label:'Repost',action:`repost:${item.objectId}`,variant:'ghost'})}
      ${button({label:'Quote',action:`quote:${item.objectId}`,variant:'ghost'})}
    </footer>
  </article>`;
}

export function renderComposer({walletView=null,draft=null,publication=null,upload=null}={}){
  const canWrite=walletView?.connected&&walletView?.canWrite;
  const state=publication?publicationState(publication):{status:'draft'};
  return `<section class="composer ui-card" aria-labelledby="composer-title">
    <div class="composer__head"><div><p class="eyebrow">Canonical publishing</p><h2 id="composer-title">Create post</h2></div><span class="status">${escapeHtml(state.status)}</span></div>
    <label class="field"><span>Post text</span><textarea data-composer-text rows="4" maxlength="5000" placeholder="What’s happening?">${escapeHtml(draft?.text??'')}</textarea></label>
    <div class="composer-row">
      <label class="field"><span>Audience</span><select data-composer-audience>
        <option value="PUBLIC">Public</option><option value="FRIENDS">Friends</option><option value="FOLLOWERS">Followers</option>
      </select></label>
      <div class="upload-state"><span>Media</span><strong>${escapeHtml(upload?.stage??'idle')}</strong><small>${upload?.progress??0}%</small></div>
    </div>
    <p class="detail">Publishing does not become canonical until Wallet approval and chain/indexer confirmation complete.</p>
    <div class="actions">${button({label:'Review in 420Wallet',action:'publish-review',disabled:!canWrite})}</div>
  </section>`;
}

export function renderFeed({page=null,loading=false,error=null}={}){
  if(loading) return card({title:'Loading feed',body:skeleton({lines:6})});
  if(error) return card({title:'Feed unavailable',body:`<div class="ui-error" role="alert"><p>${escapeHtml(error)}</p></div>`});
  if(!page) return card({title:'Home feed',body:emptyState({title:'Canonical feed unavailable',message:'Bong Goggles will not synthesize feed entries when the qualified projection transport is unavailable.'})});
  const normalized=normalizeFeedPage(page);
  if(!normalized.items.length) return card({title:'Home feed',body:emptyState({title:'No posts yet',message:'The canonical feed projection is empty for this snapshot.'})});
  return `<section class="feed-list" aria-label="Home feed">
    ${normalized.items.map(objectBody).join('')}
    ${normalized.hasMore?button({label:'Load more',action:'feed-more',variant:'secondary'}):''}
    ${normalized.freshness?`<p class="feed-freshness">Indexed block: ${escapeHtml(normalized.freshness.indexedBlock??normalized.snapshotBlock??'—')}</p>`:''}
  </section>`;
}

export function renderStories({items=[]}={}){
  if(!Array.isArray(items)||!items.length) return '';
  return `<section class="stories" aria-label="Stories">${items.map(item=>`
    <button class="story" data-story-id="${escapeHtml(item.objectId)}">
      <span class="profile-avatar">${escapeHtml(item.author.slice(2,4).toUpperCase())}</span>
      <small>${escapeHtml(item.author.slice(0,8))}</small>
    </button>`).join('')}</section>`;
}
