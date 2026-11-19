import { keccak256Hex } from './keccak.js';

// The three namespaces are intentionally distinct (service, discovery component, capability).
export const TREASURY_SERVICE_ID_420 = '420/service/treasury/v1';
export const TREASURY_ROUTER_COMPONENT_420 = '420/APP/420TREASURY/TREASURY_ROUTER';
export const TREASURY_CAPABILITY_COMPONENT_420 = '420/TREASURY/COMPONENT/V1';
export const TREASURY_EXECUTION_ACTION_420 = '420/TREASURY/ACTION/EXECUTE_DISBURSEMENT/V1';
export const TREASURY_EVIDENCE_420 = 'AUTHORIZED_EXECUTOR_COMMITMENT_ONLY';
const REGISTRY = '0x0000000000000000000000000000000000000434';
const TIMELOCK = '0x0000000000000000000000000000000000000429';
const require = (condition, message) => { if (!condition) throw new Error(message); };
const bytes = value => Uint8Array.from(value.slice(2).match(/../g) || [], x => parseInt(x, 16));
const hash = value => keccak256Hex(bytes(value));
const textHash = value => keccak256Hex(new TextEncoder().encode(value));
const hex = (value, length) => {
  require(typeof value === 'string' && /^0x(?:[0-9a-fA-F]{2})*$/.test(value) && (length == null || value.length === 2 + length * 2), 'invalid Treasury hex');
  return value.toLowerCase();
};
const id = value => { const x = hex(value, 32); require(BigInt(x) !== 0n, 'zero Treasury identifier'); return x; };
const addr = (value, allowZero = false) => { const x = hex(value, 20); require(allowZero || BigInt(x) !== 0n, 'zero Treasury address'); return x; };
const aw = value => addr(value, true).slice(2).padStart(64, '0');
const integer = (value, bits = 256) => {
  require(typeof value === 'bigint' || (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value)), 'exact Treasury integer required');
  const n = BigInt(value); require(n >= 0n && n < (1n << BigInt(bits)), 'Treasury integer range'); return n;
};
const uw = (value, bits = 256) => integer(value, bits).toString(16).padStart(64, '0');
const iw = value => id(value).slice(2);
const word = value => BigInt('0x' + value);
const address = (value, allowZero = false) => { require(word(value) < (1n << 160n), 'malformed Treasury address'); return addr('0x' + value.slice(24), allowZero); };
const data = (signature, ...args) => textHash(signature).slice(0, 10) + args.join('');
function words(result, count) {
  const h = hex(result, count * 32).slice(2);
  return Array.from({length: count}, (_, i) => h.slice(i * 64, (i + 1) * 64));
}
function stringResult(result) {
  const h = hex(result).slice(2);
  require(h.length >= 128 && word(h.slice(0,64)) === 32n, 'invalid Treasury identity');
  const n = word(h.slice(64,128));
  require(n <= 128n && h.length === 128 + Math.ceil(Number(n)/32)*64, 'invalid Treasury identity');
  return new TextDecoder('utf-8', {fatal:true}).decode(bytes('0x' + h.slice(128,128+Number(n)*2)));
}
const chain = value => { require(typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value) && BigInt(value) > 0n, 'invalid Treasury chain'); return BigInt(value); };
const commitment = d => hash('0x' + iw(textHash('420/TREASURY/DISBURSEMENT/V1')) + iw(d.budgetId) + aw(d.recipient) + uw(d.amount,128) + uw(d.notBefore,64) + uw(d.expiresAt,64) + iw(d.civicActionHash) + iw(d.purposeHash));

/** Provider follows Wallet's request(method, params) contract. Pins must come from
 * trusted chain-specific deployment configuration, not a route request or Indexer.
 * No candidate addresses are filled in by this module. */
