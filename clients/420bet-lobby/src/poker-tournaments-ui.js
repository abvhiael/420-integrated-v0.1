// Poker Tournament lobby: format / structure exhibition only until official
// testnet has authoritative published event state. No invented entries, dates,
// pools, payouts, or game outcomes. Approved contracts remain the sole authority.
export const TOURNAMENT_FORMATS=Object.freeze([
 Object.freeze({id:'scheduled',name:'THE GREEN ROOM',subtitle:'Scheduled multi-table',
  icon:'♠',tag:'Scheduled',description:'A published start time, minimum entrants and frozen levels. Multiple tables rebalance at safe hand boundaries.',
  kind:'Scheduled · Multi-table',features:['Scheduled start','Frozen blind schedule','Multi-table balancing','Late entry only when published']}),
 Object.freeze({id:'sit-and-go',name:'THE HASH TABLE',subtitle:'Sit & Go showdown',
  icon:'♣',tag:'Sit & Go',description:'Starts when its published qualifying entry target is met. The field cap and cancellation policy stay fixed.',
  kind:'Sit & Go · Single table',features:['Target-based start','Published entry cap','Verified seat assignments','Final-player finish']}),
 Object.freeze({id:'rebuy',name:'SECOND WIND',subtitle:'Re-entry & rebuy structure',
  icon:'♦',tag:'Rebuy',description:'Separately capped re-entry and zero-stack rebuy options. Purchases never change a hand already in progress.',
  kind:'Scheduled · Multi-table',features:['Capped re-entries','Zero-stack rebuy only','Hard cutoffs','Same starting stack for rebuy']}),
 Object.freeze({id:'freeroll',name:'THE GOLDEN LEAF',subtitle:'Prefunded free tournament',
  icon:'♥',tag:'Free',description:'Free-entry events require the entire advertised prize to be prefunded in canonical prize escrow before registration.',
  kind:'Free · Scheduled',features:['No entry fee','Prefunded prizes only','Verified player limits','Same NLHE rules']})
]);
export const TOURNAMENT_RULES=Object.freeze([
 ['FORMAT','Scheduled or Sit & Go; single or multi-table; buy-in/re-entry/rebuy eligibility published before registration'],
 ['BLIND LEVELS','Shared tournament clock, increasing or equal 2:1 big-to-small blinds, no ante for V1'],
 ['ENTRY','Paid tournaments escrow 100% of buy-ins to prizes plus a separate 3% development fee; free events require prefunded prizes'],
 ['CHIPS','Tournament stacks are not redeemable chips or cash-game seat balances'],
 ['PURCHASE WINDOWS','Late registration and extra purchases follow the immutable hard-time and optional level cutoff; pauses do not extend limits'],
 ['PRIZES','Payout bands use unique verified finishers; fees and prizes stay escrowed until qualifying final resolution'],
 ['SAFETY','Unfilled, paused, recovery or cancelled events follow the frozen, auditable refund/recovery rules']
]);
function element(doc,tag,className,text){const n=doc.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function info(doc,label,value){const n=element(doc,'div','pt-info');n.append(element(doc,'span','',label),element(doc,'strong','',value));return n;}
export function createPokerTournamentsPreview(doc=globalThis.document){
 const root=element(doc,'section','pt-root');
 root.dataset.practiceGame='poker-tournaments';root.dataset.previewOnly='true';
 const hero=element(doc,'header','pt-hero');
 const mark=element(doc,'div','pt-hero-mark','♠');
 const branding=element(doc,'div','pt-hero-content');
 branding.append(element(doc,'div','pt-eyebrow','420BET POKER · EVENT LOUNGE'),
   element(doc,'h1','','HIGH ROLLER TOURNAMENTS'),
   element(doc,'p','','THE GREEN TABLE AWAITS · NO-LIMIT TEXAS HOLD’EM'));
 const status=element(doc,'div','pt-hero-status','TESTNET PREVIEW · REGISTRATION OFFLINE');
 hero.append(mark,branding,status);
 const stats=element(doc,'div','pt-quick');
 stats.append(info(doc,'LIVE EVENTS','NOT CONNECTED'),info(doc,'REGISTRATION','DISABLED'),
 info(doc,'LEADERBOARDS','AWAITING TESTNET'),info(doc,'EVENT PAYOUTS','NO VERIFIED EVENTS'));
 const layout=element(doc,'div','pt-layout');
 const sidebar=element(doc,'aside','pt-sidebar');
 sidebar.append(element(doc,'h2','','TOURNAMENT FORMATS'),element(doc,'p','pt-muted','Explore supported tournament structures. These are format concepts, not scheduled events.'));
 const choices=element(doc,'div','pt-choices');sidebar.append(choices);
 const detail=element(doc,'section','pt-detail');
 const detailHeader=element(doc,'header','pt-detail-head');
 const detailTitle=element(doc,'div','pt-detail-title');
 const tag=element(doc,'span','pt-tag','');
 detailHeader.append(detailTitle,tag);
 const feature=element(doc,'div','pt-feature');
 const featureGlyph=element(doc,'span','pt-feature-glyph','♠');
 const featureCopy=element(doc,'div','pt-feature-copy');
 const headline=element(doc,'strong','',''),subline=element(doc,'span','','');
 featureCopy.append(headline,subline);
 feature.append(featureGlyph,featureCopy);
 const metrics=element(doc,'div','pt-metrics');
 metrics.append(info(doc,'NEXT START','NOT SCHEDULED'),info(doc,'FIELD','NO VERIFIED ROSTER'),
  info(doc,'PRIZE POOL','NOT ANNOUNCED'),info(doc,'ENTRY','UNAVAILABLE'));
 const explanation=element(doc,'p','pt-description','');
 const highlights=element(doc,'div','pt-highlights');
 const actions=element(doc,'div','pt-actions');
 const register=element(doc,'button','pt-btn pt-register','REGISTRATION OPENS AFTER TESTNET');
 register.type='button';register.disabled=true;register.title='No verified event publication, participant roster or funded escrow is available';
 const spectate=element(doc,'button','pt-btn pt-spectate','WATCH TABLES · NOT CONNECTED');
 spectate.type='button';spectate.disabled=true;spectate.title='Qualified tournament table projection is not deployed';
 actions.append(register,spectate);
 const caution=element(doc,'p','pt-warning',
  'EVENT DEMONSTRATION ONLY · No live event was announced. No entrants, buy-ins, prize pools, standings or start times are being represented as real.');
 detail.append(detailHeader,feature,metrics,explanation,highlights,actions,caution);
 layout.append(sidebar,detail);
 const rules=element(doc,'section','pt-rules');
 const rulesHeader=element(doc,'div','pt-rules-header');
 rulesHeader.append(element(doc,'h2','','THE TOURNAMENT RULEBOOK'),
 element(doc,'span','pt-rulebadge','APPROVED FORMAT POLICIES · PREVIEW'));
 rules.append(rulesHeader);
 const rulesGrid=element(doc,'div','pt-rules-grid');
 for(const [label,value]of TOURNAMENT_RULES){
  const card=element(doc,'article','pt-rule');
  card.append(element(doc,'h3','',label),element(doc,'p','',value));rulesGrid.append(card);
 }
 rules.append(rulesGrid);
 const footer=element(doc,'footer','pt-footer',
  '420BET · TOURNAMENT FRONTEND PREVIEW · OFFICIAL TESTNET, CRYPTOGRAPHIC HANDS & REGISTRATION AUTHORITY PENDING');
 root.append(hero,stats,layout,rules,footer);
 let selected=TOURNAMENT_FORMATS[0].id;
 function render(){
  choices.replaceChildren();
  const chosen=TOURNAMENT_FORMATS.find(f=>f.id===selected);
  for(const f of TOURNAMENT_FORMATS){
   const b=element(doc,'button','pt-choice'+(f.id===selected?' pt-selected':''));b.type='button';
   b.dataset.format=f.id;b.setAttribute('aria-pressed',String(f.id===selected));
   b.append(element(doc,'span','pt-choice-icon',f.icon));
   const copy=element(doc,'span','pt-choice-copy');
   copy.append(element(doc,'strong','',f.name),element(doc,'small','',f.subtitle));
   b.append(copy);
   b.addEventListener('click',()=>{selected=f.id;render();});choices.append(b);
  }
  detailTitle.replaceChildren(element(doc,'small','','FEATURED FORMAT · VISUAL PREVIEW'),
   element(doc,'h2','',chosen.name),element(doc,'p','',chosen.kind));
  tag.textContent=chosen.tag;headline.textContent=chosen.subtitle;
  subline.textContent='TOURNAMENT STRUCTURE · NOT AN ACTIVE EVENT';
  featureGlyph.textContent=chosen.icon;explanation.textContent=chosen.description;
  highlights.replaceChildren();
  for(const label of chosen.features)highlights.append(element(doc,'span','pt-feature-pill','✦ '+label));
 }
 render();root.stopAnimation=()=>{};return root;
}
