import React, {useEffect, useRef, useState} from 'react';
import catalog from '../../../config/arcade-game-identities.json';
import scope from '../../../config/arcade-0-7-scope-freeze.json';

export type ArcadeGame = {gameId:string;slug:string;displayName:string;registration:string;walletRequiredForCore:boolean};
export type Route = {kind:'catalog'} | {kind:'about'} | {kind:'accessibility'} | {kind:'game';slug:string} | {kind:'not-found'};
export function validateCatalog(games: ArcadeGame[], frozenSlugs: string[]): ReadonlyArray<ArcadeGame> {
 if(games.length!==11||frozenSlugs.length!==11) throw new Error('Canonical game count mismatch');
 const seen=new Set<string>(), slugs=new Set<string>();
 for(const [index,g] of games.entries()) {
  if(g.slug!==frozenSlugs[index]||!/^420\/GAMING\/GAME\/ARCADE_[A-Z0-9_]+\/V1$/.test(g.gameId)||seen.has(g.gameId)||slugs.has(g.slug)||g.registration!=='UNREGISTERED'||g.walletRequiredForCore!==false)throw new Error('Untrusted or unauthorized Arcade catalog');
  seen.add(g.gameId);slugs.add(g.slug);
 }
 return games;
}
const games=validateCatalog(catalog.games,scope.scope.genesisGames);
export function resolveRoute(hash:string, roster:ReadonlyArray<ArcadeGame>=games):Route {
 if(hash===''||hash==='#'||hash==='#/'||hash==='#/games') return {kind:'catalog'};
 if(hash==='#/about')return {kind:'about'};
 if(hash==='#/accessibility')return {kind:'accessibility'};
 const match=/^#\/games\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(hash);
 if(match&&roster.some(game=>game.slug===match[1]))return {kind:'game',slug:match[1]};
 return {kind:'not-found'};
}
export function Launcher({initialRoute}:{initialRoute?:Route}={}) {
 const [route,setRoute]=useState<Route>(()=>initialRoute??resolveRoute(typeof window==='undefined'?'':window.location.hash));
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  if(initialRoute)return;
  const update=()=>setRoute(resolveRoute(window.location.hash));
  window.addEventListener('hashchange',update);
  update();
  return()=>window.removeEventListener('hashchange',update);
 },[initialRoute]);
 useEffect(()=>{heading.current?.focus();},[route]);
 const game=route.kind==='game'?games.find(g=>g.slug===route.slug):undefined;
 const pageTitle=route.kind==='catalog'?'Game catalog':route.kind==='about'?'About 420Arcade':route.kind==='accessibility'?'Accessibility and support':route.kind==='game'?(game?.displayName??'Game unavailable'):'Page not found';
 return <>
  <header className="site-header"><a className="brand" href="#/games" aria-label="420Arcade home">420Arcade</a>
   <nav aria-label="Primary navigation" className="primary-nav">
    <a href="#/games" aria-current={route.kind==='catalog'||route.kind==='game'?'page':undefined}>Games</a>
    <a href="#/about" aria-current={route.kind==='about'?'page':undefined}>About</a>
    <a href="#/accessibility" aria-current={route.kind==='accessibility'?'page':undefined}>Accessibility</a>
   </nav>
   <span className="status" aria-live="polite">Launcher preview · No games installed</span>
  </header>
  <main id="main" tabIndex={-1} className="site-main">
   <h1 tabIndex={-1} ref={heading}>{pageTitle}</h1>
   {route.kind==='catalog'&&<>
    <p>Browse the eleven approved titles. Every game is currently in development; no game can yet be launched.</p>
    <section aria-label="Planned games"><div className="grid">{games.map(g=><article className="game" key={g.gameId}>
     <h2><a href={'#/games/'+g.slug}>{g.displayName}</a></h2><p>In development · Not yet playable</p></article>)}</div></section>
   </>}
   {route.kind==='game'&&game&&<section aria-label="Game availability"><p>This game is in development and cannot yet be played.</p><p>No wallet, registration or payment is needed to browse the catalog.</p><a href="#/games">Back to games</a></section>}
   {route.kind==='about'&&<section><p>420Arcade is an eleven-game project. The launcher is an early preview, not a public release.</p><p>Guest-first gameplay and optional Gaming Protocol integration are planned; no live gaming authority is enabled.</p><a href="#/games">Explore games</a></section>}
   {route.kind==='accessibility'&&<section><p>The interface offers keyboard-operable navigation, a skip link, scalable text and reduced-motion styling.</p><p>Game accessibility, offline play and device support are requirements still awaiting implementation and testing.</p><a href="#/games">Return to games</a></section>}
   {route.kind==='not-found'&&<section role="status"><p>This address does not match an approved Arcade page or game.</p><a href="#/games">Return to the game catalog</a></section>}
  </main>
  <footer className="site-footer"><p>420Arcade · Development preview. No playable games, online rewards or production authorization.</p>
   <a href="#/accessibility">Accessibility information</a></footer>
 </>;
}
