// ARC-1.1 bootstrap: presentation only. No runtime, network, registry, identity or wallet authority.
export function renderCatalog(games, target) {
  if (!target || typeof target.replaceChildren !== 'function') throw new TypeError('Invalid catalog root');
  if (!Array.isArray(games) || games.length !== 11) throw new TypeError('The frozen eleven-game catalog is required');
  const ids=new Set();
  const fragment=target.ownerDocument.createDocumentFragment();
  for (const game of games) {
    if (!/^420\/GAMING\/GAME\/ARCADE_[A-Z0-9_]+\/V1$/.test(game.gameId) || ids.has(game.gameId)) throw new TypeError('Untrusted or duplicate game identity');
    ids.add(game.gameId);
    const card=target.ownerDocument.createElement('article');
    card.className='game';
    const title=target.ownerDocument.createElement('h3');title.textContent=game.displayName;
    const description=target.ownerDocument.createElement('p');description.textContent='In development · Not yet playable';
    card.append(title,description);fragment.append(card);
  }
  target.replaceChildren(fragment);
}
if (typeof document!=='undefined') {
  const target=document.getElementById('games');
  fetch('./catalog.json',{cache:'no-store'})
    .then(response=>{if(!response.ok)throw new Error('Catalog unavailable');return response.json()})
    .then(data=>renderCatalog(data.games,target))
    .catch(()=>{const notice=document.createElement('p');notice.setAttribute('role','alert');notice.textContent='The game catalog could not be loaded. No games are enabled.';target?.replaceChildren(notice);});
}
