// Discovery metadata only. The authoritative game implementations remain in their existing clients.
export const games = Object.freeze([
  ['dice','Dice','Casino','clients/420bet-dice-v1'],
  ['keno','Keno','Casino',null],['plinko','Plinko','Casino',null],
  ['slots','Slots','Casino',null],['roulette','Roulette','Casino',null],
  ['blackjack','Blackjack','Casino',null],['mines','Mines','Casino',null],
  ['crash','Crash','Casino',null],['video-poker','Video Poker','Poker',null],
  ['live-poker','Live Poker','Poker','clients/420bet-poker'],
  ['poker-tournaments','Poker Tournaments','Poker','clients/420bet-poker'],
  ['fantasy','Fantasy Sports','Fantasy','clients/420bet-fantasy/daily'],
  ['sportsbook','Sportsbook','Sportsbook','clients/420bet-sports']
].map(([id,title,category,source])=>Object.freeze({id,title,category,source})));
export const categories=Object.freeze(['All Games','Casino','Poker','Fantasy','Sportsbook']);
export function resolveCatalogue(config={}) {
  return games.map(game=>{
    const route=config.routes?.[game.id];
    const declared=config.status?.[game.id]||'coming-soon';
    const validStatus=['coming-soon','preview','testing','available','unavailable'].includes(declared)?declared:'unavailable';
    const validRoute=typeof route==='string'&&route.startsWith('/')&&!route.startsWith('//')&&!/[\\\r\n]/.test(route);
    // The lobby is not a release authority; a route alone never enables wagering.
    const launchable=validRoute&&(validStatus==='preview'||validStatus==='testing'||validStatus==='available');
    return {...game,status:validStatus,route:launchable?route:null};
  });
}
