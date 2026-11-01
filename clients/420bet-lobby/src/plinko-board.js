import {initial,next} from './practice-engine.js';
// DOM-only visualizer for the existing 12-step / 13-bucket practice engine.
export function createPlinkoBoard(doc=globalThis.document){
 let state=initial('plinko');
 const root=doc.createElement('section');root.className='practice plinko-neon';root.dataset.practiceGame='plinko';
 const el=(tag,cls,text)=>{const node=doc.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
 const render=()=>{root.replaceChildren();
 const intro=el('div','plinko-heading');intro.append(el('p','practice-label','420BET CASINO · SIMULATED PRACTICE · NO WALLET · NO WAGERS'),el('h1','','PLINKO'),el('p','','Twelve glowing rows. Thirteen landing buckets. Drop a practice ball.'));root.append(intro);
 const frame=el('div','plinko-machine');
 const machine=el('div','plinko-stage');machine.setAttribute('aria-label','12-row Plinko pegboard with 13 landing buckets');
 const svgNS='http://www.w3.org/2000/svg',svg=doc.createElementNS(svgNS,'svg');
 svg.setAttribute('viewBox','0 0 720 690');svg.setAttribute('role','img');svg.setAttribute('aria-label','Plinko pegboard with 12 rows of luminous pegs');
 svg.setAttribute('class','plinko-svg');
 const shape=(tag,attrs)=>{const x=doc.createElementNS(svgNS,tag);for(const [name,value] of Object.entries(attrs))x.setAttribute(name,String(value));svg.append(x);return x;};
 // Triangular peg lattice: 1..12 pegs (78 pegs), corresponding to 12 left/right moves.
 for(let row=0;row<12;row++)for(let column=0;column<=row;column++)shape('circle',{cx:360+(column-row/2)*43,cy:42+row*47,r:7,class:'plinko-peg'});
 if(state.result.length===12){let rights=0;const path=[[360,16]];for(let row=0;row<12;row++){rights+=state.result[row];path.push([360+(rights-(row+1)/2)*43,42+row*47+20]);}
 const trace=shape('polyline',{points:path.map(p=>p.join(',')).join(' '),class:'plinko-trace',fill:'none'});trace.setAttribute('stroke-linejoin','round');const last=path.at(-1);shape('circle',{cx:last[0],cy:last[1],r:12,class:'plinko-ball'});}
 machine.append(svg);
 const buckets=el('div','plinko-buckets');buckets.setAttribute('aria-label','Thirteen Plinko landing buckets');
 const landed=state.result.reduce((a,b)=>a+b,0);
 for(let n=0;n<=12;n++){const bucket=el('span','plinko-bucket'+(state.result.length&&n===landed?' landed':''),String(n));bucket.title='Landing bucket '+n;buckets.append(bucket);}machine.append(buckets);frame.append(machine);
 const panel=el('aside','plinko-info');panel.append(el('h2','','Practice Drop'),el('p','','Watch the ball travel through 12 rows of luminous pegs into one of 13 buckets.'));panel.append(el('div','plinko-stat-label','LAST LANDING BUCKET'),el('div','plinko-stat',state.result.length?String(landed):'—'));panel.append(el('p','practice-message',state.message));
 const drop=el('button','plinko-drop','✦ DROP PRACTICE BALL');drop.type='button';drop.addEventListener('click',()=>{state=next(state,{type:'play'});render();});panel.append(drop,el('p','plinko-safe','Browser-only simulated path. No wager, wallet request, canonical randomness, multiplier or payout.'));frame.append(panel);root.append(frame);
 };
 render();return root;
}
