// BC-4 approved design; not a playable release or licensed dictionary.
export const WORD_SALAD_VERSION='word-salad-design-v1';
export const PREMIUM=Object.freeze({sprout:[2,1],flower:[3,1],concentrate:[4,1],hotbox:[1,2],harvest:[1,3],mother:[1,2]});
const specs=[
[11,'Quick Hit',2,2,80,7,[[0,0,5],[0,5,4],[1,3,2],[2,2,4],[2,5,1],[3,4,3]]],
[13,'Personal Stash',2,3,100,7,[[0,3,4],[0,6,5],[1,1,2],[2,4,1],[3,3,3],[3,6,2],[4,5,4]]],
[15,'Classic',2,4,120,8,[[0,4,5],[1,1,4],[1,6,2],[2,3,1],[3,5,3],[4,4,4],[5,6,1],[6,7,2]]],
[17,'Big Bud',2,4,140,8,[[1,1,5],[1,8,4],[2,4,2],[2,6,1],[3,3,3],[3,7,2],[4,0,4],[4,5,1],[5,2,1],[5,6,4],[6,7,1],[8,3,3]]],
[19,'The Grow Room',2,6,180,8,[[0,0,5],[0,6,4],[1,3,2],[2,2,3],[2,8,1],[3,6,4],[4,4,5],[4,8,2],[5,7,1],[6,9,3],[7,8,4]]],
[21,'Mega Stash',2,6,220,8,[[0,0,5],[0,5,4],[0,10,5],[1,3,1],[2,2,3],[2,8,2],[3,6,4],[4,4,5],[4,9,1],[5,7,3],[6,6,4],[7,9,2],[8,10,1]]]
];
const types=[null,'sprout','flower','concentrate','hotbox','harvest','mother'];
export const BOARD_SPECS=Object.freeze(Object.fromEntries(specs.map(([size,name,minPlayers,maxPlayers,tileCount,rackSize,seeds])=>{
 const board=Array.from({length:size},()=>Array(size).fill(null)),m=size-1;
 for(const [r,c,t] of seeds)for(const [y,x] of [[r,c],[m-r,c],[r,m-c],[m-r,m-c],[c,r],[m-c,r],[c,m-r],[m-c,m-r]]){
 if(board[y][x]!==null&&board[y][x]!==types[t])throw Error('Conflicting premium');
 board[y][x]=types[t];
 }
 board[m/2][m/2]='mother';
 return [size,Object.freeze({size,name,minPlayers,maxPlayers,tileCount,rackSize,allRackBonus:rackSize===7?50:60,board:Object.freeze(board.map(Object.freeze))})];
})));
export const STANDARD_BOARD=17;
export const MODES=Object.freeze(['classic-salad','extra-dank','straight-greens']);
export function normalizeCannabisWord(word){
 if(typeof word!=='string')throw TypeError('Word required');
 const key=word.normalize('NFC').replace(/[\s\-’']/gu,'').toUpperCase();
 if(!/^[A-Z]{2,21}$/.test(key))throw RangeError('Unplayable word');
 return key;
}
// Scoring primitive: caller supplies authoritative newly occupied premiums,
// validated full words and immutable dictionary membership, never client claims.
export function scoreWord(letters,{cannabis=false,mode='classic-salad'}={}){
 if(!MODES.includes(mode)||!Array.isArray(letters)||letters.length<2||letters.length>21)throw Error('Invalid word');
 let sum=0,multiplier=1;
 for(const {value,blank=false,newlyPlaced=false,premium=null} of letters){
 if(!Number.isSafeInteger(value)||value<0||value>100||premium!==null&&!Object.hasOwn(PREMIUM,premium))throw Error('Invalid tile');
 const [l,w]=newlyPlaced&&premium!==null?PREMIUM[premium]:[1,1];
 sum+=(blank?0:value)*l; multiplier*=w;
 }
 const result=sum*multiplier*(cannabis&&mode!=='straight-greens'?2:1);
 if(!Number.isSafeInteger(result))throw Error('Score overflow');
 return result;
}
