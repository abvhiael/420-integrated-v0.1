// BG-19.19 pagination boundary. Never attach directly to public ingress.
// The deployment must qualify all injected canonical/session/policy readers.
import {createHmac, timingSafeEqual} from 'node:crypto';
const ADDRESS=/^0x[0-9a-f]{40}$/i;
const HASH=/^0x[0-9a-f]{64}$/i;
const CLASSES=new Set(['HOME','FRIENDS','FOLLOWING']);
const unavailable=()=>Object.freeze({status:'unavailable',data:null});
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const validBlock=n=>Number.isSafeInteger(n)&&n>=0;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);

/** A signed cursor binds one viewer, session, feed and exact canonical snapshot.
 * readPage({viewer,feedClass,checkpoint,after,limit}) MUST return {checkpoint,
 * records:[{sortKey,publicDto,...}],hasMore:boolean}, in a deterministic strict
 * sortKey order. `after` is exclusively a previously emitted canonical key.
 * This module intentionally returns no HTTP handler and issues no credentials.
 */
export function createScopedSocialPagination({expectedChainId,signingKey,verifySession,
  readCanonicalState,readPage,authorizeRecord,now=Date.now,maxHeadLagBlocks=12,
  cursorTtlMs=60_000}={}){
  const configured=Number.isSafeInteger(expectedChainId)&&expectedChainId>0&&
    Buffer.isBuffer(signingKey)&&signingKey.length>=32&&
    [verifySession,readCanonicalState,readPage,authorizeRecord,now].every(fn=>typeof fn==='function')&&
    validBlock(maxHeadLagBlocks)&&Number.isSafeInteger(cursorTtlMs)&&cursorTtlMs>0;
  const sign=payload=>createHmac('sha256',signingKey).update(payload).digest();
  function decode(cursor){
    if(typeof cursor!=='string'||cursor.length>2048||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(cursor))return null;
    const [body,signature]=cursor.split('.');
    const raw=Buffer.from(body,'base64url');
    const mac=Buffer.from(signature,'base64url');
    if(raw.length>1024||mac.length!==32||!timingSafeEqual(mac,sign(body)))return null;
    const value=JSON.parse(raw.toString('utf8'));
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==
      'after,block,chain,expires,feed,hash,session,viewer')return null;
    return value;
  }
  const encode=value=>{const body=Buffer.from(JSON.stringify(value)).toString('base64url');return `${body}.${sign(body).toString('base64url')}`;};
  async function read({credential,feedClass='HOME',limit=20,cursor=null}={}){
    if(!configured||!CLASSES.has(feedClass)||!Number.isSafeInteger(limit)||limit<1||limit>50||
      (cursor!==null&&(typeof cursor!=='string'||cursor.length===0)))return unavailable();
    try{
      const session=await verifySession(credential);
      const tick=now();
      if(!Number.isSafeInteger(tick)||tick<0||session?.authenticated!==true||
        !ADDRESS.test(session.account??'')||session.chainId!==expectedChainId||
        typeof session.sessionId!=='string'||session.sessionId.length===0||
        !Number.isSafeInteger(session.expiresAt)||session.expiresAt<=tick)return unavailable();
      const viewer=session.account.toLowerCase();
      const prior=cursor===null?null:decode(cursor);
      if(cursor!==null&&(!prior||prior.chain!==expectedChainId||prior.feed!==feedClass||
        !equal(prior.viewer,viewer)||prior.session!==session.sessionId||
        !validBlock(prior.block)||!HASH.test(prior.hash??'')||
        typeof prior.after!=='string'||prior.after.length===0||prior.after.length>256||
        !Number.isSafeInteger(prior.expires)||prior.expires<=tick))return unavailable();
      const expected=prior?Object.freeze({chainId:prior.chain,indexedBlock:prior.block,indexedBlockHash:prior.hash}):null;
      const page=await readPage({viewer,feedClass,checkpoint:expected,after:prior?.after??null,limit});
      const cp=page?.checkpoint;
      if(!cp||cp.chainId!==expectedChainId||!validBlock(cp.indexedBlock)||!HASH.test(cp.indexedBlockHash??'')||
        prior&&(cp.indexedBlock!==prior.block||!equal(cp.indexedBlockHash,prior.hash))||
        !Array.isArray(page.records)||page.records.length>limit||typeof page.hasMore!=='boolean'||
        (page.hasMore&&page.records.length!==limit))return unavailable();
      const chain=await readCanonicalState({chainId:expectedChainId,indexedBlock:cp.indexedBlock});
      if(chain?.healthy!==true||chain.chainId!==expectedChainId||!validBlock(chain.headBlock)||
        !validBlock(chain.finalizedBlock)||chain.finalizedBlock>chain.headBlock||
        cp.indexedBlock>chain.finalizedBlock||chain.headBlock-cp.indexedBlock>maxHeadLagBlocks||
        !equal(chain.indexedBlockHash,cp.indexedBlockHash))return unavailable();
      const records=[];let last=prior?.after??null;
      for(const record of page.records){
        if(!record||typeof record!=='object'||Array.isArray(record)||
          typeof record.sortKey!=='string'||record.sortKey.length===0||record.sortKey.length>256||
          (last!==null&&record.sortKey>=last)||
          !own(record,'publicDto')||!record.publicDto||typeof record.publicDto!=='object'||
          Array.isArray(record.publicDto)||
          await authorizeRecord({viewer,feedClass,record,checkpoint:Object.freeze({...cp}),sessionId:session.sessionId})!==true)return unavailable();
        last=record.sortKey;
        records.push(Object.freeze({...record.publicDto}));
      }
      // A zero-record page with hasMore=true cannot advance and must fail closed.
      if(page.hasMore&&last===prior?.after)return unavailable();
      const current=await verifySession(credential);
      const finished=now();
      if(!Number.isSafeInteger(finished)||finished<0||current?.authenticated!==true||
        current.chainId!==expectedChainId||!equal(current.account,viewer)||
        current.sessionId!==session.sessionId||!Number.isSafeInteger(current.expiresAt)||
        current.expiresAt<=finished||prior&&prior.expires<=finished)return unavailable();
      // Recheck canonical hash after async per-record decisions to catch mid-page reorg.
      const endChain=await readCanonicalState({chainId:expectedChainId,indexedBlock:cp.indexedBlock});
      if(endChain?.healthy!==true||endChain.chainId!==expectedChainId||
        !validBlock(endChain.headBlock)||!validBlock(endChain.finalizedBlock)||
        cp.indexedBlock>endChain.finalizedBlock||endChain.finalizedBlock>endChain.headBlock||
        endChain.headBlock-cp.indexedBlock>maxHeadLagBlocks||
        !equal(endChain.indexedBlockHash,cp.indexedBlockHash))return unavailable();
      const expiry=Math.min(session.expiresAt,current.expiresAt,prior?.expires??Number.MAX_SAFE_INTEGER,finished+cursorTtlMs);
      const nextCursor=page.hasMore?encode({chain:expectedChainId,viewer,session:session.sessionId,
        feed:feedClass,block:cp.indexedBlock,hash:cp.indexedBlockHash.toLowerCase(),after:last,expires:expiry}):null;
      return Object.freeze({status:'ready',data:Object.freeze({feedClass,items:Object.freeze(records),
        snapshotBlock:cp.indexedBlock,hasMore:page.hasMore,cursor:nextCursor,authoritative:false})});
    }catch{return unavailable();}
  }
  return Object.freeze({configured,read});
}
