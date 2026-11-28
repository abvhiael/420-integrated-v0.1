// CK-1.2 versioned public state boundary; no client authority or playable engine.
export const CHECKERS_PROTOCOL='bg-checkers-state-v1';
export const CHECKERS_RULE_VERSION='v1';
export const CHECKERS_GAME_ID='checkers';
export const CHECKERS_VARIANT='english-draughts';
export const CHECKERS_RELEASE_READY=false;
export function checkersActivation(mode){
 if(mode===undefined||mode===''||mode==='disabled')return false;
 throw Error('Checkers gameplay is not release-qualified');
}
export function normalizeCheckersState(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
  Object.keys(value).sort().join(',')!=='board,continuation,gameId,phase,revision,rulesVersion,schema,turn,variant,winner'||
  value.schema!==CHECKERS_PROTOCOL||value.gameId!==CHECKERS_GAME_ID||value.rulesVersion!==CHECKERS_RULE_VERSION||
  value.variant!==CHECKERS_VARIANT||!Number.isSafeInteger(value.revision)||value.revision<0||
  !Array.isArray(value.board)||value.board.length!==64||
  !['active','finished'].includes(value.phase))return null;
 const board=value.board;
 if(Array.from(board).some((p,i)=>!['','r','R','b','B'].includes(p)||(p!==''&&(Math.floor(i/8)+i%8)%2!==1)))return null;
 if(board.filter(p=>p==='r'||p==='R').length>12||board.filter(p=>p==='b'||p==='B').length>12)return null;
 if(value.phase==='active'){
  if(!['red','black'].includes(value.turn)||value.winner!==null)return null;
  if(value.continuation!==null&&(!Number.isInteger(value.continuation)||value.continuation<0||value.continuation>63||
   !({red:['r','R'],black:['b','B']}[value.turn].includes(board[value.continuation]))))return null;
 }else if(value.turn!==null||value.continuation!==null||![null,'red','black'].includes(value.winner))return null;
 return Object.freeze({...value,board:Object.freeze([...board])});
}
