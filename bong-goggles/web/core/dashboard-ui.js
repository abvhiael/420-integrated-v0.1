import {escapeHtml,card,linkButton} from './design-system.js';
import {renderCommunityDirectory} from './community-ui.js';
import {renderRecommendations} from './discovery-ui.js';
const featured=[["420Exchange","https://420exchange.420integrated.org/"],["420Pay","https://pay.420integrated.org/"],["420TownSquare","https://420townsquare.420integrated.org/"],["DoobTube","https://doobtube.420integrated.org/"],["PuffBuddies","https://puffbuddies.420integrated.org/"],["420Media","https://420media.420integrated.org/"],["420Hz","https://420hz.420integrated.org/"]];
const extra=[["420Travel","https://420travel.420integrated.org/"],["20Mail","https://20mail.420integrated.org/"],["420Grow","https://420grow.420integrated.org/"],["DOOBr","https://doobr.420integrated.org/"],["Liftd","https://liftd.420integrated.org/"],["420BnB","https://420bnb.420integrated.org/"],["420Bet","https://420bet.420integrated.org/"]];
export const NAV_LABELS=Object.freeze({home:'Feed',profile:'My Profile',groups:'Communities',pages:'Pages'});
const icons=['⇄','▣','◉','▶','♥','▧','♫'];
export function topNavigation(nav,active){
 const items=['home','groups','discover','messages','notifications'].map(id=>nav.find(x=>x.id===id));
 return '<nav class="dashboard-topnav" aria-label="Primary header">'+items.map(x=>'<a href="'+x.path+'" data-route="'+x.id+'" aria-current="'+(active===x.id?'page':'false')+'"><span aria-hidden="true">'+escapeHtml(x.icon)+'</span>'+escapeHtml(x.id==='home'?'Home':NAV_LABELS[x.id]??x.label)+'</a>').join('')+'</nav>';
}
export function profileSummary(wallet,profile,walletHref){
 const connected=wallet?.connected===true;
 const own=connected&&typeof profile?.account==='string'&&profile.account.toLowerCase()===wallet.account?.toLowerCase();
 const name=own&&profile.displayName?profile.displayName:connected?'My account':'Welcome, guest';
 const detail=connected?String(wallet.account).slice(0,6)+'…'+String(wallet.account).slice(-4):'Explore the community';
 return '<section class="dashboard-profile"><span class="dashboard-avatar" aria-hidden="true">'+escapeHtml(connected?String(name).slice(0,2).toUpperCase():'BG')+'</span><div><a href="/profile" data-route="profile"><strong>'+escapeHtml(name)+'</strong></a><small>'+escapeHtml(detail)+'</small>'+(!connected&&walletHref?linkButton({label:'Connect 420Wallet',href:walletHref}):'')+'</div></section>';
}
export function welcomeHero(){
 return '<section class="dashboard-welcome" aria-label="Welcome to Bong Goggles"><div class="welcome-art" aria-hidden="true"></div><img src="/bong-goggles-header-256.webp" alt="" width="112" height="112"><div class="welcome-copy"><p>Welcome to</p><h1>Bong Goggles</h1><strong>The social network for cannabis culture</strong><small>Community · Creativity · Knowledge · Good company</small></div></section>';
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
 const links=(items)=>items.map(([name,url],i)=>'<a class="ecosystem-link" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer"><span class="ecosystem-icon" aria-hidden="true">'+icons[i%icons.length]+'</span><span>'+escapeHtml(name)+'</span><span aria-hidden="true">›</span></a>').join('');
 return '<aside class="ecosystem-rail" aria-label="420Integrated ecosystem"><a class="ecosystem-brand" href="https://420integrated.org/" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">✳</span><div><strong>420Integrated</strong><small>Explore the ecosystem</small></div></a><nav aria-label="Ecosystem websites">'+links(featured)+'<details><summary>More dApps</summary>'+links(extra)+'<a class="ecosystem-link" href="https://420integrated.org/" target="_blank" rel="noopener noreferrer">Explore 420Integrated →</a></details></nav><p class="ecosystem-note">Website shortcuts · availability varies</p></aside>';
}
