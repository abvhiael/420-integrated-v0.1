// BG-19.19: service-side guard for account-scoped social projections.
// No HTTP route, Wallet authentication, canonical reader, or session provider is
// created here. Deployers must independently qualify every injected callback.
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const HEX32 = /^0x[0-9a-f]{64}$/i;
const FEEDS = new Set(['HOME', 'FRIENDS', 'FOLLOWING']);
const RESOURCES = new Set(['feed', 'profile', 'relationships', 'community']);
const validBlock = n => Number.isSafeInteger(n) && n >= 0;
const same = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const unavailable = () => Object.freeze({status:'unavailable',data:null});

/**
 * verifySession(opaqueCredential) MUST independently verify an unexpired,
 * unrevoked Wallet/Identity session, chain and audience binding, returning
 * {authenticated:true,account,chainId,sessionId,expiresAt}.
 * readCanonicalState({chainId,indexedBlock}) MUST independently confirm the
 * finalized indexed block hash and current head/health.
 * readProjection({resource,feedClass,viewer,subject,limit}) MUST return a
 * checkpoint-bound {checkpoint,records} from the named chain. It is never an
 * authorization source. authorizeRecord(...) MUST check the CURRENT canonical
 * per-record viewer entitlement, owner, block/mute, membership, moderation and
 * audience state and return exactly true. No client viewer override is accepted.
 */
export function createScopedSocialRead({expectedChainId, verifySession, readCanonicalState,
  readProjection, authorizeRecord, now=Date.now, maxHeadLagBlocks=12}={}) {
  const configured = Number.isSafeInteger(expectedChainId) && expectedChainId>0 &&
    [verifySession,readCanonicalState,readProjection,authorizeRecord,now].every(x=>typeof x==='function') &&
    validBlock(maxHeadLagBlocks);
  async function read({credential,resource,feedClass=null,subject=null,limit=20}={}) {
    if(!configured || !RESOURCES.has(resource) || !Number.isSafeInteger(limit) || limit<1 || limit>50 ||
      (resource==='feed' ? !FEEDS.has(feedClass) || subject!==null : feedClass!==null) ||
      (resource==='community' && !HEX32.test(subject??'')) ||
      (resource==='relationships' && subject!==null) ||
      (resource==='profile' && subject!==null && !ADDRESS.test(subject))) return unavailable();
    try {
      const session=await verifySession(credential);
      const timestamp=now();
      if(!Number.isSafeInteger(timestamp) || timestamp<0 || session?.authenticated!==true ||
        session.chainId!==expectedChainId || !ADDRESS.test(session.account??'') ||
        typeof session.sessionId!=='string' || session.sessionId.length<1 ||
        !Number.isSafeInteger(session.expiresAt) || session.expiresAt<=timestamp) return unavailable();
      const viewer=session.account.toLowerCase();
      const query=Object.freeze({resource,feedClass,viewer,subject:subject?.toLowerCase()??null,limit});
      const projection=await readProjection(query);
      const cp=projection?.checkpoint;
      if(!cp || cp.chainId!==expectedChainId || !validBlock(cp.indexedBlock) ||
        !HEX32.test(cp.indexedBlockHash??'') || !Array.isArray(projection.records) ||
        projection.records.length>limit) return unavailable();
      const chain=await readCanonicalState({chainId:expectedChainId,indexedBlock:cp.indexedBlock});
      if(chain?.healthy!==true || chain.chainId!==expectedChainId || !validBlock(chain.headBlock) ||
        !validBlock(chain.finalizedBlock) || chain.finalizedBlock>chain.headBlock ||
        cp.indexedBlock>chain.finalizedBlock || chain.headBlock-cp.indexedBlock>maxHeadLagBlocks ||
        !HEX32.test(chain.indexedBlockHash??'') || !same(chain.indexedBlockHash,cp.indexedBlockHash)) return unavailable();
      const records=[];
      for(const record of projection.records){
        if(!record || typeof record!=='object' || Array.isArray(record) ||
          await authorizeRecord({viewer,resource,feedClass,subject:query.subject,record,
            checkpoint:Object.freeze({...cp}),sessionId:session.sessionId}) !== true) return unavailable();
        // Caller supplies independently reviewed least-data DTOs. Never pass
        // an unfiltered raw materialized record through this boundary.
        if(typeof record.publicDto!=='object' || record.publicDto===null || Array.isArray(record.publicDto)) return unavailable();
        records.push(Object.freeze({...record.publicDto}));
      }
      // Reverify the session after asynchronous projection and policy work;
      // a revoked/expired/changed session must not receive a successful page.
      const current=await verifySession(credential);
      if(current?.authenticated!==true || current.chainId!==expectedChainId ||
        !same(current.account,viewer) || current.sessionId!==session.sessionId ||
        !Number.isSafeInteger(current.expiresAt) || current.expiresAt<=now()) return unavailable();
      return Object.freeze({status:'ready',data:Object.freeze({records:Object.freeze(records),
        snapshotBlock:cp.indexedBlock,authoritative:false})});
    } catch {return unavailable();}
  }
  return Object.freeze({configured,read});
}
