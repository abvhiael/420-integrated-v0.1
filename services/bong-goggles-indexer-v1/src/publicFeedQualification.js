// BG-19.16: server-only qualification boundary for the anonymous DISCOVER sample.
// A deployment must inject independently qualified canonical-chain and current
// moderation/visibility readers. This adapter neither discovers a provider nor
// enables the HTTP listener by itself.
const HEX32 = /^0x[0-9a-f]{64}$/i;
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const POST = 'POST';

const sameHex = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const validBlock = n => Number.isSafeInteger(n) && n >= 0;

/**
 * readCanonicalState({chainId,indexedBlock}) must return an independently
 * sourced {chainId,headBlock,finalizedBlock,indexedBlockHash,healthy}.
 * readEligibility({objectId,author,checkpoint}) must consult the CURRENT
 * canonical object/author/audience/moderation policy, not a browser-supplied
 * or materialized-feed flag. It returns {allowed:true,objectId,author,
 * chainId,indexedBlock,indexedBlockHash,policyVersion} only after checking
 * withdrawals, deactivations, blocks, restrictions and moderation. Any absent
 * or ambiguous evidence denies. V1 supports plain public posts only: parent,
 * source and audience references are excluded until dependency policy exists.
 */
export function createPublicFeedQualification({
  expectedChainId, readMaterializedView, readCanonicalState, readEligibility,
  maxHeadLagBlocks = 12,
} = {}) {
  const configured = Number.isSafeInteger(expectedChainId) && expectedChainId > 0 &&
    typeof readMaterializedView === 'function' && typeof readCanonicalState === 'function' &&
    typeof readEligibility === 'function' && validBlock(maxHeadLagBlocks);
  const approved = new WeakMap();

  async function getView() {
    if (!configured) throw new Error('public_feed_unavailable');
    const view = await readMaterializedView();
    if (!view || !(view.feeds instanceof Map) || !(view.socialObjects instanceof Map) ||
        !(view.profiles instanceof Map) || !view.checkpoint) throw new Error('invalid_view');
    const cp = view.checkpoint;
    if (cp.chainId !== expectedChainId || !validBlock(cp.indexedBlock) ||
        !HEX32.test(cp.indexedBlockHash ?? '') || !HEX32.test(cp.stateRoot ?? '') ||
        !HEX32.test(cp.schemaHash ?? '')) throw new Error('invalid_checkpoint');
    const chain = await readCanonicalState({chainId: expectedChainId, indexedBlock: cp.indexedBlock});
    if (!chain || chain.healthy !== true || chain.chainId !== expectedChainId ||
        !validBlock(chain.headBlock) || !validBlock(chain.finalizedBlock) ||
        chain.finalizedBlock > chain.headBlock || cp.indexedBlock > chain.finalizedBlock ||
        chain.headBlock - cp.indexedBlock > maxHeadLagBlocks ||
        !HEX32.test(chain.indexedBlockHash ?? '') ||
        !sameHex(chain.indexedBlockHash, cp.indexedBlockHash)) throw new Error('noncanonical_or_stale');
    // The exact verified view is bound to its checkpoint; another view or
    // changed checkpoint must never inherit approval from an earlier request.
    approved.set(view, Object.freeze({...cp}));
    return view;
  }

  async function canShowPublicObject({object, author, checkpoint, anonymous} = {}) {
    if (!configured || anonymous !== true || !object || !author || !checkpoint ||
        object.objectType !== POST || object.status !== 'ACTIVE' ||
        object.audienceType !== 'PUBLIC' || object.audienceRef != null ||
        object.parentId != null || object.sourceObjectId != null ||
        !HEX32.test(object.objectId ?? '') || !ADDRESS.test(object.author ?? '') ||
        !ADDRESS.test(author.account ?? '') || !sameHex(object.author, author.account) ||
        author.active !== true || checkpoint.chainId !== expectedChainId ||
        !validBlock(checkpoint.indexedBlock) || !HEX32.test(checkpoint.indexedBlockHash ?? '')) return false;
    // Policy reader must supply CURRENT canonical permission and moderation
    // evidence tied to the verified indexed block. A plain boolean is unsafe.
    try {
      const result = await readEligibility({
        objectId: object.objectId.toLowerCase(), author: object.author.toLowerCase(),
        checkpoint: Object.freeze({...checkpoint}), anonymous: true,
      });
      return result?.allowed === true && sameHex(result.objectId, object.objectId) &&
        sameHex(result.author, object.author) && result.chainId === expectedChainId &&
        result.indexedBlock === checkpoint.indexedBlock &&
        sameHex(result.indexedBlockHash, checkpoint.indexedBlockHash) &&
        typeof result.policyVersion === 'string' && result.policyVersion.length > 0 &&
        result.authorActive === true && result.objectActive === true &&
        result.publicAudience === true && result.moderationPermits === true &&
        result.anonymousPermits === true;
    } catch { return false; }
  }

  // The route callback has no view argument. Bind the exact verified snapshot
  // for each request; avoid a process-global mutable 'last view' race.
  function dependencies() {
    return {
      async getView() {
        const view = await getView();
        const cp = approved.get(view);
        if (!cp) throw new Error('unapproved_view');
        return view;
      },
      canShowPublicObject,
    };
  }
  return Object.freeze({...dependencies(), configured});
}
