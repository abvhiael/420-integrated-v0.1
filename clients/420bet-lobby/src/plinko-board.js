import {plinkoPath,plinkoSchedule,plinkoExpectedReturn,PLINKO_BUCKET_CHOICES,PLINKO_RISKS,PLINKO_DROP_CHOICES} from './plinko-practice-paytable.js';

const NS='http://www.w3.org/2000/svg';
const WIDTH=720, DX=42, TOP=38, LAST=578, FLOOR=638, DURATION=3600, STAGGER=170;
const ART='/assets/420bet/prickly-pete-plinko/';
const BALL_SKINS=Object.freeze(['ball_green.png','ball_metal.png','ball_red.png','ball_disco.png','ball_leaf.png','ball_eight.png','ball_smile.png']);
export function plinkoBallSkin(index){if(!Number.isInteger(index)||index<0)throw Error('Invalid ball index');return BALL_SKINS[index%BALL_SKINS.length];}
const REACTIONS=Object.freeze({
 idle:'reaction_bored.png', angry:'reaction_angry_pointing.png',
 suspicious:'reaction_suspicious.png', smug:'reaction_smug_thumbs_up.png',
 excited:'reaction_excited.png', shocked:'reaction_shocked.png',
 triumph:'reaction_triumphant.png', facepalm:'reaction_facepalm.png'
});
const currency=cents=>(cents/100).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});

