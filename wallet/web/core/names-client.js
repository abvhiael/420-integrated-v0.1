import { normalizeAddress, ZERO_ADDRESS, ZERO_BYTES32 } from './abi.js';
import { keccak256Hex } from './keccak.js';
import { normalize420Name } from './names-send.js';

const textBytes = (text) => new TextEncoder().encode(text);
const selector = (signature) => keccak256Hex(textBytes(signature)).slice(2, 10);
const RESOLVE_SELECTOR = selector('resolve(bytes32)');
const SYSTEM_NAME_SELECTOR = selector('systemName()');
const VERSION_SELECTOR = selector('protocolVersion()');
const WORD = /^0x(?:[0-9a-fA-F]{64})+$/;

function checkedChainId(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) throw new Error('420 Names requires a verified chain ID');
  return BigInt(value);
}
function readWords(raw, minimum) {
  if (typeof raw !== 'string' || !WORD.test(raw) || (raw.length - 2) / 64 < minimum) throw new Error('invalid 420 Names contract response');
  return raw.slice(2).match(/.{64}/g);
}
function addressAt(word) {
  if (!/^0{24}$/i.test(word.slice(0, 24))) throw new Error('invalid 420 Names address encoding');
  return normalizeAddress(`0x${word.slice(24)}`);
}
function uintAt(word, bits) {
  const number = BigInt(`0x${word}`);
  if (number >= (1n << BigInt(bits))) throw new Error('invalid 420 Names integer encoding');
  return number;
}

export function hash420Label(name) {
  return keccak256Hex(textBytes(normalize420Name(name).slice(0, -4)));
}

// `namesAddress` and `chainId` must be sourced from a verified chain deployment
// manifest. No production contract address or chain ID is guessed here.
export function createNames420Client({ provider, namesAddress, chainId }) {
  if (!provider || typeof provider.request !== 'function') throw new Error('420 Names RPC unavailable');
  const contract = normalizeAddress(namesAddress);
  if (contract === ZERO_ADDRESS) throw new Error('420 Names contract unavailable');
  const expectedChain = checkedChainId(chainId);
  const request = (method, params = []) => provider.request(method, params);
  async function verifyChain() {
    if (checkedChainId(await request('eth_chainId')) !== expectedChain) throw new Error('420 Names chain changed');
  }
  async function call(data) {
    await verifyChain();
    const result = await request('eth_call', [{ to: contract, data }, 'latest']);
    await verifyChain();
    return result;
  }
  async function verifyContract() {
    await verifyChain();
    const code = await request('eth_getCode', [contract, 'latest']);
    if (typeof code !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(code) || /^0x0+$/i.test(code)) {
      throw new Error('420 Names contract is not deployed');
    }
    // Match the canonical Names420 contract identity and ABI before decoding records.
    const version = readWords(await call(`0x${VERSION_SELECTOR}`), 1);
    if (version.length !== 1 || uintAt(version[0], 32) !== 3n) throw new Error('unrecognized 420 Names contract version');
    const nameWords = readWords(await call(`0x${SYSTEM_NAME_SELECTOR}`), 3);
    if (BigInt(`0x${nameWords[0]}`) !== 32n || BigInt(`0x${nameWords[1]}`) !== 8n ||
        nameWords[2].slice(0, 16).toLowerCase() !== '4e616d6573343230' || !/^0+$/.test(nameWords[2].slice(16))) {
      throw new Error('unrecognized 420 Names contract identity');
    }
  }
  async function chainTime() {
    await verifyChain();
    const block = await request('eth_getBlockByNumber', ['latest', false]);
    await verifyChain();
    if (!block || typeof block.timestamp !== 'string' || !/^0x[0-9a-fA-F]+$/.test(block.timestamp)) throw new Error('trusted chain time unavailable');
    const seconds = BigInt(block.timestamp);
    if (seconds > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('trusted chain time unavailable');
    return Number(seconds);
  }
  async function lookup(name) {
    const normalized = normalize420Name(name);
    const labelHash = hash420Label(normalized);
    if (labelHash === ZERO_BYTES32) throw new Error('420 Name hash not verified');
    await verifyContract();
    const fields = readWords(await call(`0x${RESOLVE_SELECTOR}${labelHash.slice(2)}`), 7);
    if (fields.length !== 7) throw new Error('invalid 420 Names record length');
    const record = {
      labelHash,
      owner: addressAt(fields[0]),
      pendingOwner: addressAt(fields[1]),
      resolvedAddress: addressAt(fields[2]),
      profileId: `0x${fields[3].toLowerCase()}`,
      serviceId: `0x${fields[4].toLowerCase()}`,
      expiresAt: uintAt(fields[5], 64),
      labelLength: Number(uintAt(fields[6], 8)),
    };
    if (record.labelLength !== normalized.slice(0, -4).length) throw new Error('420 Name label length mismatch');
    return Object.freeze({ labelHash, record: Object.freeze(record) });
  }
  return Object.freeze({ lookup, chainTime, verifyChain, verifyContract, namesAddress: contract });
}
