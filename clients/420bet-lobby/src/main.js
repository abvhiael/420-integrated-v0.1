import {WalletIdentity,loadHistory} from './wallet.js';
import './style.css';
import {createNativePreview} from './previews.js';
import {categories,resolveCatalogue,filterGames} from './catalogue.js';
const app=document.querySelector('#app');
const config=window.BET_LOBBY_CONFIG || {};
const historyEndpoint=config.historyEndpoint===undefined?'/api/420bet/player-history':config.historyEndpoint;
const catalogue=resolveCatalogue(config);
let filter='All Games',term='',active=null;
let walletState={account:null,chainId:null},historyItems=[],historyError='',historyNonce=0,historyGame='dice';
const wallet=new WalletIdentity(window.ethereum,state=>{walletState=state;historyItems=[];historyError='';void refreshHistory();if(!active)render();});
async function refreshHistory(){const serial=++historyNonce,account=walletState.account,chainId=walletState.chainId;historyItems=[];if(!account||!chainId||!historyEndpoint)return;try{const items=await loadHistory(historyEndpoint,account,chainId,historyGame);if(serial===historyNonce&&walletState.account===account&&walletState.chainId===chainId){historyItems=items;historyError='';if(!active)render();}}catch{if(serial===historyNonce){historyError='Transaction history unavailable';if(!active)render();}}}

const statusText={'coming-soon':'Coming Soon',preview:'Preview',testing:'Testing',available:'Available',unavailable:'Temporarily Unavailable'};
function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function button(label,fn,cls=''){const b=node('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;}
function close(){active=null;history.replaceState(null,'',location.pathname);render();}
function launch(game){active=game;history.replaceState(null,'',location.pathname+'#game='+encodeURIComponent(game.id));render();}
function render(){
  app.replaceChildren();
  if(active){
    const main=node('main','immersive');const bar=node('header','gamebar');
    bar.append(button('← Return to Lobby',close,'return'),node('strong','',active.title));
    const note=node('span','game-status',statusText[active.status]);bar.append(note);main.append(bar);
    if(active.route){const frame=node('iframe','gameframe');frame.title=active.title+' game';frame.src=active.route;frame.setAttribute('allow','fullscreen');main.append(frame);}
    else {const nativePreview=createNativePreview(active.id);if(nativePreview){const wrap=node('div','view-scroll');wrap.append(nativePreview);main.append(wrap);}else{const preview=node('section','preview-screen');preview.append(node('p','eyebrow','420BET GAME PREVIEW'),node('div','preview-glyph',({'Casino':'✦','Poker':'♠','Fantasy':'★','Sportsbook':'◆'})[active.category]),node('h1','',active.title),node('p','','This game screen is being prepared. Its dedicated interface is not yet connected.'),node('p','preview-warning','Viewing only — wagering, wallet transactions and payouts are not enabled here.'));preview.append(button('Return to Lobby',close,'return'));main.append(preview);}}
    app.append(main);return;
  }
  const header=node('header','top');const brand=node('a','brand','♣ 420BET');brand.href='/';header.append(brand,node('span','strap','THE GAME LOBBY'));const walletBar=node('div','wallet-bar');walletBar.setAttribute('aria-label','Wallet identity');if(walletState.account){walletBar.append(node('span','wallet-account',walletState.account.slice(0,6)+'…'+walletState.account.slice(-4)+' · chain '+(walletState.chainId??'unknown')));walletBar.append(button('Refresh history',()=>{void refreshHistory();},'wallet-action'));}else walletBar.append(button('Connect wallet',()=>{void wallet.connect().catch(()=>{historyError='Wallet connection was rejected or unavailable';render();});},'wallet-action'));header.append(walletBar);app.append(header);
  const main=node('main','lobby');const hero=node('section','hero');hero.append(node('p','eyebrow','WELCOME TO 420BET'),node('h1','', 'Pick your game. Find your groove.'),node('p','','Casino classics, poker, fantasy and sports — all in one place.'));main.append(hero);
  const accountPanel=node('section','account-panel');accountPanel.setAttribute('aria-label','Player transaction history');accountPanel.append(node('h2','','Game transaction history'));const gamePicker=node('select','history-game');gamePicker.setAttribute('aria-label','History game');for(const g of catalogue){const option=node('option','',g.title);option.value=g.id;if(g.id===historyGame)option.selected=true;gamePicker.append(option);}gamePicker.value=historyGame;gamePicker.addEventListener('change',()=>{historyGame=gamePicker.value;historyNonce++;historyItems=[];historyError='';void refreshHistory();render();});accountPanel.append(gamePicker);if(historyError)accountPanel.append(node('p','history-error',historyError));if(!walletState.account)accountPanel.append(node('p','','Connect your wallet to view records for the selected game only. Browsing does not require a wallet.'));else if(!historyEndpoint)accountPanel.append(node('p','','Verified history service is not configured. No transaction records are being displayed.'));else if(!historyItems.length)accountPanel.append(node('p','','No verified transactions returned for this game, wallet and chain.'));else{const list=node('ul','history-list');for(const item of historyItems){const li=node('li','history-entry');const hash=node('code','',item.hash.slice(0,10)+'…'+item.hash.slice(-6));hash.title=item.hash;li.append(node('span','',item.game+' · '+item.status),node('time','',new Date(item.timestamp*1000).toLocaleString()),hash);list.append(li);}accountPanel.append(list);}main.append(accountPanel);
  const controls=node('section','controls');controls.setAttribute('aria-label','Game discovery');
  const nav=node('div','categories');categories.forEach(c=>{const b=button(c,()=>{filter=c;render();},c===filter?'selected':'');b.setAttribute('aria-pressed',String(c===filter));nav.append(b);});controls.append(nav);
  const search=node('input','search');search.type='search';search.placeholder='Search games';search.setAttribute('aria-label','Search games');search.value=term;search.addEventListener('input',()=>{term=search.value;updateGrid();});controls.append(search);main.append(controls);
  const grid=node('section','grid');grid.id='game-grid';grid.setAttribute('aria-label','Games');main.append(grid);
  const footer=node('footer','footer','Game visibility does not authorize wagering. Access depends on environment, eligibility and release approvals.');main.append(footer);app.append(main);updateGrid();
}
function updateGrid(){
  const grid=document.querySelector('#game-grid');if(!grid)return;grid.replaceChildren();
  const matched=filterGames(catalogue,filter,term);
  if(!matched.length){grid.append(node('p','empty','No games match your search.'));return;}
  matched.forEach(g=>{
    const card=node('article','card');const art=node('div','art art-'+g.category.toLowerCase().replace(' ','-'));art.setAttribute('aria-hidden','true');art.textContent=({'Casino':'✦','Poker':'♠','Fantasy':'★','Sportsbook':'◆'})[g.category];card.append(art);
    const details=node('div','details');details.append(node('small','category',g.category),node('h2','',g.title),node('span','status',statusText[g.status]));
    details.append(button(g.route?'Enter game':'View preview',()=>launch(g),'open'));card.append(details);grid.append(card);
  });
}
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&active)close();});
render();
