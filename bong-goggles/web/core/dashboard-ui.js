import {escapeHtml,card,linkButton} from './design-system.js';
import {renderCommunityDirectory} from './community-ui.js';
import {renderRecommendations} from './discovery-ui.js';
import {APP_ART,selectGreeting,greetingSrc} from './dashboard-art.js';
const featured=[["420Exchange","https://420exchange.420integrated.org/"],["420Pay","https://420pay.420integrated.org/"],["420TownSquare","https://town.420integrated.org/"],["DoobTube","https://doobtube.420integrated.org/"],["PuffBuddies","https://puffbuddies.420integrated.org/"],["420Media","https://420media.420integrated.org/"],["420Hz","https://420hz.420integrated.org/"]];
const extra=[["420Travel","https://420travel.420integrated.org/"],["20Mail","https://420mail.420integrated.org/"],["420Grow","https://grow.420integrated.org/"],["DOOBr","https://doobr.420integrated.org/"],["Liftd","https://liftd.420integrated.org/"],["420BnB","https://420bnb.420integrated.org/"],["420Bet","https://420bet.420integrated.org/"]];
export const NAV_LABELS=Object.freeze({home:'Feed',profile:'My Profile',groups:'Communities',pages:'Pages'});
export function appIcon(name){const key=Object.hasOwn(APP_ART,name)?APP_ART[name]:APP_ART['More dApps'];return '<img class="ecosystem-icon" src="/assets/apps/'+key+'.webp" width="32" height="32" alt="" decoding="async">';}
export function topNavigation(nav,active){
 const items=['home','games','groups','discover','messages','notifications'].map(id=>nav.find(x=>x.id===id));
 return '<nav class="dashboard-topnav" aria-label="Primary header">'+items.map(x=>'<a href="'+x.path+'" data-route="'+x.id+'" aria-current="'+(active===x.id?'page':'false')+'"><span aria-hidden="true">'+escapeHtml(x.icon)+'</span>'+escapeHtml(x.id==='home'?'Home':NAV_LABELS[x.id]??x.label)+'</a>').join('')+'</nav>';
}
export function profileSummary(wallet,profile,walletHref,accountSocialState=null){
 const connected=wallet?.connected===true;
 const socialProfile=accountSocialState?.status==='ready'?accountSocialState.profile:null;
 const own=connected&&typeof profile?.account==='string'&&profile.account.toLowerCase()===wallet.account?.toLowerCase();
 const name=own&&profile.displayName?profile.displayName:connected?'My account':socialProfile?.displayName??'Welcome, guest';
 const detail=connected?String(wallet.account).slice(0,6)+'…'+String(wallet.account).slice(-4):socialProfile?'420ID account · wallet optional':'Explore the community';
 const route=!connected&&socialProfile?'social':'profile';
 return '<section class="dashboard-profile"><span class="dashboard-avatar" aria-hidden="true">'+escapeHtml(connected?String(name).slice(0,2).toUpperCase():'BG')+'</span><div><a href="/'+(route==='social'?'social':'profile')+'" data-route="'+route+'"><strong>'+escapeHtml(name)+'</strong></a><small>'+escapeHtml(detail)+'</small>'+(!connected&&walletHref?linkButton({label:'Connect wallet (optional)',href:walletHref}):'')+'</div></section>';
}
export function welcomeHero(date=new Date()){
 const greeting=selectGreeting(date);
 return '<section class="dashboard-welcome dashboard-welcome--art" aria-label="Welcome to Bong Goggles"><h1 class="dashboard-sr-only">Bong Goggles</h1><img class="greeting-image" data-greeting src="'+greetingSrc(greeting)+'" alt="'+escapeHtml(greeting.label)+'" width="1000" height="563" fetchpriority="high" decoding="async"></section>';
}
function panel(title,path,route,body){
 return '<section class="dashboard-panel"><div class="panel-heading"><h2>'+title+'</h2><a href="'+path+'" data-route="'+route+'">View all <span aria-hidden="true">→</span></a></div>'+body+'</section>';
}
function communityRecords(kind,projection){
 const records=projection?.[kind];
 if(!Array.isArray(records))return '<p class="rail-empty">Community data is not available yet.</p>';
 const visible=records.filter(x=>x.active===true&&(kind==='groups'?x.privacy==='PUBLIC':x.visibility==='PUBLIC'));
 try{return visible.length?renderCommunityDirectory({kind,records:visible.slice(0,3)}):'<p class="rail-empty">No public '+kind+' to show.</p>';}catch{return '<p class="rail-empty">Community data is not available yet.</p>';}
}
export function communityRail(community,discovery){
 let people='<p class="rail-empty">Discover new connections when the qualified people directory is available.</p>';
 if(Array.isArray(discovery?.recommendations)){
  const items=discovery.recommendations.filter(x=>x?.result?.type==='PROFILE').slice(0,3);
  try{if(items.length)people=renderRecommendations({items});}catch{}
 }
 return panel('Your Communities','/groups','groups',communityRecords('groups',community))+panel('Upcoming Events','/events','events',communityRecords('events',community))+panel('Discover People','/discover','discover',people);
}
export function ecosystemRail(){
 const links=(items)=>items.map(([name,url])=>'<a class="ecosystem-link" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">'+appIcon(name)+'<span>'+escapeHtml(name)+'</span><span aria-hidden="true">›</span></a>').join('');
 return '<aside class="ecosystem-rail" aria-label="420Integrated ecosystem"><a class="ecosystem-brand" href="https://420integrated.org/" target="_blank" rel="noopener noreferrer">'+appIcon("420Integrated")+'<div><strong>420Integrated</strong><small>Explore the ecosystem</small></div></a><nav aria-label="Ecosystem websites">'+links(featured)+'<span class="ecosystem-link ecosystem-unavailable" aria-disabled="true">'+appIcon("420Arcade")+'<span>420Arcade<small>Launch URL pending</small></span></span><details><summary>'+appIcon("More dApps")+' More dApps</summary>'+links(extra)+'<a class="ecosystem-link" href="https://420integrated.org/" target="_blank" rel="noopener noreferrer">Explore 420Integrated →</a></details></nav><p class="ecosystem-note">Website shortcuts · availability varies</p></aside>';
}
