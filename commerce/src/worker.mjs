import { IndexerEventStream420 } from '../../420-indexer/dist/src/event-stream.js';
import { encodePositionCursor420 } from '../../420-indexer/dist/src/query-layer.js';
import { requireThat } from './security.mjs';

// Shared indexer stream adapter; RPC is used only for chain ancestry/finality,
// never log indexing. No requests to user-supplied origins and no redirects.
export class ProjectionWorker {
  constructor(projection,authority,{indexerUrl,fetcher=fetch}) {
    const base=new URL(indexerUrl); requireThat(base.protocol==='https:'||(authority.config.environment==='local'&&base.hostname==='127.0.0.1'),'insecure_indexer');
    this.projection=projection;this.authority=authority;
    this.stream=new IndexerEventStream420({protocolEvents:async(chainId,request)=>{
      const url=new URL('/v1/protocols/events',base);url.searchParams.set('chainId',chainId.toString());url.searchParams.set('protocol','420Market');url.searchParams.set('direction','asc');url.searchParams.set('limit','200');if(request.cursor)url.searchParams.set('cursor',request.cursor);
      const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(8000)});
      requireThat(response.ok,'indexer_unavailable',503);
      const bytes=Buffer.from(await response.arrayBuffer());requireThat(bytes.length<=4*1024*1024,'indexer_resource_limit',503);
      const result=JSON.parse(bytes);requireThat(result.apiVersion==='v1'&&Array.isArray(result.data?.items)&&result.data.items.length<=200,'indexer_schema',503);return result.data;
    }});
  }
  async syncOnce() {
    const p=this.projection,a=this.authority;
    await a.snapshot();requireThat(p.health().state!=='halted','projection_halted',503);
    const cp=p.db.get('SELECT * FROM projection_checkpoints WHERE chain_id=?',p.chainId);
    const finalized=await a.rpc.send('eth_getBlockByNumber',['finalized',false]);
    let cursor=cp.cursor,from=cp.height;
    if(cp.height>=p.startHeight) {
      const head=await a.rpc.send('eth_getBlockByNumber',['0x'+cp.height.toString(16),false]);
      if(head?.hash!==cp.canonical_block_hash) {
        let ancestor=cp.height-1;
        for(;ancestor>=p.startHeight;ancestor--) {
          const known=p.db.get('SELECT * FROM projection_blocks WHERE height=?',ancestor),canonical=await a.rpc.send('eth_getBlockByNumber',['0x'+ancestor.toString(16),false]);
          if(known?.hash===canonical?.hash)break;
          if(known?.finalized || ancestor<=cp.finalized_height)return p.halt('finalized_mismatch');
        }
        if(ancestor<cp.finalized_height)return p.halt('finalized_mismatch');
        from=ancestor+1;cursor=encodePositionCursor420({blockNumber:String(ancestor),txIndex:100000,logIndex:100000});
      }
    } else {from=p.startHeight;cursor=encodePositionCursor420({blockNumber:String(p.startHeight-1),txIndex:100000,logIndex:100000});}
    const batch=await this.stream.protocolEvents(BigInt(p.chainId),cursor?{cursor}:{ });
    const exhausted=batch.nextCursor===null;
    // Ignore unrelated Market inventory/policy events, but preserve stream cursor.
    batch.events=batch.events.filter(e=>['ListingPublished','ListingCancelled','OrderCreated','PaymentRecorded','FulfillmentRecorded','OrderCompleted','OrderCancelled','OrderDisputed','RefundRecorded'].includes(e.eventName));
    if(batch.events.length)from=Math.min(from,...batch.events.map(e=>Number(e.provenance.blockNumber)));
    const end=batch.events.length?Math.max(...batch.events.map(e=>Number(e.provenance.blockNumber))):Math.max(from,Number(BigInt(finalized.number)));
    const headers=[];
    const boundedEnd=Math.min(end,from+255);
    for(let height=from;height<=boundedEnd;height++) {
      const block=await a.rpc.send('eth_getBlockByNumber',['0x'+height.toString(16),false]);requireThat(block,'block_unavailable',503);
      headers.push({height,hash:block.hash,parentHash:block.parentHash,finalized:height<=Number(BigInt(finalized.number))});
    }
    if(end>boundedEnd) { batch.events=batch.events.filter(e=>Number(e.provenance.blockNumber)<=boundedEnd);const last=batch.events.at(-1);batch.nextCursor=last?encodePositionCursor420({blockNumber:last.provenance.blockNumber,txIndex:last.provenance.transactionIndex,logIndex:last.provenance.logIndex}):encodePositionCursor420({blockNumber:String(boundedEnd),txIndex:100000,logIndex:100000}); }
    else if(batch.nextCursor===null) {
      const last=batch.events.at(-1);batch.nextCursor=last?encodePositionCursor420({blockNumber:last.provenance.blockNumber,txIndex:last.provenance.transactionIndex,logIndex:last.provenance.logIndex}):cursor;
    }
    batch.caughtUp=exhausted&&end<=boundedEnd;
    return p.ingest(batch,headers);
  }
}
