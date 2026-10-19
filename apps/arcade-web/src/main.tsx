import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import catalog from '../../../config/arcade-game-identities.json';
import scope from '../../../config/arcade-0-7-scope-freeze.json';

type Game = {gameId: string; slug: string; displayName: string; registration: string; walletRequiredForCore: boolean};
const games: Game[] = catalog.games;
if (games.length !== 11 || scope.scope.genesisGames.length !== 11 || !games.every((game,index) => game.slug === scope.scope.genesisGames[index] && game.registration === 'UNREGISTERED' && !game.walletRequiredForCore)) {
  throw new Error('Canonical 420Arcade game scope or permission mismatch');
}
const seen = new Set<string>();
for (const game of games) {
  if (!/^420\/GAMING\/GAME\/ARCADE_[A-Z0-9_]+\/V1$/.test(game.gameId) || seen.has(game.gameId)) throw new Error('Invalid or duplicate game identity');
  seen.add(game.gameId);
}
function Launcher() {
  return <><header><strong>420Arcade</strong><span className="status">Launcher bootstrap · No games installed</span></header>
    <main id="main" tabIndex={-1}><h1>420Arcade</h1><p>Eleven games are planned. This development preview does not enable games, accounts, rewards, or wallet access.</p>
      <section aria-labelledby="games-heading"><h2 id="games-heading">Game catalog</h2><div className="grid">
        {games.map(game => <article className="game" key={game.gameId}><h3>{game.displayName}</h3><p>In development · Not yet playable</p></article>)}
      </div></section></main>
    <footer>Offline-ready games and accessible controls are implementation requirements, not yet certified features.</footer></>;
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(<React.StrictMode><Launcher /></React.StrictMode>);
