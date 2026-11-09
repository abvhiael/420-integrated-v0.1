// BET-AUDIT-7: link finalized 420Indexer events to signed Registry and private owners.
// A log/receipt can prove an event; only independent Identity ownership may
// identify a recipient, especially for settlement events without account topics.
import {assertIndexerRegistryBinding} from './registry-verifier.mjs';
const TYPES={WAGER_ACCEPTED:'wager-accepted',WAGER_SETTLED:'wager-settled',
 WAGER_VOIDED:'wager-voided',POKER_HAND_SETTLED:'poker-hand-settled',
 POKER_HAND_CANCELLED:'poker-hand-cancelled',FANTASY_ENTRY_ACCEPTED:'fantasy-entry-accepted',
 FANTASY_POOL_SETTLED:'fantasy-pool-settled',FANTASY_POOL_CANCELLED:'fantasy-pool-cancelled',
 SPORTS_TICKET_FUNDED:'sports-ticket-funded',SPORTS_TICKET_SETTLED:'sports-ticket-settled',
 SPORTS_TICKET_FINALIZED:'sports-ticket-finalized'};
const VERTICAL={'casino-router':'casino','casino-settlement':'casino',
 'poker-ledger':'poker','poker-canonical':'poker','fantasy-contest':'fantasy',
 'sports-tickets':'sportsbook'};
const demand=(v,m)=>{if(!v)throw Error('420Bet notification source: '+m);};
const key=e=>[e.contract,e.transactionHash,e.logIndex,e.blockHash].join(':');
export function createFinalizedBetNotificationPublisher({
 reader,checkpointPath,verifyRegistry,resolveAudience,outbox,persistCheckpoint=reader?.persistCheckpoint
}={}){
 demand(reader?.config&&typeof reader.readCheckpoint==='function'&&
  typeof reader.poll==='function'&&typeof checkpointPath==='string'&&checkpointPath,
  'qualified Indexer reader required');
 demand(typeof verifyRegistry==='function'&&typeof resolveAudience==='function',
  'independent Registry and private ownership authorities required');
 demand(typeof outbox?.enqueue==='function'&&typeof outbox?.haltForReorg==='function',
  'durable outbox required');
 return Object.freeze({async publish({maxBlocks=64}={}){
  const approval=await verifyRegistry();
  demand(approval?.result?.qualified===true&&approval.config,'unqualified Registry');
  assertIndexerRegistryBinding(reader.config,approval.config);
  const prior=await reader.readCheckpoint(checkpointPath);
  const result=await reader.poll(prior,{maxBlocks});
  if(result.reorganized){
   await outbox.haltForReorg();
   return {reorganized:true,queued:0,halted:true};
  }
  const previous=new Set(prior.events.map(key));
  const sources=new Map(reader.config.contracts.map(s=>[s.address,s]));
  let queued=0,skipped=0;
  for(const event of result.state.events){
   if(previous.has(key(event)))continue;
   const source=sources.get(event.contract),kind=TYPES[event.type];
   if(!source||source.role!==event.role||!VERTICAL[event.role]||!kind){skipped++;continue;}
   const audience=await resolveAudience({
    chainId:event.chainId,gameVersionId:event.gameVersionId,
    sourceId:source.id,sourceAddress:source.address,role:event.role,objectId:event.objectId,
    blockNumber:event.blockNumber,
    account:event.account,kind,blockHash:event.blockHash,
    transactionHash:event.transactionHash,logIndex:event.logIndex
   });
   demand(Array.isArray(audience)&&audience.length<=50,'unverified private audience');
   for(const owner of audience){
    demand(owner?.ownershipVerified===true&&
     typeof owner.account==='string'&&/^0x[0-9a-fA-F]{40}$/.test(owner.account),
     'unverified ownership or account');
    if(event.account)demand(event.account.toLowerCase()===owner.account.toLowerCase(),
     'wrong owner account');
    const game=approval.config.games.find(g=>g.gameVersionId===owner.gameVersionId);
    demand(game&&game.vertical===VERTICAL[source.role]&&
     (!event.gameVersionId||event.gameVersionId===game.gameVersionId),
     'game version not approved for recipient');
    demand(owner.tenant==='420bet'&&
     typeof owner.userId==='string'&&owner.userId,'cross-tenant recipient');
    demand(Array.isArray(owner.subscriptions)&&owner.subscriptions.length<=16,
     'invalid subscription list');
    for(const sub of owner.subscriptions){
     const response=await outbox.enqueue({
      tenant:owner.tenant,userId:owner.userId,channel:sub.channel,
      subscriptionId:sub.id,recipient:sub.recipient,policyVersion:sub.policyVersion,
      source:'420Indexer-finalized',finality:'finalized',kind,
      event:{chainId:event.chainId,gameId:game.id,account:owner.account,
       blockNumber:event.blockNumber,blockHash:event.blockHash,
       transactionHash:event.transactionHash,logIndex:event.logIndex}
     });
     if(response.created)queued++;
    }
   }
  }
  // Commit only after all verified owner deliveries have reached durable outbox.
  // Crash before commit replays the same idempotent event keys.
  if(typeof persistCheckpoint==='function')await persistCheckpoint(checkpointPath,result.state);
  return {reorganized:false,queued,skipped,halted:false,
   nextBlock:result.state.nextBlock??null,scanned:result.scanned??null};
 }});
}
