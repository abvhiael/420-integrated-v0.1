import { normalizeAddress, normalizeBytes32, ZERO_ADDRESS } from './abi.js';
import { keccak256Hex } from './keccak.js';

const textBytes = (text) => new TextEncoder().encode(text);
const selector = (signature) => keccak256Hex(textBytes(signature)).slice(2, 10);
const word = (value) => value.replace(/^0x/, '').padStart(64, '0');
const uintWord = (value) => {
  const n = BigInt(value);
  if (n < 0n || n >= (1n << 256n)) throw new Error('uint256 out of range');
  return n.toString(16).padStart(64, '0');
};
const bytes32Word = (value) => normalizeBytes32(value).slice(2);
const addressWord = (value) => word(normalizeAddress(value));
const encodeCall = (sel, ...words) => `0x${sel}${words.join('')}`;

const SELECTORS = Object.freeze({
  systemName: selector('systemName()'),
  protocolVersion: selector('protocolVersion()'),
  governorConstitution: selector('constitution()'),
  governorProposalRegistry: selector('proposalRegistry()'),
  governorElectorateRegistry: selector('electorateRegistry()'),
  governorVoting: selector('voting()'),
  votingProposalRegistry: selector('proposalRegistry()'),
  votingElectorateRegistry: selector('electorateRegistry()'),
  proposals: selector('proposals(bytes32)'),
  frozenRule: selector('frozenRule(bytes32)'),
  proposalSnapshot: selector('proposalSnapshot(bytes32)'),
  tally: selector('tally(bytes32,uint8)'),
  ballot: selector('ballot(bytes32,uint8,address)'),
  votingWeight: selector('votingWeight(bytes32,uint8,address,bytes)'),
  castVote: selector('castVote(bytes32,uint8,uint8,bytes)'),
  hashActions: selector('hashActions((address,uint256,bytes)[])'),
});

export const GOVERNANCE420_VERSION = 1n;
export const GOVERNANCE420_STATES = Object.freeze(['NONE','ACTIVE','PASSED','FAILED','QUEUED','EXECUTED','CANCELLED']);
export const GOVERNANCE420_CLASSES = Object.freeze(['G1','G2','G3','G4']);
export const GOVERNANCE420_HOUSES = Object.freeze(['COMMUNITY','VALIDATOR']);
export const GOVERNANCE420_SUPPORT = Object.freeze(['AGAINST','FOR','ABSTAIN']);
export const GOVERNANCE420_SERVICE_ID = '420/service/governance/v1';

const MODULE_NAMES = Object.freeze({
  constitution: 'CivicConstitution420',
  proposalRegistry: 'CivicProposalRegistry420',
  electorateRegistry: 'CivicElectorateRegistry420',
  voting: 'CivicVoting420',
  governor: 'CivicGovernor420',
});

