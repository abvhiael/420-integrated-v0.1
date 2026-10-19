import React from 'react';
import catalog from '../../../config/arcade-game-identities.json';
import scope from '../../../config/arcade-0-7-scope-freeze.json';
export type ArcadeGame = {gameId:string;slug:string;displayName:string;registration:string;walletRequiredForCore:boolean};
export function validateCatalog(games: ArcadeGame[], frozenSlugs: string[]): ReadonlyArray<ArcadeGame> {
  if(games.length!==11||frozenSlugs.length!==11)throw new Error('Canonical game count mismatch');
  const seen=new Set<string>();
  for(const [index,g] of games.entries()) {
    if(g.slug!==frozenSlugs[index]||!/^420\/GAMING\/GAME\/ARCADE_[A-Z0-9_]+\/V1$/.test(g.gameId)||seen.has(g.gameId)||g.registration!=='UNREGISTERED'||g.walletRequiredForCore!==false)throw new Error('Untrusted or unauthorized Arcade catalog');
    seen.add(g.gameId);
  }
  return games;
}
const games=validateCatalog(catalog.games,scope.scope.genesisGames);
export function Launcher() {
  return <><header><strong>420Arcade</strong><span className="status" aria-live="polite">Launcher bootstrap · No games installed</span></header>
    <main id="main" tabIndex={-1}><h1>420Arcade</h1><p>Eleven games are planned. This development preview does not enable games, accounts, rewards, or wallet access.</p>
      <section aria-labelledby="games-heading"><h2 id="games-heading">Game catalog</h2><div className="grid">
        {games.map(game => <article className="game" key={game.gameId}><h3>{game.displayName}</h3><p>In development · Not yet playable</p></article>)}
      </div></section></main>
    <footer>Offline-ready games and accessible controls are implementation requirements, not yet certified features.</footer></>;
}
