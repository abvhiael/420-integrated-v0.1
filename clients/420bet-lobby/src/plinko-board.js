import {plinkoPath,plinkoSchedule,plinkoExpectedReturn,PLINKO_BUCKET_CHOICES,PLINKO_RISKS,PLINKO_DROP_CHOICES} from './plinko-practice-paytable.js';
const NS='http://www.w3.org/2000/svg', WIDTH=720, HEIGHT=680, DX=42, TOP=36, LAST=592;
export function plinkoWaypoints(bits){
 if(!Array.isArray(bits)||bits.length<7||bits.length>15||bits.some(x=>x!==0&&x!==1))throw Error('Invalid Plinko path');
 let rights=0;const points=[{x:WIDTH/2,y:10}],step=(LAST-TOP)/(bits.length-1);
 for(let i=0;i<bits.length;i++){rights+=bits[i];points.push({x:WIDTH/2+(rights-(i+1)/2)*DX,y:TOP+i*step+16});}
 points.push({x:WIDTH/2+(rights-bits.length/2)*DX,y:645});return points;
}
export function plinkoPosition(points,fraction){
 const t=Math.max(0,Math.min(1,fraction)),step=Math.min(points.length-2,Math.floor(t*(points.length-1)));
 const u=Math.min(1,t*(points.length-1)-step),a=points[step],b=points[step+1];
 return {x:a.x+(b.x-a.x)*(u*u*(3-2*u)),y:a.y+(b.y-a.y)*(u*u*(2-u))};
}
export function createPlinkoBoard(doc=globalThis.document){
 const root=doc.createElement('section');root.className='practice plinko-neon pete-plinko';root.dataset.practiceGame='plinko';
 const win=doc.defaultView||{},raf=win.requestAnimationFrame?.bind(win),cancel=win.cancelAnimationFrame?.bind(win);
 const reduced=()=>Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 const el=(tag,cls,text)=>{const x=doc.createElement(tag);x.className=cls||'';if(text!==undefined)x.textContent=text;return x;};
 const svgEl=(tag,attrs)=>{const x=doc.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))x.setAttribute(key,String(value));return x;};
 let bucketsCount=13,risk='showtime',dropCount=1,active=false,frameId=null,runs=[],last=[],total=0,history=[],message='Choose your risk, buckets and multi-ball count.';
 const icon=el('div','pete-plinko-portrait','♠');icon.setAttribute('aria-label','Prickly Pete — punk porcupine host');
 const heading=el('header','plinko-heading');
 heading.append(el('p','practice-label','420BET · LITTLE CRITTERS · SIMULATED PRACTICE'),el('h1','','PRICKLY PETE’S PLINKO PANIC'),el('p','','More buckets. More balls. More ways for Pete to be disappointed.'));
 root.append(heading);
 const layout=el('div','plinko-machine');
 const stage=el('div','plinko-stage');
 stage.style.cssText='min-width:0;position:relative;flex:1;';
 const svg=svgEl('svg',{viewBox:'0 0 720 680',class:'plinko-svg',role:'img','aria-label':'Prickly Pete Plinko practice board'});
 const bucketBar=el('div','plinko-buckets');
 const host=el('aside','plinko-info pete-plinko-host');
 host.append(icon,el('h2','','PRICKLY PETE'),el('p','pete-plinko-reaction','“Try not to break anything.”'));
 const panel=el('div','pete-plinko-controls');
 const field=(label,choices,selected,change)=>{
  const wrap=el('label','pete-plinko-field');wrap.append(el('span','',label));const select=el('select','');
  for(const value of choices){const option=el('option','',String(value).toUpperCase());option.value=String(value);option.selected=String(value)===String(selected);select.append(option);}
  select.addEventListener('change',()=>change(select.value));wrap.append(select);return wrap;
 };
 const dropButton=el('button','plinko-drop','DROP 1 BALL');dropButton.type='button';
 const stopButton=el('button','pete-plinko-stop','STOP ANIMATION');stopButton.type='button';stopButton.hidden=true;
 const status=el('p','practice-message',message);
 const totals=el('div','plinko-financials'),warning=el('p','plinko-schedule-warning','Illustrative 96% expected return practice schedules only — NOT approved for live settlement. No stakes, wallet access or payouts.');
 const record=el('div','pete-plinko-history');
 const reaction=host.querySelector('.pete-plinko-reaction');
 function face(text,expression){reaction.textContent='“'+text+'”';icon.textContent=expression;}
 function setControlsDisabled(disabled){for(const x of panel.querySelectorAll('select'))x.disabled=disabled;dropButton.disabled=disabled;stopButton.hidden=!disabled;}
 function paint(){
  svg.replaceChildren();const rows=bucketsCount-1,step=(LAST-TOP)/(rows-1);
  for(let r=0;r<rows;r++)for(let c=0;c<=r;c++)svg.append(svgEl('circle',{cx:WIDTH/2+(c-r/2)*DX,cy:TOP+r*step+16,r:6,class:'plinko-peg'}));
  runs.forEach((run,index)=>{const p=plinkoPosition(run.points,run.fraction),ball=svgEl('circle',{cx:p.x,cy:p.y,r:10,class:'plinko-medallion-base','aria-label':'practice ball '+(index+1)});svg.append(ball);});
 }
 function update(){
  const schedule=plinkoSchedule(bucketsCount,risk);bucketBar.replaceChildren();
  for(let i=0;i<bucketsCount;i++){const b=el('span','plinko-bucket'+(last.includes(i)?' landed':''),schedule[i].toFixed(2)+'×');b.title='Landing bucket '+(i+1);bucketBar.append(b);}
  totals.replaceChildren();
  for(const [label,value] of [['Risk',risk.toUpperCase()],['Buckets',String(bucketsCount)],['Balls this drop',String(dropCount)],['Total practice balls',String(total)],['Theoretical RTP',(plinkoExpectedReturn(bucketsCount,risk)*100).toFixed(2)+'%'],['Practice stake / payout','0 / 0']]){
   const row=el('div','plinko-financial-row');row.append(el('span','',label),el('strong','',value));totals.append(row);
  }
  dropButton.textContent='DROP '+dropCount+' '+(dropCount===1?'BALL':'BALLS');
  status.textContent=message;record.textContent=history.length?'RECENT BUCKETS: '+history.slice(-12).map(n=>n+1).join(' · '):'No drops yet.';
  paint();
 }
 function end(){
  active=false;frameId=null;last=runs.map(r=>r.bucket);total+=runs.length;history.push(...last);
  const max=Math.max(...runs.map(r=>r.multiplier));message=runs.length+' simulated ball'+(runs.length===1?'':'s')+' landed. Highest '+max.toFixed(2)+'×. No payout.';
  if(max>=plinkoSchedule(bucketsCount,risk)[0]*0.8)face('Well, would you look at that.','★');
  else if(max<1)face('Typical.','✕');else face('Coulda been worse.','♠');
  runs=[];setControlsDisabled(false);update();
 }
 function stop(){if(frameId!==null&&cancel)cancel(frameId);frameId=null;if(active){runs.forEach(r=>r.fraction=1);end();}}
 function drop(){
  if(active)return;active=true;last=[];runs=Array.from({length:dropCount},()=>{
   const bits=plinkoPath(bucketsCount),bucket=bits.reduce((a,b)=>a+b,0);
   return {bits,bucket,points:plinkoWaypoints(bits),multiplier:plinkoSchedule(bucketsCount,risk)[bucket],fraction:0};
  });
  face('Here we go again.','♠');message='Dropping '+dropCount+' practice ball'+(dropCount===1?'':'s')+'…';
  setControlsDisabled(true);update();
  if(!raf||reduced()){runs.forEach(r=>r.fraction=1);end();return;}
  let started=null;
  const duration=2300,stagger=175;
  function tick(now){
   if(!active)return;if(started===null)started=now;
   const elapsed=now-started;
   runs.forEach((run,i)=>run.fraction=Math.max(0,Math.min(1,(elapsed-i*stagger)/duration)));
   paint();
   if(runs.every(r=>r.fraction>=1))end();else frameId=raf(tick);
  }
  frameId=raf(tick);
 }
 panel.append(
  field('Buckets (8–16)',PLINKO_BUCKET_CHOICES,bucketsCount,value=>{bucketsCount=Number(value);last=[];update();}),
  field('Risk',PLINKO_RISKS,risk,value=>{risk=value;last=[];update();}),
  field('Multi-ball',[...PLINKO_DROP_CHOICES],dropCount,value=>{dropCount=Number(value);update();}),
  dropButton,stopButton,status,totals,record,warning);
 dropButton.addEventListener('click',drop);stopButton.addEventListener('click',stop);
 stage.append(svg,bucketBar);layout.append(stage,host,panel);root.append(layout);
 root.stopAnimation=stop;
 update();return root;
}