function checkedHex(value, label, bytes = null) {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) throw new Error(`invalid ${label}`);
  if (bytes !== null && value.length !== 2 + bytes * 2) throw new Error(`invalid ${label}`);
  return value.toLowerCase();
}
function checkedChainId(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) throw new Error('Governance requires a verified chain ID');
  return BigInt(value);
}
function resultWords(result, count, label) {
  const hex = checkedHex(result, label).slice(2);
  if (hex.length !== count * 64) throw new Error(`invalid Governance ${label} response`);
  return Array.from({ length: count }, (_, i) => hex.slice(i * 64, (i + 1) * 64));
}
const decodeAddressWord = (value) => normalizeAddress(`0x${value.slice(-40)}`);
const decodeBytes32Word = (value) => normalizeBytes32(`0x${value}`);
const decodeUintWord = (value, bits = 256) => {
  const n = BigInt(`0x${value}`);
  if (n >= (1n << BigInt(bits))) throw new Error('invalid Governance integer response');
  return n;
};
const decodeBoolWord = (value) => {
  const n = decodeUintWord(value, 8);
  if (n !== 0n && n !== 1n) throw new Error('invalid Governance boolean response');
  return n === 1n;
};
function decodeStringResult(result, label) {
  const hex = checkedHex(result, label).slice(2);
  if (hex.length < 128) throw new Error(`invalid Governance ${label} response`);
  const offset = Number(BigInt(`0x${hex.slice(0,64)}`)) * 2;
  const length = Number(BigInt(`0x${hex.slice(offset,offset+64)}`));
  if (!Number.isSafeInteger(length) || length < 0 || offset + 64 + length * 2 > hex.length) throw new Error(`invalid Governance ${label} response`);
  const bytes = hex.slice(offset + 64, offset + 64 + length * 2).match(/.{2}/g) || [];
  return new TextDecoder().decode(Uint8Array.from(bytes.map((x) => parseInt(x, 16))));
}
async function call(provider, to, data, from) {
  return provider.request('eth_call', [{ to, data, ...(from ? { from } : {}) }, 'latest']);
}
async function verifyCode(provider, address, label) {
  const code = await provider.request('eth_getCode', [address, 'latest']);
  if (typeof code !== 'string' || !/^0x[0-9a-fA-F]*$/.test(code) || code === '0x') throw new Error(`${label} has no deployed code`);
}
function encodeDynamicBytes(value) {
  const hex = checkedHex(value, 'proof data').slice(2);
  const length = hex.length / 2;
  return `${uintWord(length)}${hex.padEnd(Math.ceil(length / 32) * 64, '0')}`;
}
function encodeCastVote(proposalId, house, support, proofData) {
  const tail = encodeDynamicBytes(proofData);
  return `0x${SELECTORS.castVote}${bytes32Word(proposalId)}${uintWord(house)}${uintWord(support)}${uintWord(128)}${tail}`;
}
function encodeVotingWeight(proposalId, house, voter, proofData) {
  const tail = encodeDynamicBytes(proofData);
  return `0x${SELECTORS.votingWeight}${bytes32Word(proposalId)}${uintWord(house)}${addressWord(voter)}${uintWord(128)}${tail}`;
}
function encodeActionTuple(action) {
  const target = normalizeAddress(action.target);
  const value = BigInt(action.value ?? 0);
  const data = checkedHex(action.data ?? '0x', 'action calldata');
  const body = data.slice(2);
  const len = body.length / 2;
  return `${addressWord(target)}${uintWord(value)}${uintWord(96)}${uintWord(len)}${body.padEnd(Math.ceil(len / 32) * 64, '0')}`;
}
function encodeActionArray(actions) {
  if (!Array.isArray(actions) || actions.length === 0) throw new Error('action batch required');
  const tuples = actions.map(encodeActionTuple);
  const offsets = [];
  let cursor = actions.length * 32;
  for (const tuple of tuples) { offsets.push(uintWord(cursor)); cursor += tuple.length / 2; }
  return `${uintWord(actions.length)}${offsets.join('')}${tuples.join('')}`;
}
function encodeHashActions(actions) {
  const arr = encodeActionArray(actions);
  return `0x${SELECTORS.hashActions}${uintWord(32)}${arr}`;
}
function normalizeDiscovery(discovery) {
  if (!discovery || discovery.source !== 'protocol-registry' || discovery.serviceId !== GOVERNANCE420_SERVICE_ID) {
    throw new Error('Governance requires canonical ProtocolRegistry discovery');
  }
  const modules = {};
  for (const key of Object.keys(MODULE_NAMES)) modules[key] = normalizeAddress(discovery.modules?.[key]);
  if (new Set(Object.values(modules)).size !== Object.keys(modules).length) throw new Error('Governance discovery contains duplicate module addresses');
  return Object.freeze({ source: discovery.source, serviceId: discovery.serviceId, revision: discovery.revision ?? null, modules: Object.freeze(modules) });
}
function decodeProposal(words, proposalId) {
  const classId = Number(decodeUintWord(words[1], 8));
  const stateId = Number(decodeUintWord(words[7], 8));
  if (!GOVERNANCE420_CLASSES[classId] || !GOVERNANCE420_STATES[stateId]) throw new Error('invalid Governance proposal enum');
  return {
    proposalId, proposer: decodeAddressWord(words[0]), classId, className: GOVERNANCE420_CLASSES[classId],
    metadataHash: decodeBytes32Word(words[2]), actionsHash: decodeBytes32Word(words[3]),
    snapshotBlock: decodeUintWord(words[4],64), voteStart: decodeUintWord(words[5],64), voteEnd: decodeUintWord(words[6],64),
    stateId, state: GOVERNANCE420_STATES[stateId], exists: decodeBoolWord(words[8]),
  };
}
function decodeRule(words) {
  return {
    timelockDelay: decodeUintWord(words[0],64), communityQuorumBps: decodeUintWord(words[1],16),
    communityApprovalBps: decodeUintWord(words[2],16), validatorQuorumBps: decodeUintWord(words[3],16),
    validatorApprovalBps: decodeUintWord(words[4],16), dualHouseRequired: decodeBoolWord(words[5]),
    constitutionRevision: decodeUintWord(words[6],32), exists: decodeBoolWord(words[7]),
  };
}
function decodeHouse(words, offset) {
  return {
    source: decodeAddressWord(words[offset]), sourceType: decodeBytes32Word(words[offset+1]),
    electorateRoot: decodeBytes32Word(words[offset+2]), totalWeight: decodeUintWord(words[offset+3]),
    sourceRevision: decodeUintWord(words[offset+4],32), required: decodeBoolWord(words[offset+5]),
  };
}
function decodeSnapshot(words) {
  return {
    snapshotBlock: decodeUintWord(words[0],64), community: decodeHouse(words,1), validator: decodeHouse(words,7),
    dualHouseRequired: decodeBoolWord(words[13]), exists: decodeBoolWord(words[14]),
  };
}
function decodeTally(words) {
  return { againstVotes: decodeUintWord(words[0]), forVotes: decodeUintWord(words[1]), abstainVotes: decodeUintWord(words[2]) };
}
function ceilBps(total, bps) {
  return (total * BigInt(bps) + 9999n) / 10000n;
}
function liveResult(tally, totalWeight, quorumBps, approvalBps) {
  const participation = tally.againstVotes + tally.forVotes + tally.abstainVotes;
  const decisive = tally.forVotes + tally.againstVotes;
  const quorumRequired = ceilBps(totalWeight, quorumBps);
  const approvalRequired = decisive === 0n ? 0n : ceilBps(decisive, approvalBps);
  return { ...tally, totalWeight, participation, quorumRequired, approvalRequired, quorumMet: participation >= quorumRequired, approvalMet: decisive !== 0n && tally.forVotes >= approvalRequired, authoritative: false };
}

