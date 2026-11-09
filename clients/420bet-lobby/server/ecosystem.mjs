// BET-AUDIT-7: read-only, game-scoped projection; never a betting or settlement authority.
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HASH=/^0x[0-9a-fA-F]{64}$/;
const GAME=/^[a-z][a-z0-9-]{0,49}$/;
const UINT=/^(0|[1-9][0-9]*)$/;
const TYPES=new Set(['WAGER_ACCEPTED','WAGER_SETTLED','WAGER_VOIDED','GAME_PAUSED','GAME_RESUMED']);
function ensure(ok,message){if(!ok)throw new Error(message);}
function integer(value){ensure(typeof value==='string'&&UINT.test(value),'invalid unsigned integer');return BigInt(value);}
function address(value){ensure(typeof value==='string'&&ADDRESS.test(value),'invalid account');return value.toLowerCase();}
function hash(value){ensure(typeof value==='string'&&HASH.test(value),'invalid hash');return value.toLowerCase();}
function scoped(event,scope,safeHead){
 ensure(event&&typeof event==='object'&&!Array.isArray(event),'invalid event');
 ensure(event.chainId===scope.chainId&&event.gameId===scope.gameId&&address(event.account)===scope.account,'cross-scope event');
 ensure(TYPES.has(event.type),'unknown event type');
 const block=integer(event.blockNumber);
 ensure(block<=safeHead,'unfinalized event');
 const index=integer(event.logIndex);
 ensure(index<=0xffffffffn,'invalid log index');
 return Object.freeze({chainId:scope.chainId,gameId:scope.gameId,account:scope.account,
  type:event.type,blockNumber:block.toString(),blockHash:hash(event.blockHash),
  transactionHash:hash(event.transactionHash),logIndex:index.toString()});
}
function scopeFor({chainId,gameId,account}){
 ensure(typeof chainId==='string'&&UINT.test(chainId)&&BigInt(chainId)>0n,'invalid chain');
 ensure(typeof gameId==='string'&&GAME.test(gameId),'invalid game');
 return {chainId,gameId,account:address(account)};
}
const key=event=>event.transactionHash+':'+event.logIndex;
// Call with a FULL replay window starting at rewindFrom, including empty blocks.
// Never infer canonicality from event ordering or from the browser.
export function reconcileFinalizedEvents({chainId,gameId,account,safeHead,rewindFrom='0',previous=[],events=[]}){
 const scope=scopeFor({chainId,gameId,account});
 const head=integer(safeHead),rewind=integer(rewindFrom);
 ensure(rewind<=head+1n,'invalid rewind');
 ensure(Array.isArray(previous)&&Array.isArray(events)&&previous.length<=10000&&events.length<=10000,'event page too large');
 const retained=previous.map(e=>scoped(e,scope,head)).filter(e=>integer(e.blockNumber)<rewind);
 const incoming=events.map(e=>scoped(e,scope,head));
 ensure(incoming.every(e=>integer(e.blockNumber)>=rewind),'event outside replay window');
 const merged=[...retained,...incoming];
 const hashes=new Map(),identities=new Map();
 for(const event of merged){
   const prior=hashes.get(event.blockNumber);
   ensure(!prior||prior===event.blockHash,'conflicting canonical block');
   hashes.set(event.blockNumber,event.blockHash);
   const id=key(event),old=identities.get(id);
   ensure(!old||JSON.stringify(old)===JSON.stringify(event),'conflicting event identity');
   identities.set(id,event);
 }
 const ordered=[...identities.values()].sort((a,b)=>{
  const ab=BigInt(a.blockNumber)-BigInt(b.blockNumber);
  if(ab)return ab<0n?-1:1;
  const ai=BigInt(a.logIndex)-BigInt(b.logIndex);
  return ai<0n?-1:ai>0n?1:a.transactionHash.localeCompare(b.transactionHash);
 });
 return Object.freeze(ordered);
}
export function projectPublicEventSummary(events){
 ensure(Array.isArray(events),'invalid projection');
 const counts=Object.fromEntries([...TYPES].map(type=>[type,0]));
 for(const event of events){ensure(TYPES.has(event.type),'unknown event');counts[event.type]++;}
 // Deliberately excludes bet amount, user identity, PII, balance and payout verdict.
 return Object.freeze(counts);
}