export function plinkoWaypoints(bits){
 if(!Array.isArray(bits)||bits.length<7||bits.length>16||bits.some(x=>x!==0&&x!==1))throw Error('Invalid Plinko path');
 let rights=0;
 const points=[{x:WIDTH/2,y:10}],step=(LAST-TOP)/(bits.length-1);
 for(let i=0;i<bits.length;i++){rights+=bits[i];points.push({x:WIDTH/2+(rights-(i+1)/2)*DX,y:TOP+i*step+16});}
 points.push({x:WIDTH/2+(rights-bits.length/2)*DX,y:FLOOR});
 return points;
}
export function plinkoPosition(points,fraction){
 const t=Math.max(0,Math.min(1,fraction)),step=Math.min(points.length-2,Math.floor(t*(points.length-1)));
 const u=Math.min(1,t*(points.length-1)-step),a=points[step],b=points[step+1];
 return {x:a.x+(b.x-a.x)*(u*u*(3-2*u)),y:a.y+(b.y-a.y)*(u*u*(2-u))};
}
export function createPlinkoBoard(doc=globalThis.document,options={}){
 const root=doc.createElement('section');
 root.className='practice plinko-neon pete-plinko';root.dataset.practiceGame='plinko';
 const win=options.view||doc.defaultView||{},raf=win.requestAnimationFrame?.bind(win),cancel=win.cancelAnimationFrame?.bind(win);
 const reduced=()=>Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 const el=(tag,cls,text)=>{const x=doc.createElement(tag);x.className=cls||'';if(text!==undefined)x.textContent=text;return x;};
 const svgEl=(tag,attrs)=>{const x=doc.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))x.setAttribute(key,String(value));return x;};
 const img=(cls,path,alt)=>{const x=el('img',cls);x.src=ART+path;x.alt=alt;x.decoding='async';return x;};
 const click=(node,handler)=>{node.type='button';node.addEventListener('click',handler);return node;};
 const button=(cls,label,handler)=>click(el('button',cls,label),handler);
 let bucketsCount=17,risk='showtime',dropCount=10,betCents=1000,balanceCents=1000000;
 let active=false,frameId=null,runs=[],last=[],total=0,history=[],message='Drop some chaos! No funds or wallet required.';
 let currentWin=0,sessionWins=0,sessionCost=0,lastCost=0,lastMax=0;
 const header=el('header','pete-plinko-header');
 const branding=el('div','pete-plinko-branding');
 const practiceMarker=el('span','pete-plinko-visually-hidden','PRACTICE ONLY · NO WALLET · NO FUNDS');
 branding.append(el('span','pete-plinko-brand-icon','☘'),el('strong','','420Bet'),el('small','','LITTLE CRITTERS'));
 header.append(practiceMarker,branding,el('h1','pete-plinko-visually-hidden','PRICKLY PETE’S PUNK-ROCK PLINKO PANDEMONIUM'));
 const balance=el('div','pete-plinko-balance');balance.append(el('span','','PRACTICE CREDITS'),el('strong','pete-balance-value','10,000.00'));
 header.append(balance);root.append(header);
 const layout=el('div','plinko-machine');
 const host=el('aside','plinko-info pete-plinko-host');
 const peteLogo=img('pete-plinko-logo','branding/logo.png',"Prickly Pete's Punk-Rock Plinko Pandemonium");
 const peteFull=img('pete-plinko-fullbody','characters/pete_fullbody.png','Prickly Pete, the punk-rock porcupine');
 const peteReaction=img('pete-plinko-reaction-image','reactions/'+REACTIONS.idle,'Prickly Pete: bored');
 const speech=el('p','pete-plinko-reaction','“Let’s drop some chaos!”');
 host.append(peteLogo,peteFull,peteReaction,speech);
 const stage=el('div','plinko-stage');
 stage.setAttribute('aria-label','Prickly Pete Plinko board');
 const frame=el('div','pete-board-frame');
 const svg=svgEl('svg',{viewBox:'0 0 720 668',role:'img','aria-label':'Variable-row Plinko pegboard and practice balls',class:'plinko-svg'});
 const bucketBar=el('div','plinko-buckets');bucketBar.setAttribute('aria-label','Plinko landing buckets and multipliers');
 frame.append(svg,bucketBar);stage.append(frame);
 const panel=el('aside','pete-plinko-controls');
 const riskTitle=el('h2','','PICK YOUR RISK!');
 const riskGroup=el('div','pete-risk-choices');
 const rowControl=el('div','pete-option');
 const ballControl=el('div','pete-option');
 const controlRow=el('div','pete-advanced-selects');
 const field=(label,choices,selected,change)=>{
  const wrap=el('label','pete-plinko-field');wrap.append(el('span','',label));const select=el('select','');
  for(const value of choices){const option=el('option','',String(value).toUpperCase());option.value=String(value);option.selected=String(value)===String(selected);select.append(option);}
  select.addEventListener('change',()=>change(select.value));wrap.append(select);return {wrap,select};
 };
 const rowsField=field('Buckets (8–17)',PLINKO_BUCKET_CHOICES,bucketsCount,value=>{bucketsCount=Number(value);last=[];update();});
 const riskField=field('Risk',PLINKO_RISKS,risk,value=>{risk=value;last=[];update();});
 const ballsField=field('Multi-ball',PLINKO_DROP_CHOICES,dropCount,value=>{dropCount=Number(value);update();});
 controlRow.append(rowsField.wrap,riskField.wrap,ballsField.wrap);
 const rowMinus=button('pete-step','−',()=>{if(bucketsCount>8){bucketsCount--;last=[];update();}});
 const rowPlus=button('pete-step','+',()=>{if(bucketsCount<17){bucketsCount++;last=[];update();}});
 const rowValue=el('strong','pete-rows-value','16');
 rowControl.append(el('h3','','ROWS (PEGS)'),rowMinus,rowValue,rowPlus);
 const ballButtons=el('div','pete-ball-choices');
 ballControl.append(el('h3','','BALLS (MULTI-DROP)'),ballButtons);
 const info=el('dialog','pete-plinko-dialog');
 info.append(el('h2','','HOW TO PLAY'),el('p','','Select 7–16 peg rows, a risk level and 1/5/10/25 balls. Every ball receives an independent 50/50 path through each peg row. Edge buckets are rarer than center buckets.'));
 info.append(el('p','','Soundcheck has gentler multipliers. Showtime increases edge rewards while reducing center returns. Riot raises the maximum edge payouts further and reduces center payouts again.'));
 info.append(el('p','','Each ball costs its displayed practice bet and awards only virtual credits. The paytable changes with row and risk selections. Displayed RTP is theoretical, not a guarantee for any session. No wallet, funds or real payouts.'));
 const closeInfo=button('pete-info-close','CLOSE',()=>{info.close?.();if(!info.close)info.removeAttribute('open');});
 info.append(closeInfo);root.append(info);
 const infoButton=button('pete-console-icon pete-info-trigger','',()=>{if(info.showModal)info.showModal();else info.setAttribute('open','');});
 infoButton.append(img('pete-info-icon','ui/icon_info.png',''));
 infoButton.setAttribute('aria-label','Info — game rules and theoretical odds');
 const stopButton=button('pete-plinko-stop','FINISH ANIMATION',finishNow);stopButton.hidden=true;
 panel.append(riskTitle,riskGroup,rowControl,ballControl,controlRow,stopButton);
 layout.append(host,stage,panel);root.append(layout);
 const consoleBar=el('section','pete-plinko-console');
 const betBox=el('div','pete-console-field');
 const betMinus=button('pete-bet-step','−',()=>{betCents=Math.max(100,betCents-100);update();});
 const betPlus=button('pete-bet-step','+',()=>{betCents=Math.min(100000,betCents+100);update();});
 const betDisplay=el('strong','pete-bet-display','10.00');
 betBox.append(el('span','','BET (CREDITS PER BALL)'),betMinus,betDisplay,betPlus);
 const ballsSummary=el('div','pete-console-field');ballsSummary.append(el('span','','TOTAL BALLS'),el('strong','pete-total-balls','10'));
 const rowsSummary=el('div','pete-console-field');rowsSummary.append(el('span','','ROWS'),el('strong','pete-row-count','16'));
 const riskSummary=el('div','pete-console-field');riskSummary.append(el('span','','RISK'),el('strong','pete-risk-name','SHOWTIME'));
 const costSummary=el('div','pete-console-field pete-total-cost');costSummary.append(el('span','','TOTAL COST'),el('strong','pete-total-cost-value','100.00'));
 const winSummary=el('div','pete-console-field pete-total-win');winSummary.append(el('span','','TOTAL WINS'),el('strong','pete-total-win-value','0.00'));
 const dropButton=button('plinko-drop','▶ DROP BALLS!',drop);
 const historyBox=el('div','pete-console-field pete-history-panel');
 const record=el('div','pete-plinko-history','HISTORY (LAST 10)');
 historyBox.append(el('span','','HISTORY (LAST 10)'),record);
 consoleBar.append(betBox,ballsSummary,rowsSummary,riskSummary,costSummary,winSummary,dropButton,historyBox);root.append(consoleBar);
 const footer=el('footer','pete-plinko-footer');
 const footerIcons=el('div','pete-footer-icons');footerIcons.append(infoButton);
 const disclosure=el('p','plinko-schedule-warning','Practice credits only. No funds, wallet or real payouts. Illustrative schedules — NOT approved for live settlement.');
 const summary=el('p','pete-plinko-summary','BUCKETS: 17 · THEORETICAL RTP: ~96%');
 footer.append(footerIcons,summary,disclosure);root.append(footer);
 const status=el('p','practice-message pete-plinko-status',message);
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);
 const totals=el('div','plinko-financials pete-plinko-financials');root.append(totals);
 function face(kind,text){
  peteReaction.src=ART+'reactions/'+REACTIONS[kind];
  peteReaction.alt='Prickly Pete: '+kind;
  speech.textContent='“'+text+'”';
 }
 function lock(locked){
  for(const s of panel.querySelectorAll('select'))s.disabled=locked;
  for(const b of [rowMinus,rowPlus,betMinus,betPlus,...riskGroup.querySelectorAll('button'),...ballButtons.querySelectorAll('button')])b.disabled=locked;
  dropButton.disabled=locked;stopButton.hidden=!locked;
 }
 function paint(){
  svg.replaceChildren();
  const rows=bucketsCount-1,step=(LAST-TOP)/(rows-1);
  for(let r=0;r<rows;r++){
   for(let c=0;c<=r;c++){
    const cx=WIDTH/2+(c-r/2)*DX,cy=TOP+r*step+16;
    svg.append(svgEl('image',{href:ART+'pegs/peg_silver.png',x:cx-9,y:cy-9,width:18,height:18,class:'plinko-peg'}));
   }
  }
  runs.forEach((run,index)=>{
   const p=plinkoPosition(run.points,run.fraction);
   const g=svgEl('g',{class:'plinko-ball',transform:'translate('+p.x+' '+p.y+')','aria-label':'Practice ball '+(index+1)});
   g.append(svgEl('image',{href:ART+'balls/'+run.skin,x:-15,y:-15,width:30,height:30,class:'plinko-medallion-base'}));
   svg.append(g);
  });
 }
 function update(){
  const schedule=plinkoSchedule(bucketsCount,risk);
  bucketBar.style.setProperty('--plinko-bucket-count',String(bucketsCount));bucketBar.replaceChildren();
  for(let i=0;i<bucketsCount;i++){
   const bucket=el('span','plinko-bucket'+(last.includes(i)?' landed':''),schedule[i].toFixed(2)+'×');
   bucket.title='Bucket '+(i+1)+' — '+schedule[i].toFixed(4)+'× (practice only)';
   bucket.style.setProperty('--slot-index',String(i));bucketBar.append(bucket);
  }
  rowValue.textContent=String(bucketsCount-1);
  rowMinus.disabled=active||bucketsCount===8;rowPlus.disabled=active||bucketsCount===17;
  ballsSummary.querySelector('strong').textContent=String(dropCount);
  rowsSummary.querySelector('strong').textContent=String(bucketsCount-1);
  riskSummary.querySelector('strong').textContent=risk.toUpperCase();
  betDisplay.textContent=currency(betCents);
  costSummary.querySelector('strong').textContent=currency(active?lastCost:betCents*dropCount);
  winSummary.querySelector('strong').textContent=currency(currentWin);
  winSummary.classList.toggle('settled',!active&&total>0);
  balance.querySelector('strong').textContent=currency(balanceCents);
  betMinus.disabled=active||betCents<=100;betPlus.disabled=active||betCents>=100000;
  riskGroup.replaceChildren();
  for(const [value,label,subtitle] of [['soundcheck','SOUNDCHECK','LOW RISK · SMOOTHER PAYOUTS'],['showtime','SHOWTIME','BALANCED RISK & REWARDS'],['riot','RIOT','HIGH RISK · BIG EDGE REWARDS']]){
   const b=button('pete-risk-button'+(risk===value?' selected':''),label,()=>{risk=value;last=[];update();});
   b.append(el('small','',subtitle));b.setAttribute('aria-pressed',String(risk===value));b.disabled=active;riskGroup.append(b);
  }
  ballButtons.replaceChildren();
  for(const quantity of PLINKO_DROP_CHOICES){
   const b=button('pete-ball-button'+(dropCount===quantity?' selected':''),String(quantity),()=>{dropCount=quantity;update();});
   b.setAttribute('aria-pressed',String(dropCount===quantity));b.disabled=active;ballButtons.append(b);
  }
  dropButton.textContent='▶ DROP '+dropCount+' '+(dropCount===1?'BALL!':'BALLS!');
  dropButton.disabled=active||betCents*dropCount>balanceCents;
  record.replaceChildren();
  for(const h of history.slice(-10).reverse())record.append(el('span','pete-history-chip',h.multiplier.toFixed(2)+'×'));
  if(!history.length)record.append(el('span','','—'));
  summary.textContent='BUCKETS: '+bucketsCount+'  |  MAX WIN (PER BALL): '+Math.max(...schedule).toFixed(2)+'×  |  EST. RTP: '+(plinkoExpectedReturn(bucketsCount,risk)*100).toFixed(2)+'%';
  totals.replaceChildren();
  for(const [label,value] of [['Risk',risk.toUpperCase()],['Buckets',String(bucketsCount)],['Balls this drop',String(dropCount)],['Total practice balls',String(total)],['Theoretical RTP',(plinkoExpectedReturn(bucketsCount,risk)*100).toFixed(2)+'%'],['Practice credits',currency(balanceCents)],['Last virtual payout',currency(currentWin)],['Last batch cost',currency(lastCost)],['Session cost',currency(sessionCost)],['Session wins',currency(sessionWins)]]){
   const row=el('div','plinko-financial-row');row.append(el('span','',label),el('strong','',value));totals.append(row);
  }
  status.textContent=message;paint();
 }
 function end(){
  if(!active)return;
  active=false;frameId=null;last=runs.map(r=>r.bucket);total+=runs.length;
  currentWin=runs.reduce((sum,r)=>sum+Math.round(betCents*r.multiplier),0);
  balanceCents+=currentWin;sessionWins+=currentWin;
  history.push(...runs.map(r=>({bucket:r.bucket,multiplier:r.multiplier})));
  lastMax=Math.max(...runs.map(r=>r.multiplier));
  message=runs.length+' simulated ball'+(runs.length===1?'':'s')+' landed. Cost '+currency(lastCost)+' credits. Total wins '+currency(currentWin)+' credits. Highest '+lastMax.toFixed(2)+'×.';
  if(lastMax>=plinkoSchedule(bucketsCount,risk)[0]*0.8)face('triumph','NO WAY! DON’T TOUCH ANYTHING!');
  else if(currentWin<betCents*runs.length)face('facepalm','Yeah. Figures.');
  else if(currentWin>betCents*runs.length*2)face('excited','NOW we’re talking!');
  else face('smug','Coulda been worse.');
  runs=[];lock(false);update();
 }
 function finishNow(){
  if(frameId!==null&&cancel)cancel(frameId);
  frameId=null;if(active){runs.forEach(r=>r.fraction=1);end();}
 }
 function drop(){
  if(active)return;
  const cost=betCents*dropCount;
  if(cost>balanceCents){message='Not enough virtual practice credits. Lower the bet or ball count.';update();return;}
  const schedule=plinkoSchedule(bucketsCount,risk);
  // Generate all outcomes before the first animation frame; visual motion cannot change an outcome.
  const selected=Array.from({length:dropCount},(_,selectedIndex)=>{
   const bits=plinkoPath(bucketsCount),bucket=bits.reduce((a,b)=>a+b,0);
   return {bucket,points:plinkoWaypoints(bits),multiplier:schedule[bucket],fraction:0,skin:plinkoBallSkin(selectedIndex)};
  });
  balanceCents-=cost;
  lastCost=cost;sessionCost+=cost;
  runs=selected;last=[];active=true;currentWin=0;
  face('suspicious','Here we go again.');
  message='Dropping '+dropCount+' practice ball'+(dropCount===1?'':'s')+'…';
  lock(true);update();
  if(!raf||reduced()){runs.forEach(r=>r.fraction=1);end();return;}
  let started=null;
  const tick=now=>{
   if(!active)return;
   if(started===null)started=now;
   const elapsed=now-started;
   runs.forEach((run,i)=>run.fraction=Math.max(0,Math.min(1,(elapsed-i*STAGGER)/DURATION)));
   paint();
   if(runs.every(r=>r.fraction>=1))end();else frameId=raf(tick);
  };
  frameId=raf(tick);
 }
 // Explicitly finish an animation on navigation, never leaving an unaccounted practice batch.
 root.stopAnimation=finishNow;
 update();
 return root;
}