export function createGovernanceIndexer420({ baseUrl, fetchImpl = globalThis.fetch }) {
  if (typeof baseUrl !== 'string' || !baseUrl) throw new Error('Governance Indexer URL required');
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('Governance Indexer URL must use HTTPS outside localhost');
  if (typeof fetchImpl !== 'function') throw new Error('Governance Indexer fetch implementation required');
  return Object.freeze({
    async listProposalIds(chainId, limit = 50) {
      const request = new URL('/v1/protocols/events', url);
      request.searchParams.set('chainId', BigInt(chainId).toString());
      request.searchParams.set('protocol', '420Governance');
      request.searchParams.set('limit', String(Math.min(Math.max(Number(limit) || 50,1),100)));
      request.searchParams.set('direction', 'desc');
      const response = await fetchImpl(request);
      if (!response.ok) throw new Error(`Governance Indexer HTTP ${response.status}`);
      const payload = await response.json();
      const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
      const ids = [];
      for (const item of items) {
        if (item?.eventName !== 'CivicProposalRegistered') continue;
        const id = item?.fields?.proposalId;
        if (typeof id === 'string' && /^0x[0-9a-fA-F]{64}$/.test(id)) ids.push(id.toLowerCase());
      }
      return [...new Set(ids)];
    }
  });
}

