export const GAME_TYPES=Object.freeze(['CRIBBAGE','RUSSIAN_CRIBBAGE','CHESS','WORD_GAME','CHECKERS','BACKGAMMON','DOMINOES']);
export const GAME_STATES=Object.freeze(['NONE','INVITED','ACTIVE','FINISHED','DECLINED','CANCELLED']);
const HEX=/^0x[\da-fA-F]{64}$/;const ADDR=/^0x[\da-fA-F]{40}$/;
const ZERO='0x'+'0'.repeat(40);
function id(x,name){if(typeof x!=='string'||!HEX.test(x)||/^0x0{64}$/i.test(x))throw new Error(`invalid ${name}`);return x.toLowerCase();}
function account(x,name){if(typeof x!=='string'||!ADDR.test(x))throw new Error(`invalid ${name}`);return x.toLowerCase();}
function nonnegative(x,name){if(!Number.isSafeInteger(Number(x??0))||Number(x??0)<0)throw new Error(`invalid ${name}`);return Number(x??0);}
function enumeration(x,values,name){const v=typeof x==='number'?values[x]:x;if(!values.includes(v))throw new Error(`invalid ${name}`);return v;}
export function normalizeGameSession(raw,viewer){
 if(raw?.exists!==true)throw new Error('canonical session missing');
 const v=account(viewer,'viewer'),a=account(raw.playerA,'playerA'),b=account(raw.playerB,'playerB');
 if(a===b||(v!==a&&v!==b))throw new Error('viewer is not a session player');
 const state=enumeration(raw.state,GAME_STATES,'state');const startedAt=nonnegative(raw.startedAt,'startedAt');const finishedAt=nonnegative(raw.finishedAt,'finishedAt');
 if(state==='ACTIVE'&&!startedAt)throw new Error('active session missing start');
 if(['FINISHED','DECLINED','CANCELLED'].includes(state)&&!finishedAt)throw new Error('terminal session missing finish');
 const winner=account(raw.winner??ZERO,'winner');if(winner!==ZERO&&winner!==a&&winner!==b)throw new Error('winner not a player');
 return Object.freeze({sessionId:id(raw.sessionId,'sessionId'),gameType:enumeration(raw.gameType,GAME_TYPES,'gameType'),state,playerA:a,playerB:b,viewer:v,peer:v===a?b:a,rulesetHash:id(raw.rulesetHash,'rulesetHash'),nextMoveNumber:nonnegative(raw.nextMoveNumber,'nextMoveNumber'),createdAt:nonnegative(raw.createdAt,'createdAt'),startedAt,finishedAt,winner,randomnessRef:raw.randomnessRef??null,canonical:true});
}
export function normalizeGameHub({viewer,sessions=[],leaderboards=null,statistics=null}={}){
 if(!Array.isArray(sessions)||sessions.length>200)throw new Error('invalid games page');
 const seen=new Set();const entries=sessions.map(x=>normalizeGameSession(x,viewer));
 for(const x of entries){if(seen.has(x.sessionId))throw new Error('duplicate session');seen.add(x.sessionId);}
 entries.sort((a,b)=>(b.finishedAt||b.startedAt||b.createdAt)-(a.finishedAt||a.startedAt||a.createdAt)||a.sessionId.localeCompare(b.sessionId));
 return Object.freeze({invites:entries.filter(x=>x.state==='INVITED'&&x.viewer===x.playerB),outgoing:entries.filter(x=>x.state==='INVITED'&&x.viewer===x.playerA),active:entries.filter(x=>x.state==='ACTIVE'),history:entries.filter(x=>['FINISHED','DECLINED','CANCELLED'].includes(x.state)),leaderboards,statistics,canonical:true});
}
export function gameActions({session,viewer,walletView=null,policy=null,turn=null,rulesetReady=false}={}){
 const s=normalizeGameSession(session,viewer);const wallet=walletView?.connected===true&&walletView?.canWrite===true;
 const eligible=wallet&&policy?.profilesActive===true&&policy?.blockedEither===false;
 if(s.state==='INVITED')return Object.freeze(s.viewer===s.playerB?[{id:'accept',enabled:eligible&&policy?.canInviteToGame===true},{id:'decline',enabled:wallet}]:[{id:'cancel',enabled:wallet}]);
 if(s.state==='ACTIVE')return Object.freeze([{id:'move',enabled:eligible&&rulesetReady===true&&turn?.verified===true&&turn?.player===s.viewer&&turn?.nextMoveNumber===s.nextMoveNumber},{id:'finish',enabled:eligible}]);
 if(['FINISHED','DECLINED','CANCELLED'].includes(s.state))return Object.freeze([{id:'rematch',enabled:eligible&&policy?.canInviteToGame===true}]);
 return Object.freeze([]);
}
export function prepareGameIntent({kind,session=null,actor,recipient=null,gameType=null,rulesetHash=null,randomnessRef=null,wagerAmount=0,move=null,policy=null}={}){
 if(wagerAmount!==0&&wagerAmount!=='0')throw new Error('wager prohibited: Bong Goggles games are zero-wager');
 const a=account(actor,'actor');if(policy?.profilesActive!==true||policy?.blockedEither!==false)throw new Error('current policy unavailable');
 if(kind==='invite'||kind==='rematch'){
  const peer=account(recipient,'recipient');if(peer===a||policy.canInviteToGame!==true)throw new Error('invite ineligible');
  const game=enumeration(gameType,GAME_TYPES,'gameType');return Object.freeze({kind,actor:a,recipient:peer,gameType:game,rulesetHash:id(rulesetHash,'rulesetHash'),randomnessRef,canonicalAction:'BongGogglesGameSessionRegistry420.invite',requiresWalletApproval:true,authoritative:false,wagerAmount:0});
 }
 const s=normalizeGameSession(session,a);
 const methods={accept:'accept',decline:'decline',cancel:'cancel',finish:'finish',move:'commitMove'};
 if(!methods[kind])throw new Error('unsupported game action');
 if(kind==='accept'&&(s.state!=='INVITED'||a!==s.playerB||policy.canInviteToGame!==true))throw new Error('accept ineligible');
 if(kind==='decline'&&(s.state!=='INVITED'||a!==s.playerB))throw new Error('decline ineligible');
 if(kind==='cancel'&&(s.state!=='INVITED'||a!==s.playerA))throw new Error('cancel ineligible');
 if(kind==='finish'&&s.state!=='ACTIVE')throw new Error('finish ineligible');
 if(kind==='move'&&(s.state!=='ACTIVE'||move?.verified!==true||move?.nextMoveNumber!==s.nextMoveNumber||move?.player!==a||!move?.commitment))throw new Error('qualified move unavailable');
 return Object.freeze({kind,actor:a,sessionId:s.sessionId,move:kind==='move'?Object.freeze({commitment:id(move.commitment,'commitment'),nextMoveNumber:s.nextMoveNumber}):null,canonicalAction:`BongGogglesGameSessionRegistry420.${methods[kind]}`,requiresWalletApproval:true,authoritative:false,wagerAmount:0});
}
export function gameLink(sessionId){return `/games?session=${encodeURIComponent(id(sessionId,'sessionId'))}`;}
export function normalizeGameDetail({session,viewer,turn=null,policy=null,history=[],rulesetReady=false}={}){
 const s=normalizeGameSession(session,viewer);if(!Array.isArray(history))throw new Error('invalid move history');
 const verifiedTurn=turn?.verified===true&&turn?.sessionId===s.sessionId&&turn?.nextMoveNumber===s.nextMoveNumber&&[s.playerA,s.playerB].includes(turn.player);
 return Object.freeze({session:s,policy,turn:verifiedTurn?Object.freeze({...turn}):null,history:Object.freeze(history.map(x=>Object.freeze({moveNumber:nonnegative(x.moveNumber,'moveNumber'),commitment:id(x.commitment,'commitment')}))),rulesetReady:rulesetReady===true,canonical:true});
}
