import {escapeHtml,button,card,emptyState,tabs} from './design-system.js';
import {normalizeProfileProjection,normalizeRelationshipProjection,relationshipActions,socialLists} from './profile-social.js';

function actionButtons(actions){
  return actions.map(action=>button({
    label:action.label,
    action:action.id,
    variant:action.destructive?'secondary':'primary',
    disabled:!action.enabled
  })).join('');
}

export function renderProfileView({
  profile,
  relationship=null,
  viewer=null,
  walletView=null,
  activeTab='activity'
}={}){
  if(!profile) return emptyState({title:'Profile unavailable',message:'No canonical profile projection was supplied.'});
  const p=normalizeProfileProjection(profile);
  const own=viewer&&viewer.toLowerCase()===p.account;
  const r=relationship?normalizeRelationshipProjection(relationship):null;
  const actions=relationshipActions(p,r,{
    connected:walletView?.connected===true,
    canWrite:walletView?.canWrite===true,
    isOwnProfile:own
  });
  const title=p.displayName||p.displayNameHash||p.account;
  const state=!p.active?'Inactive profile':r?.blockedByViewer?'Blocked':r?.friendState==='friends'?'Friends':r?.followState==='following'?'Following':'Canonical profile';

  return `<div class="profile-view">
    <section class="profile-hero">
      <div class="profile-banner" aria-label="Profile banner"></div>
      <div class="profile-summary">
        <div class="profile-avatar" aria-hidden="true">${escapeHtml(title.slice(0,2).toUpperCase())}</div>
        <div class="profile-summary__text">
          <p class="eyebrow">${escapeHtml(state)}</p>
          <h2>${escapeHtml(title)}</h2>
          <p class="profile-account">${escapeHtml(p.account)}</p>
          ${p.bio?`<p>${escapeHtml(p.bio)}</p>`:''}
        </div>
        <div class="profile-actions">${actionButtons(actions)}</div>
      </div>
    </section>
    ${tabs([{id:'activity',label:'Activity'},{id:'media',label:'Media'},{id:'about',label:'About'}],activeTab)}
    <section class="profile-tab-panel">
      ${activeTab==='about'
        ?card({title:'Profile authority',body:`<dl class="mini-grid"><div><dt>Status</dt><dd>${escapeHtml(p.status??'unknown')}</dd></div><div><dt>Profile type</dt><dd>${escapeHtml(p.profileType??'unknown')}</dd></div><div><dt>Metadata root</dt><dd>${escapeHtml(p.metadataRoot??'—')}</dd></div></dl>`})
        :emptyState({title:activeTab==='media'?'Media surface ready':'Activity surface ready',message:'Canonical feed/media projections are connected in BG-19.5.'})}
    </section>
  </div>`;
}

export function renderRelationshipLists({viewer,relationships,profiles,list='friends'}={}){
  const lists=socialLists({viewer,relationships,profiles});
  const items=lists[list]??[];
  if(!items.length) return emptyState({title:`No ${list}`,message:'The canonical relationship projection is currently empty.'});
  return `<div class="profile-list">${items.map(profile=>`
    <a class="profile-list__item" href="/profile?account=${encodeURIComponent(profile.account)}" data-profile-account="${escapeHtml(profile.account)}">
      <span class="profile-avatar profile-avatar--small" aria-hidden="true">${escapeHtml(profile.account.slice(2,4).toUpperCase())}</span>
      <span><strong>${escapeHtml(profile.displayName||profile.displayNameHash||profile.account)}</strong><small>${escapeHtml(profile.account)}</small></span>
    </a>`).join('')}</div>`;
}