export function classifyGovernance420Error(error) {
  const message = String(error?.message || error || 'Governance action failed');
  const lower = message.toLowerCase();
  if (lower.includes('user rejected') || lower.includes('denied transaction')) return { code:'USER_REJECTED', message:'Wallet approval was rejected. No Governance vote was submitted.', retryable:true };
  if (lower.includes('wrong network') || lower.includes('chain changed')) return { code:'NETWORK_CHANGED', message:'Wallet network changed. Reconnect and reload canonical Governance state.', retryable:true };
  if (lower.includes('account changed') || lower.includes('no longer authorized')) return { code:'ACCOUNT_CHANGED', message:'Wallet account changed. Reconnect and reload proposal eligibility.', retryable:true };
  if (lower.includes('already voted')) return { code:'ALREADY_VOTED', message:'This account already cast a ballot in the selected house.', retryable:false };
  if (lower.includes('no voting weight') || lower.includes('not eligible')) return { code:'INELIGIBLE', message:'The connected account has no voting weight in this frozen electorate.', retryable:false };
  if (lower.includes('no deployed code') || lower.includes('contract identity') || lower.includes('protocol version')) return { code:'DISCOVERY_INVALID', message:'Canonical Governance discovery failed code/identity/version validation.', retryable:true };
  return { code:'GOVERNANCE_ERROR', message, retryable:true };
}

