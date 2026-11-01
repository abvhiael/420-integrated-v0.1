import {initial,next} from './practice-engine.js';
const ROWS=12, DURATION=3600, NS='http://www.w3.org/2000/svg';
export function plinkoWaypoints(bits){
 if(!Array.isArray(bits)||bits.length!==ROWS||bits.some(x=>x!==0&&x!==1))throw Error('Invalid Plinko practice path');
 let rights=0;
 const points=[{x:360,y:15}];
 for(let i=0;i<ROWS;i++){rights+=bits[i];points.push({x:360+(rights-(i+1)/2)*43,y:62+i*47});}
 points.push({x:360+(rights-6)*43,y:651});
 return points;
}
export function plinkoPosition(points,fraction){
 const t=Math.max(0,Math.min(1,fraction)),step=Math.min(points.length-2,Math.floor(t*(points.length-1)));
 const u=Math.min(1,t*(points.length-1)-step),a=points[step],b=points[step+1];
 // Steeper, gravity-like fall into each peg, with a slight decaying rebound.
 const fall=u*u*(3-2*u);
 const wobble=step===0||step===points.length-2?0:Math.sin(u*Math.PI*2)*3*(1-u);
 return {x:a.x+(b.x-a.x)*fall+wobble,y:a.y+(b.y-a.y)*(u*u*(2-u))};
}
export function createPlinkoBoard(doc=globalThis.document){
 let state=initial('plinko'),animating=false,landed=false,frameId=null,started=null,lastConnected=false;
 const view=doc.defaultView||{},raf=view.requestAnimationFrame?.bind(view),cancel=view.cancelAnimationFrame?.bind(view);
 const reduced=()=>Boolean(view.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 const root=doc.createElement('section');root.className='practice plinko-neon';root.dataset.practiceGame='plinko';
 const el=(tag,cls,text)=>{const n=doc.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 const svgNode=(tag,attrs)=>{const n=doc.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
 const draw=()=>{
  if(animating)return;
  state=next(state,{type:'play'});landed=false;
  const points=plinkoWaypoints(state.result);
  if(!raf||reduced()){landed=true;animating=false;render();return;}
  animating=true;started=null;render();
  const ball=root.querySelector('.plinko-ball'),flash=root.querySelector('.plinko-flash');
  const pegs=[...root.querySelectorAll('.plinko-peg')];let lastRow=-1;
  const tick=time=>{
   if(!animating)return;
   if(root.isConnected)lastConnected=true;
   if(lastConnected&&!root.isConnected){animating=false;frameId=null;return;}
   if(started===null)started=time;
   const t=Math.min(1,Math.max(0,(time-started)/DURATION)),position=plinkoPosition(points,t);
   ball.setAttribute('cx',position.x.toFixed(2));ball.setAttribute('cy',position.y.toFixed(2));
   const row=Math.min(ROWS-1,Math.floor(t*(ROWS+1))-1);
   if(row>=0&&row!==lastRow){if(lastRow>=0){pegs.forEach(p=>p.classList.remove('plinko-peg-flash'));}const targetY=42+row*47;const targetX=points[row+1].x;const target=pegs.find(p=>Number(p.getAttribute('cy'))===targetY&&Math.abs(Number(p.getAttribute('cx'))-targetX)<24);if(target)target.classList.add('plinko-peg-flash');lastRow=row;}
   flash.setAttribute('cx',position.x.toFixed(2));flash.setAttribute('cy',position.y.toFixed(2));flash.setAttribute('opacity',row>=0&&t<1?'0.28':'0');
   if(t<1){frameId=raf(tick);}else{animating=false;landed=true;frameId=null;render();}
  };
  frameId=raf(tick);
 };
 const render=()=>{root.replaceChildren();
  const intro=el('div','plinko-heading');intro.append(el('p','practice-label','420BET CASINO · SIMULATED PRACTICE · NO WALLET · NO WAGERS'),el('h1','','PLINKO'),el('p','','Twelve glowing rows. Thirteen landing buckets. Drop a practice ball.'));root.append(intro);
  const frame=el('div','plinko-machine'),machine=el('div','plinko-stage');machine.setAttribute('aria-label','12-row Plinko pegboard with 13 landing buckets');
  const svg=svgNode('svg',{viewBox:'0 0 720 690',role:'img','aria-label':'Plinko pegboard with 12 rows of luminous pegs',class:'plinko-svg'});
  for(let row=0;row<ROWS;row++)for(let col=0;col<=row;col++)svg.append(svgNode('circle',{cx:360+(col-row/2)*43,cy:42+row*47,r:7,class:'plinko-peg'}));
  if(animating||landed){const points=plinkoWaypoints(state.result),last=landed?points.at(-1):points[0];svg.append(svgNode('circle',{cx:last.x,cy:last.y,r:22,class:'plinko-flash',opacity:0}));svg.append(svgNode('circle',{cx:last.x,cy:last.y,r:12,class:'plinko-ball'}));}
  machine.append(svg);
  const buckets=el('div','plinko-buckets');buckets.setAttribute('aria-label','Thirteen Plinko landing buckets');
  const bucketNumber=state.result.reduce((a,x)=>a+x,0);
  for(let n=0;n<=ROWS;n++){const bucket=el('span','plinko-bucket'+(landed&&n===bucketNumber?' landed':''),String(n));bucket.title='Landing bucket '+n;buckets.append(bucket);}machine.append(buckets);frame.append(machine);
  const panel=el('aside','plinko-info');panel.append(el('h2','','Practice Drop'),el('p','','Watch the ball travel through 12 rows of luminous pegs into one of 13 buckets.'),el('div','plinko-stat-label','LAST LANDING BUCKET'),el('div','plinko-stat',landed?String(bucketNumber):'—'),el('p','practice-message',animating?'Ball dropping through the pegs…':landed?state.message:'Practice mode. No funds or payouts.'));
  const button=el('button','plinko-drop',animating?'BALL IN MOTION…':'✦ DROP PRACTICE BALL');button.type='button';button.disabled=animating;button.addEventListener('click',draw);
  panel.append(button,el('p','plinko-safe','Browser-only simulated path. No wager, wallet request, canonical randomness, multiplier or payout.'));frame.append(panel);root.append(frame);
 };
 root.stopAnimation=()=>{animating=false;if(frameId!==null&&cancel)cancel(frameId);frameId=null;};
 render();return root;
}
