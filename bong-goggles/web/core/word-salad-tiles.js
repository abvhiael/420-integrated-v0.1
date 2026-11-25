import {BOARD_SPECS,scoreWord} from './word-salad-rules.js';
// Hybrid tiles are standard. Values and bag balance are provisional pending corpus qualification.
export const HYBRID_SYMBOLS=Object.freeze(['QU','TH','PH','SH','CH','GH','CK','NG','WH','SC','ST','TR','LL','SS','OO']);
const singles='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const values=[1,3,3,2,1,3,3,2,1,6,4,2,3,1,1,3,8,1,1,1,2,4,4,6,3,8];
export const TILE_VALUES=Object.freeze(Object.fromEntries([...singles.map((s,i)=>[s,values[i]]),...HYBRID_SYMBOLS.map((s,i)=>[s,[8,3,5,3,5,4,4,3,4,4,2,2,3,2,2][i]]),['?',0]]));
const weights=[12,3,4,6,16,3,4,4,12,1,2,5,4,9,10,3,1,9,7,8,5,2,2,1,3,1];
const profiles={11:[2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],13:[3,1,2,1,2,2,1,1,1,1,1,2,1,1,1,1],15:[3,1,2,1,2,2,1,2,2,1,1,2,2,1,1,2],17:[4,2,3,2,3,3,2,2,2,1,1,3,2,2,2,2],19:[5,2,4,2,4,4,2,3,3,2,2,4,3,2,2,3],21:[6,3,5,3,5,5,3,3,4,2,2,5,4,3,3,4]};
export function tileDistribution(size){
 if(!Object.hasOwn(profiles,size))throw RangeError('Unknown board');
 const [blanks,...hybrids]=profiles[size];
 const remaining=BOARD_SPECS[size].tileCount-blanks-hybrids.reduce((a,b)=>a+b,0)-26;
 const total=weights.reduce((a,b)=>a+b,0);
 const raw=weights.map(w=>w*remaining/total);
 const counts=raw.map(v=>1+Math.floor(v));
 const left=remaining+26-counts.reduce((a,b)=>a+b,0);
 const order=raw.map((v,i)=>({i,f:v-Math.floor(v)})).sort((a,b)=>b.f-a.f||a.i-b.i);
 for(let i=0;i<left;i++)counts[order[i].i]++;
 return Object.freeze(Object.fromEntries([...singles.map((s,i)=>[s,counts[i]]),...HYBRID_SYMBOLS.map((s,i)=>[s,hybrids[i]]),['?',blanks]]));
}
// One physical tile occupies one cell; blank represents exactly one letter.
// Both letters of a hybrid are read in order in every word direction.
export function tileText(tile){
 if(!tile||!Object.hasOwn(TILE_VALUES,tile.symbol))throw Error('Unknown tile');
 if(tile.symbol==='?'){
 if(typeof tile.assignment!=='string'||!/^[A-Z]$/.test(tile.assignment))throw Error('Blank requires one letter');
 return tile.assignment;
 }
 if(tile.assignment!==undefined)throw Error('Only blanks may be assigned');
 return tile.symbol;
}
export function wordText(tiles){
 if(!Array.isArray(tiles)||tiles.length<2||tiles.length>21)throw Error('Word requires 2–21 occupied cells');
 return tiles.map(tileText).join('');
}
// Dictionary membership and premium/new-placement flags must come from authoritative game state.
export function scoreTileWord(tiles,{general,cannabis,mode='classic-salad'}){
 const word=wordText(tiles);
 const bonus=mode!=='straight-greens'&&cannabis.has(word);
 if(!general.has(word)&&!bonus)throw Error('Unknown word');
 return {word,cannabis:bonus,score:scoreWord(tiles.map(t=>({value:TILE_VALUES[t.symbol],blank:t.symbol==='?',newlyPlaced:t.newlyPlaced,premium:t.premium})),{cannabis:bonus,mode})};
}