export function createGovernance420Client({ provider, chainId, account, discovery, indexer = null }) {
  if (!provider || typeof provider.request !== 'function') throw new Error('Governance provider required');
  const expectedChain = checkedChainId(chainId);
  const voter = normalizeAddress(account);
  const canonical = normalizeDiscovery(discovery);
  const modules = canonical.modules;

  async function verifyIdentity(address, expectedName) {
    await verifyCode(provider,address,expectedName);
    const name = decodeStringResult(await call(provider,address,`0x${SELECTORS.systemName}`,voter),'system name');
    if (name !== expectedName) throw new Error(`${expectedName} contract identity mismatch`);
    const [versionWord] = resultWords(await call(provider,address,`0x${SELECTORS.protocolVersion}`,voter),1,'protocol version');
    const version = decodeUintWord(versionWord,32);
    if (version !== GOVERNANCE420_VERSION) throw new Error(`${expectedName} unsupported protocol version ${version}`);
  }

  async function verifySession() {
    const chain = checkedChainId(await provider.request('eth_chainId'));
    if (chain !== expectedChain) throw new Error(`Wrong network: expected 0x${expectedChain.toString(16)}, received 0x${chain.toString(16)}`);
    const accounts = await provider.request('eth_accounts');
    if (!Array.isArray(accounts) || !accounts.some((x) => typeof x === 'string' && x.toLowerCase() === voter)) throw new Error('Governance connected account is no longer authorized');
    for (const [key,name] of Object.entries(MODULE_NAMES)) await verifyIdentity(modules[key],name);
    const getter = async (address, sel) => decodeAddressWord(resultWords(await call(provider,address,`0x${sel}`,voter),1,'module binding')[0]);
    if (await getter(modules.governor,SELECTORS.governorConstitution) !== modules.constitution) throw new Error('Governance discovered Constitution binding mismatch');
    if (await getter(modules.governor,SELECTORS.governorProposalRegistry) !== modules.proposalRegistry) throw new Error('Governance discovered Proposal Registry binding mismatch');
    if (await getter(modules.governor,SELECTORS.governorElectorateRegistry) !== modules.electorateRegistry) throw new Error('Governance discovered Electorate Registry binding mismatch');
    if (await getter(modules.governor,SELECTORS.governorVoting) !== modules.voting) throw new Error('Governance discovered Voting binding mismatch');
    if (await getter(modules.voting,SELECTORS.votingProposalRegistry) !== modules.proposalRegistry) throw new Error('Governance Voting proposal binding mismatch');
    if (await getter(modules.voting,SELECTORS.votingElectorateRegistry) !== modules.electorateRegistry) throw new Error('Governance Voting electorate binding mismatch');
    return { chainId: chain, account: voter, discovery: canonical };
  }

  async function proposal(proposalId) {
    const id = normalizeBytes32(proposalId);
    const p = decodeProposal(resultWords(await call(provider,modules.proposalRegistry,encodeCall(SELECTORS.proposals,bytes32Word(id)),voter),9,'proposal'),id);
    if (!p.exists) throw new Error('Governance proposal does not exist');
    const rule = decodeRule(resultWords(await call(provider,modules.governor,encodeCall(SELECTORS.frozenRule,bytes32Word(id)),voter),8,'frozen rule'));
    if (!rule.exists) throw new Error('Governance frozen constitutional rule missing');
    const snapshot = decodeSnapshot(resultWords(await call(provider,modules.electorateRegistry,encodeCall(SELECTORS.proposalSnapshot,bytes32Word(id)),voter),15,'electorate snapshot'));
    const community = decodeTally(resultWords(await call(provider,modules.voting,encodeCall(SELECTORS.tally,bytes32Word(id),uintWord(0)),voter),3,'community tally'));
    const validator = snapshot.dualHouseRequired ? decodeTally(resultWords(await call(provider,modules.voting,encodeCall(SELECTORS.tally,bytes32Word(id),uintWord(1)),voter),3,'validator tally')) : null;
    return {
      ...p, frozenRule: rule, electorate: snapshot,
      tallies: {
        community: liveResult(community,snapshot.community.totalWeight,rule.communityQuorumBps,rule.communityApprovalBps),
        validator: validator ? liveResult(validator,snapshot.validator.totalWeight,rule.validatorQuorumBps,rule.validatorApprovalBps) : null,
      },
      authority: 'chain',
    };
  }

  async function listProposals(limit = 50) {
    if (!indexer || typeof indexer.listProposalIds !== 'function') throw new Error('Governance proposal list requires non-authoritative Indexer discovery');
    const ids = await indexer.listProposalIds(expectedChain,limit);
    const items = [];
    for (const id of ids) {
      try { items.push(await proposal(id)); } catch { /* stale/reorged projection: omit, chain is authoritative */ }
    }
    return items;
  }

  async function ballot(proposalId, house) {
    const id = normalizeBytes32(proposalId), h = Number(house);
    if (h !== 0 && h !== 1) throw new Error('invalid Governance house');
    const words = resultWords(await call(provider,modules.voting,encodeCall(SELECTORS.ballot,bytes32Word(id),uintWord(h),addressWord(voter)),voter),3,'ballot');
    const support = Number(decodeUintWord(words[0],8));
    return { support, supportName:GOVERNANCE420_SUPPORT[support] ?? 'UNKNOWN', weight:decodeUintWord(words[1]), cast:decodeBoolWord(words[2]) };
  }

  async function eligibility(proposalId, house, proofData='0x') {
    const id = normalizeBytes32(proposalId), h = Number(house);
    const detail = await proposal(id);
    if (h !== 0 && h !== 1) throw new Error('invalid Governance house');
    if (h === 1 && !detail.electorate.dualHouseRequired) return { eligible:false, weight:0n, reason:'validator house not required' };
    const prior = await ballot(id,h);
    if (prior.cast) return { eligible:false, weight:prior.weight, reason:'already voted', ballot:prior };
    try {
      const [weightWord] = resultWords(await call(provider,modules.electorateRegistry,encodeVotingWeight(id,h,voter,proofData),voter),1,'voting weight');
      const weight = decodeUintWord(weightWord);
      return { eligible:weight > 0n, weight, reason:weight > 0n ? null : 'no voting weight', ballot:prior };
    } catch (error) {
      return { eligible:false, weight:0n, reason:String(error?.message || error), ballot:prior };
    }
  }

  async function reviewActionBatch(proposalId, actions, abiMetadata = {}) {
    const detail = await proposal(proposalId);
    const computed = decodeBytes32Word(resultWords(await call(provider,modules.governor,encodeHashActions(actions),voter),1,'action hash')[0]);
    if (computed !== detail.actionsHash) throw new Error('action batch does not match proposal commitment');
    const reviewed = actions.map((action,index) => {
      const target = normalizeAddress(action.target), data = checkedHex(action.data ?? '0x','action calldata');
      const selectorHex = data.length >= 10 ? data.slice(0,10) : '0x';
      const key = `${target}:${selectorHex}`;
      const meta = abiMetadata[key] || null;
      return { index,target,value:BigInt(action.value ?? 0),data,selector:selectorHex,decoded:meta ? { signature:meta.signature ?? null, summary:meta.summary ?? null } : null, warning:meta ? null : 'ABI metadata unavailable; action cannot be decoded safely' };
    });
    return { proposalId:detail.proposalId, committedActionsHash:detail.actionsHash, computedActionsHash:computed, matchesCommitment:true, actions:reviewed, fullyDecoded:reviewed.every((x)=>x.decoded) };
  }

  async function sendVote({ proposalId, house, support, proofData='0x' }) {
    const id = normalizeBytes32(proposalId), h = Number(house), s = Number(support);
    if (![0,1].includes(h) || ![0,1,2].includes(s)) throw new Error('invalid Governance vote selection');
    await verifySession();
    const detail = await proposal(id);
    const blockHex = await provider.request('eth_blockNumber');
    const block = BigInt(blockHex);
    if (detail.state !== 'ACTIVE') throw new Error('Governance proposal is not active');
    if (block < detail.voteStart) throw new Error('Governance voting has not started');
    if (block > detail.voteEnd) throw new Error('Governance voting has ended');
    const preflight = await eligibility(id,h,proofData);
    if (!preflight.eligible) throw new Error(preflight.reason === 'already voted' ? 'Governance account already voted' : 'Governance account is not eligible: ' + preflight.reason);
    const data = encodeCastVote(id,h,s,proofData);
    const tx = { from:voter,to:modules.voting,data,value:'0x0' };
    await provider.request('eth_call',[tx,'latest']);
    const gas = await provider.request('eth_estimateGas',[tx]);
    await verifySession();
    const fresh = await eligibility(id,h,proofData);
    if (!fresh.eligible || fresh.weight !== preflight.weight) throw new Error('Governance eligibility changed during vote preflight');
    const nonce = await provider.request('eth_getTransactionCount',[voter,'pending']);
    const txHash = checkedHex(await provider.request('eth_sendTransaction',[tx]),'transaction hash',32);
    return { state:'submitted', txHash, nonce:BigInt(nonce), gas:BigInt(gas), proposalId:id, house:h, support:s, weight:fresh.weight };
  }

  async function confirmVote(submitted, { attempts=120, delayMs=250, replacementLookup=null } = {}) {
    for (let i=0;i<attempts;i+=1) {
      const receipt = await provider.request('eth_getTransactionReceipt',[submitted.txHash]);
      if (receipt) {
        if (receipt.status !== '0x1') return { state:'failed', txHash:submitted.txHash, receipt };
        return { state:'confirmed', txHash:submitted.txHash, receipt };
      }
      if (typeof replacementLookup === 'function') {
        const replacement = await replacementLookup({ from:voter, nonce:submitted.nonce, txHash:submitted.txHash });
        if (replacement?.txHash && replacement.txHash.toLowerCase() !== submitted.txHash) return { state:'replaced', txHash:submitted.txHash, replacementHash:checkedHex(replacement.txHash,'replacement transaction hash',32) };
      }
      if (delayMs > 0) await new Promise((resolve)=>setTimeout(resolve,delayMs));
    }
    return { state:'pending', txHash:submitted.txHash };
  }

  return Object.freeze({ modules, account:voter, discovery:canonical, verifySession, proposal, listProposals, ballot, eligibility, reviewActionBatch, sendVote, confirmVote });
}
