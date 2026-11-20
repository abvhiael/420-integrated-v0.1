// Shared, browser-safe 420Token V1 ABI and draft SDK. No RPC writes or signing.
import { keccak256Hex } from './keccak.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true});
const MAX_BYTES = 4096; // Shared Wallet execution calldata limit.
export const ZERO_WORD = '0x' + '0'.repeat(64);
export const TOKEN_COMPONENT_ID_420 = '420/component/token/v1';
export const TOKEN_GENESIS_V3_420 = '0x94321abcd7016ec0494a2c616fdf55bf4e8815dcc0f92d03933b335630e25d6d';
const signatures = Object.freeze({
  ERC20: 'createERC20(bytes32,string,string,uint256,uint256,bytes32)',
  ERC721: 'createERC721(string,string,string,bytes32)',
  ERC1155: 'createERC1155(string,bytes32)',
});
const definitions = [
  ['ERC20_FIXED', 'erc20-fixed', 'ERC20', 'ERC20_FIXED_SUPPLY_V1'],
  ['ERC20_MINTABLE', 'erc20-mintable', 'ERC20', 'ERC20_OWNER_MINTABLE_V1'],
  ['ERC20_CAPPED', 'erc20-capped', 'ERC20', 'ERC20_OWNER_MINTABLE_CAPPED_V1'],
  ['ERC20_BURNABLE', 'erc20-burnable', 'ERC20', 'ERC20_FIXED_BURNABLE_V1'],
  ['ERC20_PERMIT', 'erc20-permit', 'ERC20', 'ERC20_FIXED_EIP2612_PERMIT_V1'],
  ['ERC20_VOTES', 'erc20-votes', 'ERC20', 'ERC20_FIXED_PERMIT_VOTES_CHECKPOINTS_V1'],
  ['ERC721_COLLECTION', 'erc721-collection', 'ERC721', 'ERC721_OWNER_MINTABLE_COLLECTION_V1'],
  ['ERC1155_MULTI', 'erc1155-multi', 'ERC1155', 'ERC1155_OWNER_MINTABLE_MULTI_V1'],
];

export function tokenHashText420(value) { return keccak256Hex(encoder.encode(value)); }
export function tokenHashHex420(value) {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) throw Error('invalid hex bytes');
  return keccak256Hex(Uint8Array.from(value.slice(2).match(/../g) || [], x => parseInt(x, 16)));
}
export function tokenSelector420(signature) { return tokenHashText420(signature).slice(0, 10); }
export function tokenWord420(value) {
  if (typeof value !== 'bigint' && !(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value))
      && !(typeof value === 'number' && Number.isSafeInteger(value))) throw Error('uint256 must be an exact integer');
  const n = BigInt(value);
  if (n < 0n || n >= (1n << 256n)) throw Error('uint256 out of range');
  return n.toString(16).padStart(64, '0');
}
export function tokenHashWord420(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw Error('invalid bytes32');
  return value.slice(2).toLowerCase();
}
export function tokenAddressWord420(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw Error('invalid address');
  return value.slice(2).toLowerCase().padStart(64, '0');
}
function utf8(value) {
  if (typeof value !== 'string') throw Error('token metadata must be a string');
  const bytes = encoder.encode(value);
  if (decoder.decode(bytes) !== value) throw Error('invalid Unicode metadata');
  if (bytes.length > MAX_BYTES) throw Error('token metadata exceeds Wallet limit');
  return bytes;
}
function toHex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
export function tokenEncodeAbi420(types, values) {
  if (types.length !== values.length) throw Error('ABI argument count mismatch');
  const head = [], tail = [];
  let offset = types.length * 32;
  for (let i = 0; i < types.length; i++) {
    const type = types[i], value = values[i];
    if (type === 'string') {
      const b = utf8(value);
      const payload = tokenWord420(b.length) + toHex(b).padEnd(Math.ceil(b.length / 32) * 64, '0');
      head.push(tokenWord420(offset));
      tail.push(payload);
      offset += payload.length / 2;
    } else if (type === 'bytes32') head.push(tokenHashWord420(value));
    else if (type === 'address') head.push(tokenAddressWord420(value));
    else if (type === 'uint256') head.push(tokenWord420(value));
    else throw Error('unsupported SDK ABI type');
  }
  return '0x' + head.join('') + tail.join('');
}
export function tokenReadCall420(signature, types = [], values = []) {
  return tokenSelector420(signature) + tokenEncodeAbi420(types, values).slice(2);
}