export function createTreasuryClient420({provider, chainId, registryCodeHash, releaseExecutor = null}) {
  const expected = chain(chainId);
  const registryHash = id(registryCodeHash);
  const release = releaseExecutor == null ? null : Object.freeze({address:addr(releaseExecutor.address), codeHash:id(releaseExecutor.codeHash)});
  const rpc = (method, params=[]) => provider.request(method, params);
  const call = (to, signature, args, block) => rpc('eth_call', [{to,data:data(signature,...args)},block]);
  const checkChain = async () => require(chain(await rpc('eth_chainId')) === expected, 'wrong Treasury chain');
  async function code(address_, block) {
    const c = hex(await rpc('eth_getCode',[address_,block])); require(c !== '0x', 'Treasury contract has no deployed code'); return hash(c);
  }
  async function getter(target, signature, block) { return address(words(await call(target,signature,[],block),1)[0]); }
  async function identity(target, name, version, block) {
    await code(target, block);
    require(stringResult(await call(target,'systemName()',[],block)) === name, 'Treasury contract identity mismatch: '+name);
    require(word(words(await call(target,'protocolVersion()',[],block),1)[0]) === version, 'Treasury protocol version mismatch: '+name);
  }
  async function context() {
    await checkChain();
    const b = await rpc('eth_getBlockByNumber',['latest',false]);
    require(b && typeof b.number === 'string' && /^0x[0-9a-fA-F]+$/.test(b.number), 'missing Treasury block');
    id(b.hash); const block=b.number;
    require(await code(REGISTRY,block) === registryHash, 'ProtocolRegistry runtime mismatch');
    await identity(REGISTRY,'ProtocolRegistry',4n,block);
    const sid=iw(textHash(TREASURY_SERVICE_ID_420)), cid=iw(textHash(TREASURY_ROUTER_COMPONENT_420));
    const service=words(await call(REGISTRY,'getService(bytes32)',[sid],block),6);
    const router=address(service[0]), revision=word(service[3]);
    require(revision > 0n && revision < (1n<<32n) && word(service[5])===1n, 'inactive Treasury service');
    require(await code(router,block) === '0x'+service[1], 'Treasury service runtime mismatch');
    const active=words(await call(REGISTRY,'resolveActive(bytes32)',[sid],block),2);
    require(address(active[0])===router && word(active[1])===revision,'Treasury service resolution mismatch');
    const component=words(await call(REGISTRY,'component(bytes32)',[cid],block),7);
    require(component[0]===cid && address(component[1])===router && component[2]===service[1] &&
      word(component[3])===1n && word(component[4])===0n && word(component[5])===0n && word(component[6])===2n,'Treasury component binding mismatch');
    require(address(words(await call(REGISTRY,'resolve(bytes32)',[cid],block),1)[0])===router,'Treasury component resolution mismatch');
    const profile=words(await call(REGISTRY,'getRegistrationProfile(bytes32,uint32)',[sid,uw(revision,32)],block),4);
    require(word(profile[0])===3n && profile.slice(1).every(x=>word(x)!==0n),'Treasury registration profile missing');
    await identity(router,'TreasuryRouter420',1n,block);
    const budgets=await getter(router,'budgets()',block), disbursements=await getter(router,'disbursements()',block);
    const policy=await getter(budgets,'policy()',block), authorization=await getter(disbursements,'authorization()',block);
    require(new Set([REGISTRY,router,budgets,disbursements,policy,authorization]).size===6,'duplicate Treasury bindings');
    await identity(budgets,'TreasuryBudgetRegistry420',1n,block);
    await identity(disbursements,'TreasuryDisbursementRegistry420',1n,block);
    await identity(policy,'TreasuryPolicyRegistry420',1n,block);
    await identity(authorization,'TreasuryAuthorization420',1n,block);
    require(await getter(disbursements,'budgets()',block)===budgets &&
      await getter(disbursements,'policy()',block)===policy &&
      await getter(budgets,'controller()',block)===disbursements,'Treasury constructor graph mismatch');
    for (const target of [budgets,disbursements,policy]) require(await getter(target,'governanceTimelock()',block)===TIMELOCK,'Treasury governance binding mismatch');
    const capabilityRegistry=await getter(authorization,'capabilityRegistry()',block);
    await code(capabilityRegistry,block);
    const current=await rpc('eth_getBlockByNumber',[block,false]);
    require(current?.hash?.toLowerCase()===b.hash.toLowerCase(),'Treasury discovery block reorganized');
    await checkChain();
    return Object.freeze({chainId:expected,block,blockHash:b.hash.toLowerCase(),registry:REGISTRY,router,revision,budgets,disbursements,policy,authorization,capabilityRegistry});
  }
  async function readDisbursement(c, disbursementId) {
    const i=id(disbursementId), w=words(await call(c.disbursements,'disbursement(bytes32)',[iw(i)],c.block),11);
    require(word(w[10])===1n && word(w[9])>=1n && word(w[9])<=3n,'missing Treasury disbursement');
    const d={id:i,budgetId:id('0x'+w[0]),recipient:address(w[1]),asset:address(w[2],true),
      amount:integer(word(w[3]),128),notBefore:integer(word(w[4]),64),expiresAt:integer(word(w[5]),64),
      civicActionHash:id('0x'+w[6]),purposeHash:id('0x'+w[7]),vaultReleaseHash:'0x'+w[8],state:Number(word(w[9]))};
    require(d.amount>0n && d.expiresAt>d.notBefore && commitment(d)===i,'Treasury disbursement identity mismatch');
    const b=words(await call(c.budgets,'budget(bytes32)',[iw(d.budgetId)],c.block),12);
    require(word(b[11])===1n && address(b[2],true)===d.asset && '0x'+b[8]===d.civicActionHash &&
      d.notBefore>=word(b[6]) && d.expiresAt<=word(b[7]) && word(b[5])<=word(b[4]) && word(b[4])<=word(b[3]),'Treasury budget binding mismatch');
    return Object.freeze({...d,vaultId:id('0x'+b[0]),evidenceModel:TREASURY_EVIDENCE_420,independentTransferVerified:false});
  }
  async function disbursement(i) {const c=await context();const d=await readDisbursement(c,i);await checkChain();return d;}
  async function prepareGovernedAction(input) {
    const c=await context(); let target,calldata;
    switch(input.kind) {
      case 'setAssetPolicy': {
        require(typeof input.allowed==='boolean','Treasury policy boolean required');
        const single=integer(input.maxSingle,128),epoch=integer(input.maxEpoch,128),duration=integer(input.epochSeconds,64);
        require(single>0n&&epoch>=single&&duration>0n,'invalid Treasury policy');
        target=c.policy;calldata=data('setAssetPolicy(address,bool,uint128,uint128,uint64)',aw(input.asset),uw(input.allowed?1n:0n),uw(single),uw(epoch),uw(duration));break;
      }
      case 'createBudget': {
        require(integer(input.ceiling,128)>0n&&integer(input.validUntil,64)>integer(input.validFrom,64),'invalid Treasury budget');
        target=c.budgets;calldata=data('createBudget(bytes32,bytes32,bytes32,address,uint128,uint64,uint64,bytes32,bytes32)',iw(input.budgetId),iw(input.vaultId),iw(input.category),aw(input.asset),uw(input.ceiling,128),uw(input.validFrom,64),uw(input.validUntil,64),iw(input.civicActionHash),hex(input.metadataHash,32).slice(2));break;
      }
      case 'schedule': {
        const d={...input,recipient:addr(input.recipient),amount:integer(input.amount,128),notBefore:integer(input.notBefore,64),expiresAt:integer(input.expiresAt,64)};
        require(d.amount>0n&&d.expiresAt>d.notBefore,'invalid Treasury schedule');
        const i=commitment(d);if(input.disbursementId!=null)require(id(input.disbursementId)===i,'Treasury supplied id mismatch');
        target=c.disbursements;calldata=data('schedule(bytes32,bytes32,address,uint128,uint64,uint64,bytes32,bytes32)',iw(i),iw(d.budgetId),aw(d.recipient),uw(d.amount),uw(d.notBefore),uw(d.expiresAt),iw(d.civicActionHash),iw(d.purposeHash));break;
      }
      case 'cancel': {
        const d=await readDisbursement(c,input.disbursementId);require(d.state===1,'Treasury disbursement not scheduled');
        target=c.disbursements;calldata=data('cancel(bytes32)',iw(d.id));break;
      }
      default: throw new Error('unsupported governed Treasury action');
    }
    await checkChain();
    return Object.freeze({chainId:expected,authority:'GovernanceTimelock/Civic',action:Object.freeze({target,value:0n,data:calldata}),discovery:c});
  }
  async function prepareRelease(disbursementId, smartAccount) {
    require(release!==null,'Treasury release executor not configured by qualified deployment');
    const operator=addr(smartAccount),c=await context(),d=await readDisbursement(c,disbursementId);
    require(d.state===1 && word(words(await call(c.router,'isExecutable(bytes32)',[iw(d.id)],c.block),1)[0])===1n,'Treasury disbursement not executable');
    require(await code(release.address,c.block)===release.codeHash &&
      await getter(release.address,'registry()',c.block)===REGISTRY &&
      await getter(release.address,'operator()',c.block)===operator,'Treasury release executor binding mismatch');
    require(word(words(await call(c.authorization,'isDisbursementAuthorized(address,bytes32,bytes32,uint256)',[aw(release.address),iw(d.id),iw(textHash(TREASURY_EXECUTION_ACTION_420)),uw(d.amount)],c.block),1)[0])===1n,'Treasury execution capability denied');
    // preview returns (bytes evidence, bytes32 commitment) with 22 static ABI words.
    const raw=hex(await call(release.address,'preview(bytes32)',[iw(d.id)],c.block)).slice(2);
    require(raw.length===25*64 && word(raw.slice(0,64))===64n && word(raw.slice(128,192))===704n,'invalid release preview');
    const claim=id('0x'+raw.slice(64,128)), evidence=raw.slice(192), w=words('0x'+evidence,22);
    require(hash('0x'+iw(textHash('420/TREASURY/VAULT_RELEASE_COMMITMENT/V1'))+evidence)===claim,'release commitment mismatch');
    require(word(w[0])===expected && address(w[1])===REGISTRY && address(w[2])===c.router &&
      word(w[3])===c.revision && address(w[6])===c.disbursements && address(w[7])===c.budgets &&
      '0x'+w[9]===d.id && '0x'+w[10]===d.budgetId && '0x'+w[11]===d.vaultId &&
      address(w[14],true)===d.asset && address(w[15])===d.recipient && word(w[16])===d.amount &&
      '0x'+w[17]===d.civicActionHash && '0x'+w[18]===d.purposeHash &&
      address(w[19])===release.address && address(w[20])===operator,'release preview does not match reviewed Treasury tuple');
    const end=await rpc('eth_getBlockByNumber',[c.block,false]);
    require(end?.hash?.toLowerCase()===c.blockHash,'Treasury preview block reorganized');
    await checkChain();
    return Object.freeze({chainId:expected,operator,disbursement:d,commitment:claim,evidence:'0x'+evidence,target:release.address,
      value:0n,data:data('execute(bytes32,bytes32)',iw(d.id),iw(claim)),authority:'TreasuryReleaseExecutor420',
      evidenceModel:TREASURY_EVIDENCE_420,independentTransferVerified:false});
  }
  return Object.freeze({discover:context,disbursement,prepareGovernedAction,prepareRelease});
}
