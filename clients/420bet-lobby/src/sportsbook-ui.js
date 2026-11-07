// 420Bet sportsbook: user-approved Bud & Ball Lounge wallpaper is the only hero.
// Clickable menu and optional DAILY verified matchups are live DOM above the art.
// No odds, game times, bets or tickets are invented from an illustrative image.
export const SPORTSBOOK_TABS=Object.freeze([
 {id:'all-sports',label:'All Sports',icon:'🏈',info:'Explore sports and competitions from a qualified feed.'},
 {id:'live-betting',label:'Live Betting',icon:'◉',info:'Verified in-play markets and event state will appear here after testnet integration.'},
 {id:'game-lines',label:'Game Lines',icon:'☷',info:'Scheduled markets and qualified line movements will appear here.'},
 {id:'parlays',label:'Parlays',icon:'🎟',info:'Multi-selection tickets require authoritative quote checks and risk authorization.'},
 {id:'futures',label:'Futures',icon:'🏆',info:'Season and outright markets will appear after trusted source qualification.'},
 {id:'promotions',label:'Promotions',icon:'🎁',info:'Only approved and published promotions can appear here.'},
 {id:'my-bets',label:'My Bets',icon:'♟',info:'Authenticated, verified wager history will be shown here when enabled.'}
]);
export const SPORTSBOOK_SPORTS=Object.freeze([
 {id:'nhl',label:'NHL',icon:'🏒'}, {id:'nfl',label:'NFL',icon:'🏈'},
 {id:'nba',label:'NBA',icon:'🏀'}, {id:'mlb',label:'MLB',icon:'⚾'},
 {id:'mls',label:'MLS',icon:'⚽'}, {id:'ufc',label:'UFC',icon:'🥊'},
 {id:'more',label:'More Sports',icon:'⋯'}
]);
export const validSportsbookTab=value=>SPORTSBOOK_TABS.some(t=>t.id===value)?value:null;
const create=(d,t,c,s)=>{const el=d.createElement(t);if(c)el.className=c;if(s!==undefined)el.textContent=s;return el;};
const isoDay=d=>/^\d{4}-\d{2}-\d{2}$/.test(d);
const eventId=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{1,96}$/.test(x);
const iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
const clean=(x,n=44)=>typeof x==='string'&&x.length>0&&x.length<=n&&!/[<>\r\n\x00-\x1f]/.test(x);
const sameOriginPath=x=>typeof x==='string'&&x.startsWith('/')&&!x.startsWith('//')&&
 !/[?#\\\r\n]/.test(x)&&x.length<=200;
export function validateSportsbookMarquee(payload,now=Date.now()){
 if(!payload||payload.source!=='verified-sports-fixtures-v1'||payload.authority!=='verified'||
  !iso(payload.observedAt)||!iso(payload.expiresAt)||!isoDay(payload.date)||
  !clean(payload.timezone,64)||!Array.isArray(payload.events)||payload.events.length>4)
  throw Error('Unverified sportsbook fixture feed');
 const observed=Date.parse(payload.observedAt),expiry=Date.parse(payload.expiresAt);
 if(observed>now+30000||expiry<=now||expiry-observed>86400000||now-observed>86400000)
  throw Error('Stale sportsbook fixture feed');
 const seen=new Set();
 const events=payload.events.map(e=>{
  if(!e||!eventId(e.id)||seen.has(e.id)||!clean(e.league,18)||
   !clean(e.home)||!clean(e.away)||e.home===e.away||!iso(e.startsAt)||!['scheduled','in-progress'].includes(e.status))
   throw Error('Unverified marquee event');
  if(e.odds!==undefined||e.price!==undefined||e.line!==undefined||e.betId!==undefined)
   throw Error('Do not publish unqualified odds');
  seen.add(e.id);
  return Object.freeze({id:e.id,league:e.league,home:e.home,away:e.away,
   startsAt:e.startsAt,status:e.status});
 });
 return Object.freeze({date:payload.date,timezone:payload.timezone,observedAt:payload.observedAt,events});
}
export async function loadSportsbookMarquee(endpoint,{fetcher=globalThis.fetch,now=Date.now(),signal}={}){
 if(!sameOriginPath(endpoint)||typeof fetcher!=='function')throw Error('Sportsbook feed not configured');
 const res=await fetcher(endpoint,{method:'GET',credentials:'same-origin',mode:'same-origin',
  redirect:'error',cache:'no-store',headers:{Accept:'application/json'},signal});
 if(!res?.ok||!/^application\/json(?:;|$)/i.test(res.headers?.get?.('content-type')??''))
  throw Error('Sportsbook feed unavailable');
 return validateSportsbookMarquee(await res.json(),now);
}
export function createSportsbookView(doc=globalThis.document,{tab=null,onNavigate=()=>{},onBack=()=>{},
 marqueeEndpoint='/api/420bet/sportsbook/marquee',fetcher=globalThis.fetch,clock=()=>Date.now(),
 autoRefresh=true}={}){
 const selected=validSportsbookTab(tab);
 const root=create(doc,'section','sb-screen'+(selected?' sb-section':' sb-home'));
 root.dataset.sportsbookPage=selected??'home';root.dataset.transactions='disabled';
 root.setAttribute('aria-label','420Bet Sportsbook');
 // Fixed-ratio scene keeps the chalkboard and nav aligned with the artwork at
 // every viewport shape. Image and overlay scale/crop as one visual surface.
 const art=create(doc,'div','sb-artboard');art.setAttribute('aria-hidden','true');root.append(art);
 const overlay=create(doc,'div','sb-veil');overlay.setAttribute('aria-hidden','true');root.append(overlay);
 const back=create(doc,'button','sb-back',selected?'← Sportsbook':'← Game Lobby');
 back.type='button';back.addEventListener('click',()=>selected?onNavigate(null):onBack());root.append(back);
 let disposed=false,refreshId=null,controller=null,requestId=0;
 const board=create(doc,'section','sb-chalkboard');
 board.setAttribute('aria-label',"Today's marquee matchups");
 board.append(create(doc,'h2','sb-chalkboard-heading','MARQUEE MATCHUPS'));
 const source=create(doc,'div','sb-chalkboard-date','VERIFIED FIXTURES ONLY');
 const lines=create(doc,'div','sb-board-lines');board.append(source,lines);
 const empty=(message)=>{lines.replaceChildren(create(doc,'p','sb-board-empty',message));source.textContent='NO VERIFIED DAILY FEED';};
 const schedule=()=>{if(disposed||!autoRefresh)return;refreshId=globalThis.setTimeout?.(()=>void refresh(),300000)??null;};
 async function refresh(){
  const serial=++requestId;
  controller?.abort?.();controller=typeof AbortController==='function'?new AbortController():null;
  try{
   const data=await loadSportsbookMarquee(marqueeEndpoint,{fetcher,now:clock(),signal:controller?.signal});
   if(disposed||serial!==requestId)return;
   source.textContent='UPDATED '+new Date(data.observedAt).toLocaleString('en-CA',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'UTC'})+' UTC';
   lines.replaceChildren();
   if(!data.events.length)lines.append(create(doc,'p','sb-board-empty','No verified featured matchups published.'));
   for(const event of data.events){
    const row=create(doc,'div','sb-matchup');
    row.append(create(doc,'span','sb-matchup-league',event.league),
      create(doc,'span','sb-matchup-teams',event.away+' vs '+event.home),
      create(doc,'span','sb-matchup-time',event.status==='in-progress'?'IN PLAY':
       new Date(event.startsAt).toLocaleTimeString('en-CA',{hour:'numeric',minute:'2-digit',timeZone:data.timezone})));
    lines.append(row);
   }
  }catch{if(!disposed&&serial===requestId)empty('Daily matchups will appear once the verified sports feed is connected.');}
  if(!disposed&&serial===requestId)schedule();
 }
 if(!selected){
  root.append(board);
  const menu=create(doc,'nav','sb-menu');menu.setAttribute('aria-label','Sportsbook sections');
  for(const item of SPORTSBOOK_TABS){
   const b=create(doc,'button','sb-menu-action');b.type='button';b.dataset.sportsbookTab=item.id;
   b.append(create(doc,'span','sb-menu-icon',item.icon),create(doc,'span','sb-menu-label',item.label));
   b.addEventListener('click',()=>onNavigate(item.id));menu.append(b);
  }root.append(menu);
  empty('Daily matchups will appear once the verified sports feed is connected.');
  // One initial read; never infer fixtures or prices from the wallpaper.
  root.ready=refresh();
 }else{
  const page=SPORTSBOOK_TABS.find(t=>t.id===selected);
  const panel=create(doc,'main','sb-layer');
  panel.append(create(doc,'div','sb-layer-kicker','420BET SPORTSBOOK · VIEW-ONLY PREVIEW'),
    create(doc,'h1','',page.label),create(doc,'p','sb-layer-lead',page.info),
    create(doc,'p','sb-layer-alert','Awaiting authoritative testnet sports data. Betting and transactions are disabled.'));
  if(selected==='all-sports'){
   const sports=create(doc,'div','sb-sports-grid');
   for(const sport of SPORTSBOOK_SPORTS){
    const tile=create(doc,'div','sb-sport-tile');
    tile.append(create(doc,'span','',sport.icon),create(doc,'strong','',sport.label));sports.append(tile);
   }panel.append(sports);
  }
  const returnBtn=create(doc,'button','sb-layer-back','← Return to Sportsbook');
  returnBtn.type='button';returnBtn.addEventListener('click',()=>onNavigate(null));panel.append(returnBtn);
  root.append(panel);
 }
 root.stopAnimation=()=>{disposed=true;requestId++;controller?.abort?.();if(refreshId!==null)globalThis.clearTimeout?.(refreshId);};
 return root;
}
