// Canonical 420Bet Fantasy Sports landing and future-layer navigation.
// This screen is visual navigation ONLY. No paid entry, live drafts, contests
// or wallet transactions become authorized until their testnet qualifications.
export const FANTASY_TABS=Object.freeze([
 Object.freeze({id:'create-league',label:'Create a League',icon:'🏆',subtitle:'Start a fantasy league',intro:'Your league starts here.',description:'League creation, commissioner controls, season selection and scoring settings will appear here after the verified fantasy services are integrated.'}),
 Object.freeze({id:'join-league',label:'Join a League',icon:'👥',subtitle:'Find a league',intro:'Bring your crew together.',description:'Browse published leagues and accept invitations after authenticated membership and admission checks become available.'}),
 Object.freeze({id:'live-drafts',label:'Live Drafts',icon:'📚',subtitle:'Draft room',intro:'Build a winning roster.',description:'Live draft boards, turn clocks, picks and auto-pick preferences will be connected to authoritative fantasy draft state after testnet acceptance.'}),
 Object.freeze({id:'my-teams',label:'My Teams',icon:'📊',subtitle:'Your fantasy rosters',intro:'Every team in one place.',description:'Authenticated team rosters, league memberships, player statistics and lineup changes will be available once verified participant-scoped APIs are deployed.'}),
 Object.freeze({id:'leaderboards',label:'Leaderboards',icon:'👑',subtitle:'League standings',intro:'Chase the top spot.',description:'Published standings, scoring history, league leaderboards and final results will be read from verified fantasy scoring data, not simulated results.'})
]);
export function validFantasyTab(id){return FANTASY_TABS.some(t=>t.id===id)?id:null;}
const elt=(d,tag,className,text)=>{const e=d.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
export function createFantasySportsView(doc=globalThis.document,{tab=null,onNavigate=()=>{},onBack=()=>{}}={}){
 const selected=validFantasyTab(tab);
 const root=elt(doc,'section','fs-screen'+(selected?' fs-subpage':' fs-home'));
 root.dataset.fantasyPage=selected??'home';
 root.dataset.transactions='disabled';
 root.setAttribute('aria-label','420Bet Fantasy Sports');
 const background=elt(doc,'div','fs-wallpaper');background.setAttribute('aria-hidden','true');
 root.append(background);
 const shade=elt(doc,'div','fs-contrast');shade.setAttribute('aria-hidden','true');root.append(shade);
 const back=elt(doc,'button','fs-back',selected?'← Fantasy Sports':'← Game Lobby');
 back.type='button';back.setAttribute('aria-label',selected?'Return to Fantasy Sports landing':'Return to game lobby');
 back.addEventListener('click',()=>selected?onNavigate(null):onBack());
 root.append(back);
 // Brand and Fantasy Sports title already live in approved hero art. DO NOT
 // insert another logo, title bar, marketing hero or page breadcrumb.
 if(!selected){
  const menu=elt(doc,'nav','fs-menu');menu.setAttribute('aria-label','Fantasy Sports sections');
  for(const item of FANTASY_TABS){
   const b=elt(doc,'button','fs-menu-action');b.type='button';b.dataset.fantasyTab=item.id;
   b.setAttribute('aria-label',item.label);
   b.append(elt(doc,'span','fs-menu-icon',item.icon),
    elt(doc,'span','fs-menu-label',item.label),elt(doc,'span','fs-menu-arrow','›'));
   b.addEventListener('click',()=>onNavigate(item.id));
   menu.append(b);
  }
  root.append(menu);
 }else{
  const page=FANTASY_TABS.find(t=>t.id===selected);
  const panel=elt(doc,'main','fs-layer');
  panel.append(elt(doc,'div','fs-layer-kicker','420BET FANTASY SPORTS · '+page.subtitle.toUpperCase()),
    elt(doc,'h1','',page.label),elt(doc,'p','fs-layer-lead',page.intro),
    elt(doc,'p','fs-layer-description',page.description));
  const pending=elt(doc,'div','fs-layer-pending');
  pending.append(elt(doc,'span','fs-pending-symbol','✦'),
   elt(doc,'div','fs-pending-copy','Awaiting authoritative testnet integration'));
  panel.append(pending);
  const button=elt(doc,'button','fs-layer-home','← Back to Fantasy Sports');
  button.type='button';button.addEventListener('click',()=>onNavigate(null));panel.append(button);
  root.append(panel);
 }
 root.stopAnimation=()=>{};
 return root;
}