export const TOKEN_TEMPLATES_420 = Object.freeze(definitions.map(([key, slug, standard, profile]) => Object.freeze({
  key, slug, standard, version: 1, id: tokenHashText420('420/token/template/' + slug + '/v1'),
  profileHash: tokenHashText420(profile), standardWord: '0x' + toHex(encoder.encode(standard)).padEnd(64, '0'),
  mintable: ['ERC20_MINTABLE', 'ERC20_CAPPED', 'ERC721_COLLECTION', 'ERC1155_MULTI'].includes(key),
  capped: key === 'ERC20_CAPPED', burnable: key === 'ERC20_BURNABLE',
  permit: ['ERC20_PERMIT', 'ERC20_VOTES'].includes(key), votes: key === 'ERC20_VOTES',
  ...(standard === 'ERC20' ? {decimals: 18} : {}),
})));
const byKey = new Map(TOKEN_TEMPLATES_420.map(t => [t.key, t]));
function exactKeys(input, allowed) {
  if (Object.keys(input).some(k => !allowed.includes(k))) throw Error('unexpected token draft field');
}
export function normalizeTokenDraft420(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('token draft required');
  const p = byKey.get(input.template);
  if (!p) throw Error('unknown frozen Token template');
  const salt = '0x' + tokenHashWord420(input.userSalt);
  const d = {template: p.key, userSalt: salt};
  if (p.standard === 'ERC20') {
    exactKeys(input, ['template', 'userSalt', 'name', 'symbol', 'initialSupply', 'cap']);
    utf8(input.name); utf8(input.symbol);
    const supply = BigInt('0x' + tokenWord420(input.initialSupply));
    const cap = BigInt('0x' + tokenWord420(input.cap ?? 0n));
    if (p.capped ? cap === 0n || supply > cap : cap !== 0n) throw Error('invalid cap for frozen Token template');
    // ERC20Template420._mint enforces the uint208 vote checkpoint supply bound.
    if (p.votes && supply >= (1n << 208n)) throw Error('voting supply exceeds uint208 checkpoint limit');
    Object.assign(d, {name: input.name, symbol: input.symbol, initialSupply: supply.toString(), cap: cap.toString()});
  } else if (p.standard === 'ERC721') {
    exactKeys(input, ['template', 'userSalt', 'name', 'symbol', 'baseURI']);
    utf8(input.name); utf8(input.symbol); utf8(input.baseURI);
    Object.assign(d, {name: input.name, symbol: input.symbol, baseURI: input.baseURI});
  } else {
    exactKeys(input, ['template', 'userSalt', 'uri']);
    utf8(input.uri);
    d.uri = input.uri;
  }
  return Object.freeze(d);
}

export function encodeTokenCreation420(input) {
  const draft = normalizeTokenDraft420(input);
  const template = byKey.get(draft.template);
  let types, values, config;
  if (template.standard === 'ERC20') {
    types = ['bytes32', 'string', 'string', 'uint256', 'uint256', 'bytes32'];
    values = [template.id, draft.name, draft.symbol, draft.initialSupply, draft.cap, draft.userSalt];
    config = tokenEncodeAbi420(types.slice(1, -1), values.slice(1, -1));
  } else if (template.standard === 'ERC721') {
    types = ['string', 'string', 'string', 'bytes32'];
    values = [draft.name, draft.symbol, draft.baseURI, draft.userSalt];
    config = tokenEncodeAbi420(types.slice(0, -1), values.slice(0, -1));
  } else {
    types = ['string', 'bytes32'];
    values = [draft.uri, draft.userSalt];
    config = tokenEncodeAbi420(['string'], [draft.uri]);
  }
  const data = tokenReadCall420(signatures[template.standard], types, values);
  if ((data.length - 2) / 2 > MAX_BYTES) throw Error('Token calldata exceeds Wallet limit');
  return Object.freeze({draft, template, data, configHash: tokenHashHex420(config), calldataHash: tokenHashHex420(data)});
}
