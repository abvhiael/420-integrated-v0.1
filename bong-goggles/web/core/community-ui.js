import {escapeHtml,button,card,emptyState} from './design-system.js';
import {normalizeCommunityDirectory,normalizePage,normalizeGroup,normalizeEvent,communityActions,canViewGroup} from './community.js';

function actionsHtml(actions){
  return actions.map(a=>button({label:a.label,action:a.id,disabled:!a.enabled,variant:a.id.includes('edit')?'secondary':'primary'})).join('');
}
function short(value){return value?value.slice(0,10)+'…':'—';}

export function renderCommunityDirectory({kind,records=[]}={}){
  const directory=normalizeCommunityDirectory({
    pages:kind==='pages'?records:[],
    groups:kind==='groups'?records:[],
    events:kind==='events'?records:[]
  });
  const items=directory[kind]??[];
  if(!items.length) return emptyState({title:`No ${kind}`,message:'No active canonical records are available in this projection.'});
  return `<div class="community-grid">${items.map(item=>{
    const id=item.pageId??item.groupId??item.eventId;
    const href=`/${kind}?id=${encodeURIComponent(id)}`;
    const owner=item.owner;
    const detail=kind==='groups'?`${item.privacy} · ${item.joinPolicy}`:kind==='events'?`${item.visibility} · starts ${item.startsAt}`:'Page';
    return `<a class="community-card" href="${href}">
      <span class="eyebrow">${escapeHtml(detail)}</span>
      <strong>${escapeHtml(short(id))}</strong>
      <small>Owner ${escapeHtml(short(owner))}</small>
    </a>`;
  }).join('')}</div>`;
}

export function renderPageDetail({page,viewer=null,walletView=null}={}){
  if(!page) return emptyState({title:'Page unavailable',message:'No canonical Page projection was supplied.'});
  const p=normalizePage(page);
  if(!p.active) return emptyState({title:'Page inactive',message:'This canonical Page is not active.'});
  return card({
    eyebrow:'Canonical Page',
    title:short(p.pageId),
    body:`<dl class="mini-grid">
      <div><dt>Profile</dt><dd>${escapeHtml(p.profileAccount)}</dd></div>
      <div><dt>Owner</dt><dd>${escapeHtml(p.owner)}</dd></div>
      <div><dt>Metadata</dt><dd>${escapeHtml(p.metadataRoot??'—')}</dd></div>
    </dl><div class="actions">${actionsHtml(communityActions({kind:'page',record:p,viewer,walletView}))}</div>`
  });
}

export function renderGroupDetail({group,member=null,viewer=null,walletView=null,blocked=false}={}){
  if(!group) return emptyState({title:'Group unavailable',message:'No canonical Group projection was supplied.'});
  const g=normalizeGroup(group);
  if(!canViewGroup(g,member)) return emptyState({title:'Group unavailable',message:'This private or inactive Group is not visible to the current canonical membership state.'});
  const actions=communityActions({kind:'group',record:g,viewer,walletView,member,blocked});
  return `<div class="community-detail">${card({
    eyebrow:`${g.privacy} group`,
    title:short(g.groupId),
    body:`<dl class="mini-grid">
      <div><dt>Join policy</dt><dd>${escapeHtml(g.joinPolicy)}</dd></div>
      <div><dt>Owner</dt><dd>${escapeHtml(g.owner)}</dd></div>
      <div><dt>Member state</dt><dd>${escapeHtml(member?.state??'NONE')}</dd></div>
      <div><dt>Role</dt><dd>${escapeHtml(member?.role??'NONE')}</dd></div>
    </dl><div class="actions">${actionsHtml(actions)}</div>`
  })}
  ${card({eyebrow:'Canonical group feed',title:'Group activity',body:emptyState({title:'Group feed ready',message:'Qualified group-feed projection is consumed here when supplied by the feed/indexer transport.'})})}</div>`;
}

export function renderEventDetail({event,rsvp=null,viewer=null,walletView=null,blocked=false}={}){
  if(!event) return emptyState({title:'Event unavailable',message:'No canonical Event projection was supplied.'});
  const e=normalizeEvent(event);
  if(!e.active) return emptyState({title:'Event inactive',message:'This canonical Event is no longer active.'});
  const actions=communityActions({kind:'event',record:e,viewer,walletView,rsvp,blocked});
  return card({
    eyebrow:`${e.visibility} event`,
    title:short(e.eventId),
    body:`<dl class="mini-grid">
      <div><dt>Host type</dt><dd>${escapeHtml(e.hostType)}</dd></div>
      <div><dt>Starts</dt><dd>${escapeHtml(e.startsAt)}</dd></div>
      <div><dt>Ends</dt><dd>${escapeHtml(e.endsAt)}</dd></div>
      <div><dt>RSVP</dt><dd>${escapeHtml(rsvp?.state??'NONE')}</dd></div>
    </dl><p class="detail">RSVP represents canonical intent only; it is not attendance proof.</p>
    <div class="actions">${actionsHtml(actions)}</div>`
  });
}

export function renderCommunityRoute({kind,records=null,detail=null,member=null,rsvp=null,viewer=null,walletView=null,blocked=false}={}){
  if(detail){
    if(kind==='pages') return renderPageDetail({page:detail,viewer,walletView});
    if(kind==='groups') return renderGroupDetail({group:detail,member,viewer,walletView,blocked});
    if(kind==='events') return renderEventDetail({event:detail,rsvp,viewer,walletView,blocked});
  }
  if(!records) return card({title:kind[0].toUpperCase()+kind.slice(1),body:emptyState({
    title:'Canonical directory unavailable',
    message:'The browser will not synthesize community records when a qualified projection is unavailable.'
  })});
  return card({eyebrow:'Canonical directory',title:kind[0].toUpperCase()+kind.slice(1),body:renderCommunityDirectory({kind,records})});
}
