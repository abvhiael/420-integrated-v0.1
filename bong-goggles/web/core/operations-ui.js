import {card,emptyState,escapeHtml,button} from './design-system.js';
import {normalizeNotifications,normalizeRewards,normalizeSafetyCase} from './operations.js';
const e=escapeHtml;
const unavailable=(title,reason)=>card({title,body:emptyState({title:'Qualified projection unavailable',message:reason})});
export function renderNotifications({viewer=null,projection=null,walletView=null}={}){
 if(!walletView?.connected||!viewer)return unavailable('Notifications','Connect 420Wallet to view account-scoped notifications.');
 if(!projection)return unavailable('Notifications','The qualified notification service has not supplied a recipient-scoped page.');
 const page=normalizeNotifications({viewer,...projection});
 const body=page.items.length?page.items.map(n=>`<article class="ui-card notification-entry" data-notification-id="${e(n.id)}"><strong>${e(n.kind)}</strong> <span>${e(n.state.toLowerCase())}</span>${n.unread?'<span aria-label="Unread">Unread</span>':''}${n.route?`<a href="${e(n.route)}">View canonical item</a>`:''}</article>`).join(''):emptyState({title:'No notifications',message:'There are no notifications in the supplied canonical projection.'});
 return card({title:`Notifications (${page.unreadCount} unread on this page)`,body:`${body}${page.hasMore?button({label:'More notifications',action:'notifications-more',disabled:true}):''}<p>Retracted and superseded events cannot deep-link to stale content. Notification preferences are managed through 420Notifications.</p>`});
}
export function renderRewards({viewer=null,projection=null,walletView=null}={}){
 if(!walletView?.connected||!viewer)return unavailable('Rewards','Connect 420Wallet to view your reward history.');
 if(!projection)return unavailable('Rewards','The qualified shared rewards service has not supplied beneficiary-scoped records.');
 const page=normalizeRewards({viewer,...projection});
 const body=page.items.length?page.items.map(r=>`<article class="ui-card reward-entry" data-reward-id="${e(r.id)}"><strong>${e(r.contributionType||'Contribution')}</strong><p>Amount: ${e(r.amount)} (raw token units)</p><p>Status: ${e(r.status.toLowerCase())}</p>${r.claimable?button({label:'Claim via 420Wallet',action:'rewards-claim',disabled:true}):''}${r.paid?'<p>Paid according to supplied canonical payout state.</p>':''}</article>`).join(''):emptyState({title:'No reward history',message:'No canonical reward records are available.'});
 return card({title:'Rewards',body:`${body}<p>Contribution submission, earned value, claimable status and payment are distinct canonical stages. Game rewards remain deferred. Claim transaction wiring is unavailable until qualified contract deployment bindings and confirmation are integrated.</p>`});
}
export function renderSafety({viewer=null,projection=null,walletView=null}={}){
 if(!walletView?.connected||!viewer)return unavailable('Safety and appeals','Connect 420Wallet to view your account-scoped moderation cases.');
 if(!projection)return unavailable('Safety and appeals','No qualified moderation projection is available. Reports and appeals cannot be inferred locally.');
 if(!Array.isArray(projection.cases))throw new Error('invalid moderation case projection');
 const cases=projection.cases.map(x=>normalizeSafetyCase(x,viewer));
 const body=cases.length?cases.map(c=>`<article class="ui-card safety-entry" data-case-id="${e(c.id)}"><strong>Case ${e(c.id.slice(0,12))}…</strong><p>Status: ${e(c.status.toLowerCase())}</p>${c.appealAllowed?button({label:'Appeal through qualified moderation service',action:'safety-appeal',disabled:true}):''}<p>${c.decisionFinal?'Canonical final decision recorded.':'No local decision or appeal result is inferred.'}</p></article>`).join(''):emptyState({title:'No account-scoped cases',message:'No moderation cases were supplied for this account.'});
 return card({title:'Safety and appeals',body:`${body}<p>Report and appeal submission require the qualified moderation transport and current canonical permissions. This browser never finalizes a moderation outcome.</p>`});
}
export function renderOperationsRoute({kind,viewer=null,projection=null,walletView=null}={}){
 if(kind==='notifications')return renderNotifications({viewer,projection,walletView});
 if(kind==='rewards')return renderRewards({viewer,projection,walletView});
 if(kind==='safety')return renderSafety({viewer,projection,walletView});
 throw new Error('unsupported operations route');
}
