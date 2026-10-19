import React, {useEffect, useRef, useState} from 'react';
import catalog from '../../../config/arcade-game-identities.json';
import scope from '../../../config/arcade-0-7-scope-freeze.json';

export type ArcadeGame = {gameId:string;slug:string;displayName:string;registration:string;walletRequiredForCore:boolean};
export type CatalogFilter = 'all' | 'action' | 'puzzle' | 'creative' | 'companion' | 'exploration';
export function categoryOf(game:ArcadeGame): Exclude<CatalogFilter,'all'> {
 switch(game.slug) {
  case 'kush-crush': return 'puzzle';
  case '420colouring-book': return 'creative';
  case '420buddy': return 'companion';
  case 'wheres-dave': return 'exploration';
  default: return 'action';
 }
}
export function discoverGames(roster:ReadonlyArray<ArcadeGame>, rawQuery:string, category:CatalogFilter='all'): ArcadeGame[] {
 if(!['all','action','puzzle','creative','companion','exploration'].includes(category)) throw new TypeError('Unsupported discovery filter');
 const q=rawQuery.normalize('NFKC').trim().toLocaleLowerCase('en').slice(0,100);
 return roster.filter(g=>(category==='all'||categoryOf(g)===category)&&
  (!q||g.displayName.toLocaleLowerCase('en').includes(q)||g.slug.includes(q)||categoryOf(g).includes(q)));
}
export function launchEligibility(game:ArcadeGame):{canLaunch:false;reason:string} {
 if (!games.some(g=>g.gameId===game.gameId&&g.slug===game.slug)) throw new TypeError('Unknown canonical game');
 return {canLaunch:false,reason:'Game runtime not installed'};
}
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
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState<CatalogFilter>('all');
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
    <section aria-label="Planned games">
     <form className="discovery" role="search" onSubmit={event=>event.preventDefault()}>
      <label htmlFor="game-search">Search games</label>
      <input id="game-search" type="search" value={query} onChange={event=>setQuery(event.currentTarget.value)} maxLength={100} placeholder="Find a game" autoComplete="off"/>
      <label htmlFor="game-category">Browse by category</label>
      <select id="game-category" value={category} onChange={event=>setCategory(event.currentTarget.value as CatalogFilter)}>
       <option value="all">All games</option><option value="action">Action</option><option value="puzzle">Puzzle</option><option value="creative">Creative</option><option value="companion">Companion</option><option value="exploration">Exploration</option>
      </select>
      <button type="button" onClick={()=>{setQuery('');setCategory('all')}}>Clear filters</button>
     </form>
     <p role="status" aria-live="polite">{discoverGames(games,query,category).length} of 11 games shown</p>
     {discoverGames(games,query,category).length===0&&<p>No matching games. Try another search or category.</p>}
     <div className="grid">{discoverGames(games,query,category).map(g=><article className="game" key={g.gameId}>
      <span className="category">{categoryOf(g)}</span>
      <h2><a href={'#/games/'+g.slug}>{g.displayName}</a></h2>
      <p>In development · Not yet playable</p>
      <a className="details" href={'#/games/'+g.slug} aria-label={'View '+g.displayName+' details'}>View details</a>
     </article>)}</div>
    </section>
   </>}
   {route.kind==='game'&&game&&<section aria-label="Game availability">
    <p>Category: {categoryOf(game)} · Versioned game candidate · Not yet playable</p>
    <p>This game is in development and cannot yet be played.</p>
    <p>No wallet, registration or payment is needed to browse the catalog.</p>
    <button type="button" disabled aria-describedby="launch-unavailable">Launch game</button>
    <p id="launch-unavailable" role="status">{launchEligibility(game).reason}</p>
    <a href="#/games">Back to games</a>
   </section>}
   {route.kind==='about'&&<section><p>420Arcade is an eleven-game project. The launcher is an early preview, not a public release.</p><p>Guest-first gameplay and optional Gaming Protocol integration are planned; no live gaming authority is enabled.</p><a href="#/games">Explore games</a></section>}
   {route.kind==='accessibility'&&<section><p>The interface offers keyboard-operable navigation, a skip link, scalable text and reduced-motion styling.</p><p>Game accessibility, offline play and device support are requirements still awaiting implementation and testing.</p><a href="#/games">Return to games</a></section>}
   {route.kind==='not-found'&&<section role="status"><p>This address does not match an approved Arcade page or game.</p><a href="#/games">Return to the game catalog</a></section>}
  </main>
  <footer className="site-footer"><p>420Arcade · Development preview. No playable games, online rewards or production authorization.</p>
   <a href="#/accessibility">Accessibility information</a></footer>
 </>;
}
