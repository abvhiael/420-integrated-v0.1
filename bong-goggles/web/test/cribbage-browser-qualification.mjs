// BC-1.4: actual Chromium layout, asset and keyboard/privacy acceptance.
// This is a deterministic authorized snapshot fixture, NOT a live 420ID match.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {renderCribbageRoute} from '../core/cribbage-ui.js';
import {cribbageNewPegs} from '../core/cribbage-board.js';

const root=resolve(import.meta.dirname,'..');
const port=Number(process.env.BC14_PORT||41919);
const base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],
 {stdio:'ignore'});
let browser;
const fail=(message)=>{throw Error('BC-1.4 Chromium: '+message);};
const assert=(ok,message)=>{if(!ok)fail(message);};
const session=count=>{
 const hand=count===2?[0,5,14,25,38,50]:[0,5,14,25,38];
 return {id:'10000000-1111-4111-8111-111111111111',roomId:'20000000-2222-4222-8222-222222222222',
  gameId:'cribbage',seatCount:count,status:'active',sequence:1,turnSeat:0,viewerSeat:0,
  privateView:{
   gameId:'cribbage',variant:count===2?'standard-2p':count===3?'standard-3p':'standard-4p-partners',
   round:1,phase:'discard',dealer:1,turn:0,seat:0,scores:Array(count).fill(0),
   hand,cardCounts:Array(count).fill(hand.length),cribCount:count===3?1:0,
   discarded:Array(count).fill(false),starter:-1,pegCount:0,pegPile:[],
   pegged:Array.from({length:count},()=>[]),saidGo:Array(count).fill(false),
   lastShow:[],lastAwards:[],losers:[],winner:null
  }
 };
};
try{
 for(let i=0;i<50;i++){
  try{const result=await fetch(base+'/cribbage.css');
   if(result.ok)break;
  }catch{}
  await delay(100);
  if(i===49)fail('web source server did not start');
 }
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const [width,height,count] of [[1600,1000,2],[1180,900,4],[390,844,3]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  // Keep the live app bootstrap inert; test only the qualified UI projection.
  await page.route('**/app.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
  await page.goto(base+'/index.html',{waitUntil:'networkidle'});
  const match=session(count);
  const html=renderCribbageRoute({screen:'play',state:{status:'ready',session:match,
   pegs:cribbageNewPegs(match.privateView.scores,count),
   selection:[],settings:{motion:'standard',announcements:true,stinkhole:false}}});
  await page.evaluate(markup=>{document.body.innerHTML='<main id="match-root">'+markup+'</main>';},html);
  const data=await page.evaluate(async()=>{
   const board=document.querySelector('.cribbage-right');
   const hand=document.querySelector('.cribbage-left');
   const boxB=board?.getBoundingClientRect(),boxH=hand?.getBoundingClientRect();
   const image=document.querySelector('.cribbage-leaf image');
   const asset=await fetch(image.getAttribute('href'));
   const art=await asset.arrayBuffer(),bytes=new Uint8Array(art),header=new DataView(art);
   const holes=document.querySelectorAll('.cribbage-hole');
   const buttons=document.querySelectorAll('[data-cribbage-card]');
   const large=window.innerWidth>1120;
   return {board:boxB?.toJSON?.(),hand:boxH?.toJSON?.(),
    holes:holes.length,buttons:buttons.length,large,
    noOverflow:document.documentElement.scrollWidth<=window.innerWidth+2,
    imageStatus:asset.status,png:bytes.length===2698098&&bytes[0]===137&&bytes[1]===80&&
      header.getUint32(16)===1448&&header.getUint32(20)===1086,
    btnName:buttons[0]?.getAttribute('aria-label'),
    transparent:document.body.innerHTML.includes('opponentHand')};
  });
  assert(data.holes===0,'board artwork must not be overwritten by duplicated pegholes');
  assert(data.buttons===(count===2?6:5),'missing playable cards');
  assert(data.noOverflow,'mobile or desktop horizontal overflow at '+width);
  assert(data.imageStatus===200&&data.png,'exact user-supplied PNG was not served');
  assert(!data.transparent,'opponent secret present in DOM');
  assert(data.btnName?.startsWith('Select '),'card buttons not accessible');
  assert(data.board&&data.hand,'board and hand layout missing');
  if(data.large){
   assert(data.board.x>data.hand.x+data.hand.width*.7,'desktop board not on right');
   assert(data.board.width>=data.hand.width,'desktop board must have priority');
  }else assert(data.board.y>data.hand.y,'mobile board does not stack below cards');
  await page.addScriptTag({url:base+'/node_modules/axe-core/axe.min.js'});
  const violations=await page.evaluate(async()=>{
   const results=await window.axe.run(document.querySelector('#match-root'),{
    runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}
   });
   return results.violations.filter(x=>x.impact==='serious'||x.impact==='critical')
    .map(x=>({id:x.id,impact:x.impact,targets:x.nodes.map(n=>n.target.join(' '))}));
  });
  assert(violations.length===0,'axe serious/critical accessibility violations '+JSON.stringify(violations));
  // Actual DOM events must submit a canonical discard from the authorized
  // hand: two cards in 2p, exactly one in both 3p and 4p.
  await page.evaluate(async active=>{
   const module=await import('/core/cribbage-ui.js');
   window.__bc14Moves=[];
   const ctl={
    client:{enabled:true},
    state:{status:'ready',session:active,settings:{motion:'standard',stinkhole:false,announcements:true},
     selection:[],queue:[],submitting:false},
    emit(delta){
     this.state={...this.state,...delta};
     const holder=document.querySelector('#match-root');
     holder.innerHTML=module.renderCribbageRoute({screen:'play',state:this.state});
     module.bindCribbageDom(holder,this);
     return this.state;
    },
    async act(move){window.__bc14Moves.push(move);return this.state;},
    configure(key,value){
     this.state.settings={...this.state.settings,[key]:value};
     this.emit({});
    }
   };
   module.bindCribbageDom(document.querySelector('#match-root'),ctl);
  },match);
  const expected=match.privateView.hand.slice(0,count===2?2:1);
  for(const card of expected)await page.locator('[data-cribbage-card="'+card+'"]').click();
  const discard=page.locator('[data-cribbage-action="discard"]');
  assert(await discard.isEnabled(),'correct discard selection failed to enable human move');
  await discard.click();
  await page.waitForFunction(()=>window.__bc14Moves?.length===1);
  const received=await page.evaluate(()=>window.__bc14Moves[0]);
  assert(JSON.stringify(received)===JSON.stringify({type:'discard',cards:expected}),
   'DOM sent a different crib discard action');
  // Display preference changes only overlay styling, never the scored state.
  await page.locator('.cribbage-settings summary').click();
  await page.locator('[data-cribbage-setting="stinkhole"]').check();
  assert(await page.locator('.cribbage-stinkhole').count()===(count===3?3:2),
   'Stinkhole setting should highlight physical hole 120 with no house-rule award');
  console.log('BC-1.4 Chromium '+width+'x'+height+' / '+count+
   ' players: exact PNG, no duplicated holes, private hand buttons and axe PASS');
  await page.close();
 }
 // Exercise the actual controller and real DOM over three complete fixture hands.
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 await page.route('**/app.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
 await page.goto(base+'/index.html');
 const outcome=await page.evaluate(async()=>{
  const {CribbageSessionController,CRIBBAGE_RULES_HASH,cribbageLegalMoves}=await import('/core/cribbage-session.js');
  const {renderCribbageRoute,bindCribbageDom}=await import('/core/cribbage-ui.js');
  document.body.innerHTML='<main id="match-root"></main>';
  const root=document.querySelector('#match-root'),subject='30000000-3333-4333-8333-333333333333';
  const s={id:'10000000-1111-4111-8111-111111111111',roomId:'20000000-2222-4222-8222-222222222222',gameId:'cribbage',seatCount:2,status:'active',sequence:1,turnSeat:0,viewerSeat:0,rulesVersion:'v1.0',rulesHash:CRIBBAGE_RULES_HASH,deadline:null,winnerSeat:null};
  const v=s.privateView={gameId:'cribbage',variant:'standard-2p',round:1,phase:'discard',dealer:1,turn:0,seat:0,scores:[0,0],hand:[0,4,13,25,37,48],cardCounts:[6,6],cribCount:0,discarded:[false,false],starter:-1,pegCount:0,pegPile:[],pegged:[[],[]],saidGo:[false,false],lastShow:[],lastAwards:[],losers:[],winner:null};
  const response=data=>({status:200,ok:true,headers:{get:()=> 'application/json'},json:async()=>structuredClone(data)});
  let posts=0;
  const ctl=new CribbageSessionController({enabled:true,setTimer:(fn)=>setTimeout(fn,15),clearTimer:clearTimeout,
   onChange:state=>{root.innerHTML=renderCribbageRoute({screen:'play',state});bindCribbageDom(root,ctl);},
   fetchImpl:async(path,opts)=>{
    if(path.endsWith('/v1/me'))return response({walletRequired:false,profile:{subject}});
    if(path.endsWith('/action')){
     const {move,expectedSequence}=JSON.parse(opts.body);
     if(expectedSequence!==s.sequence+1)throw Error('unexpected sequence');
     posts++;s.sequence++;v.lastAwards=[];v.lastShow=[];
     if(move.type==='discard'){v.hand=v.hand.filter(x=>!move.cards.includes(x));v.phase='cut';v.discarded=[true,true];v.cardCounts=[4,4];v.cribCount=4;}
     else if(move.type==='cut'){v.phase='peg';v.starter=11;}
     else if(move.type==='play'){
      v.hand=v.hand.filter(x=>x!==move.card);v.cardCounts=[v.hand.length,v.hand.length];
      if(!v.hand.length){
       v.scores[0]+=1;v.lastAwards=[{seat:0,team:0,kind:'last-card',points:1,count:20,total:v.scores[0]}];
       const score={fifteens:0,pairs:0,runs:0,flush:0,nobs:0,total:0};
       v.lastShow=[{seat:0,isCrib:false,cards:[0,4,13,25],starter:11,score},{seat:1,isCrib:false,cards:[1,5,14,26],starter:11,score},{seat:1,isCrib:true,cards:[2,6,15,27],starter:11,score}];
       v.round++;v.phase='discard';v.hand=[0,4,13,25,37,48];v.cardCounts=[6,6];v.discarded=[false,false];v.cribCount=0;v.starter=-1;
      }
     }else throw Error('unexpected fixture move');
    }
    return response({onChain:false,wager:false,rewards:false,session:s});
   }});
  await ctl.open(s.id);
  const wait=async predicate=>{for(let i=0;i<300;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error('scoring transition stalled');};
  for(let i=0;i<18;i++){
   await wait(()=>ctl.state.status==='ready'&&!ctl.state.scoring&&!ctl.state.submitting&&cribbageLegalMoves(ctl.state.session).length);
   const move=cribbageLegalMoves(ctl.state.session)[0],seq=ctl.state.session.sequence;
   for(const card of move.cards??(move.type==='play'?[move.card]:[]))root.querySelector('[data-cribbage-card="'+card+'"]').click();
   root.querySelector('[data-cribbage-action="'+move.type+'"]').click();
   await wait(()=>ctl.state.session.sequence===seq+1&&!ctl.state.scoring&&!ctl.state.submitting);
  }
  const result={round:ctl.state.session.privateView.round,posts,scoring:ctl.state.scoring,phase:ctl.state.session.privateView.phase,controls:cribbageLegalMoves(ctl.state.session).length};
  ctl.destroy();return result;
 });
 assert(outcome.round===4&&outcome.posts===18&&!outcome.scoring&&outcome.phase==='discard'&&outcome.controls>0,'three complete fixture hands failed '+JSON.stringify(outcome));
 console.log('BC-1.4 uninterrupted three-hand DOM/controller fixture PASS '+JSON.stringify(outcome));
 await page.close();
 console.log('BC-1.4 Chromium desktop/tablet/mobile acceptance PASSED');
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
