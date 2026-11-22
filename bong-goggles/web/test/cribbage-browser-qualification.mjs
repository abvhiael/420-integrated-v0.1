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
   const source=await asset.text();
   const holes=document.querySelectorAll('.cribbage-hole');
   const buttons=document.querySelectorAll('[data-cribbage-card]');
   const large=window.innerWidth>1120;
   return {board:boxB?.toJSON?.(),hand:boxH?.toJSON?.(),
    holes:holes.length,buttons:buttons.length,large,
    noOverflow:document.documentElement.scrollWidth<=window.innerWidth+2,
    imageStatus:asset.status,embeddedArt:source.includes('data:image/webp;base64,'),
    btnName:buttons[0]?.getAttribute('aria-label'),
    transparent:document.body.innerHTML.includes('opponentHand')};
  });
  assert(data.holes===(count===3?360:240),'wrong rendered scoring hole count');
  assert(data.buttons===(count===2?6:5),'missing playable cards');
  assert(data.noOverflow,'mobile or desktop horizontal overflow at '+width);
  assert(data.imageStatus===200&&data.embeddedArt,'approved image missing/unsafely linked');
  assert(!data.transparent,'opponent secret present in DOM');
  assert(data.btnName?.startsWith('Select '),'card buttons not accessible');
  assert(data.board&&data.hand,'board and hand layout missing');
  if(data.large){
   assert(data.board.x>data.hand.x+data.hand.width*.7,'desktop board not on right');
   assert(Math.abs(data.board.width-data.hand.width)<width*.2,'desktop split not balanced');
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
  console.log('BC-1.4 Chromium '+width+'x'+height+' / '+count+
   ' players: board right/stack correct, '+data.holes+' holes, private hand buttons, artwork and axe PASS');
  await page.close();
 }
 console.log('BC-1.4 Chromium desktop/tablet/mobile acceptance PASSED');
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
