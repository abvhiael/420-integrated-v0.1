const MASK_64 = (1n << 64n) - 1n;
const RATE_BYTES = 136;
const ROTATION = [
  0,1,62,28,27,
  36,44,6,55,20,
  3,10,43,25,39,
  41,45,15,21,8,
  18,2,61,56,14,
];
const ROUND_CONSTANTS = [
  0x0000000000000001n,0x0000000000008082n,0x800000000000808an,0x8000000080008000n,
  0x000000000000808bn,0x0000000080000001n,0x8000000080008081n,0x8000000000008009n,
  0x000000000000008an,0x0000000000000088n,0x0000000080008009n,0x000000008000000an,
  0x000000008000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,
  0x8000000000008002n,0x8000000000000080n,0x000000000000800an,0x800000008000000an,
  0x8000000080008081n,0x8000000000008080n,0x0000000080000001n,0x8000000080008008n,
];

function rotl64(value, shift) {
  const s = BigInt(shift);
  if (s === 0n) return value & MASK_64;
  return ((value << s) | (value >> (64n - s))) & MASK_64;
}

function keccakF(state) {
  for (const rc of ROUND_CONSTANTS) {
    const c = new Array(5);
    const d = new Array(5);
    for (let x = 0; x < 5; x++) {
      c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      d[x] = c[(x + 4) % 5] ^ rotl64(c[(x + 1) % 5], 1);
    }
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) state[x + 5 * y] = (state[x + 5 * y] ^ d[x]) & MASK_64;
    }

    const b = new Array(25).fill(0n);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const source = x + 5 * y;
        const nx = y;
        const ny = (2 * x + 3 * y) % 5;
        b[nx + 5 * ny] = rotl64(state[source], ROTATION[source]);
      }
    }

    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        state[x + 5 * y] =
          (b[x + 5 * y] ^ ((~b[((x + 1) % 5) + 5 * y]) & b[((x + 2) % 5) + 5 * y])) & MASK_64;
      }
    }
    state[0] = (state[0] ^ rc) & MASK_64;
  }
}

function bytesFrom(value) {
  if (value instanceof Uint8Array) return value;
  if (typeof value !== 'string') throw new Error('bytes value must be string or Uint8Array');
  if (value.startsWith('0x')) {
    const hex = value.slice(2);
    if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) throw new Error('invalid hex bytes');
    return Uint8Array.from(hex.match(/../g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
  }
  return new TextEncoder().encode(value);
}

function hexFromBytes(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function keccak256(value) {
  const input = bytesFrom(value);
  const paddedLength = Math.ceil((input.length + 1) / RATE_BYTES) * RATE_BYTES;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] ^= 0x01;
  padded[padded.length - 1] ^= 0x80;

  const state = new Array(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += RATE_BYTES) {
    for (let i = 0; i < RATE_BYTES; i++) {
      const lane = Math.floor(i / 8);
      const shift = BigInt((i % 8) * 8);
      state[lane] ^= BigInt(padded[offset + i]) << shift;
    }
    keccakF(state);
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < out.length; i++) {
    const lane = Math.floor(i / 8);
    const shift = BigInt((i % 8) * 8);
    out[i] = Number((state[lane] >> shift) & 0xffn);
  }
  return '0x' + hexFromBytes(out);
}

export function functionSelector(signature) {
  if (typeof signature !== 'string' || !signature.includes('(')) throw new Error('invalid function signature');
  return keccak256(signature).slice(0, 10);
}

function rawHex(value, label = 'hex') {
  if (typeof value !== 'string' || !value.startsWith('0x') || value.length % 2 !== 0 || !/^0x[0-9a-fA-F]*$/.test(value)) {
    throw new Error(`invalid ${label}`);
  }
  return value.slice(2).toLowerCase();
}

export function uintWord(value, bits = 256) {
  let n;
  try { n = BigInt(value); } catch { throw new Error('invalid uint'); }
  if (n < 0n || n >= (1n << BigInt(bits))) throw new Error(`uint${bits} overflow`);
  return n.toString(16).padStart(64, '0');
}

export function addressWord(value) {
  const hex = rawHex(value, 'address');
  if (hex.length !== 40 || /^0{40}$/.test(hex)) throw new Error('invalid address');
  return hex.padStart(64, '0');
}

export function bytes32Word(value) {
  const hex = rawHex(value, 'bytes32');
  if (hex.length !== 64) throw new Error('invalid bytes32');
  return hex;
}

export function boolWord(value) {
  if (value !== true && value !== false) throw new Error('invalid bool');
  return uintWord(value ? 1 : 0);
}

export function dynamicBytes(value) {
  const hex = rawHex(value, 'bytes');
  const byteLength = hex.length / 2;
  const paddedLength = Math.ceil(byteLength / 32) * 64;
  return uintWord(byteLength) + hex.padEnd(paddedLength, '0');
}

function encodeHopTuple(hop) {
  const routeData = dynamicBytes(hop.routeData ?? '0x');
  return [
    bytes32Word(hop.marketId),
    bytes32Word(hop.routeId),
    addressWord(hop.tokenOut),
    uintWord(hop.minAmountOutRaw),
    uintWord(5 * 32),
    routeData,
  ].join('');
}

export function encodeHopArray(hops) {
  if (!Array.isArray(hops) || hops.length < 1 || hops.length > 4) throw new Error('invalid hop array');
  const encoded = hops.map(encodeHopTuple);
  const headBytes = hops.length * 32;
  let cursor = headBytes;
  const offsets = encoded.map((entry) => {
    const offset = uintWord(cursor);
    cursor += entry.length / 2;
    return offset;
  });
  return uintWord(hops.length) + offsets.join('') + encoded.join('');
}

export function encodeSwapExactInputPath({
  tokenIn, amountInRaw, minFinalAmountOutRaw, recipient, expectedPathHash, hops,
}) {
  const signature = 'swapExactInputPath(address,uint256,uint256,address,bytes32,(bytes32,bytes32,address,uint256,bytes)[])';
  const dynamic = encodeHopArray(hops);
  const head = [
    addressWord(tokenIn),
    uintWord(amountInRaw),
    uintWord(minFinalAmountOutRaw),
    addressWord(recipient),
    bytes32Word(expectedPathHash),
    uintWord(6 * 32),
  ].join('');
  return functionSelector(signature) + head + dynamic;
}

export function encodeSwapExactInputNativePath({
  amountInRaw, minFinalAmountOutRaw, recipient, expectedPathHash, hops,
}) {
  const signature = 'swapExactInputNativePath(uint256,address,bytes32,(bytes32,bytes32,address,uint256,bytes)[])';
  const dynamic = encodeHopArray(hops);
  const head = [
    uintWord(minFinalAmountOutRaw),
    addressWord(recipient),
    bytes32Word(expectedPathHash),
    uintWord(4 * 32),
  ].join('');
  return {
    data: functionSelector(signature) + head + dynamic,
    value: '0x' + BigInt(amountInRaw).toString(16),
  };
}

export function encodeSwapExactInputPathForNative({
  tokenIn, amountInRaw, minFinalAmountOutRaw, recipient, expectedPathHash, hops,
}) {
  const signature = 'swapExactInputPathForNative(address,uint256,uint256,address,bytes32,(bytes32,bytes32,address,uint256,bytes)[])';
  const dynamic = encodeHopArray(hops);
  const head = [
    addressWord(tokenIn),
    uintWord(amountInRaw),
    uintWord(minFinalAmountOutRaw),
    addressWord(recipient),
    bytes32Word(expectedPathHash),
    uintWord(6 * 32),
  ].join('');
  return functionSelector(signature) + head + dynamic;
}

export function encodeLimitOrderTuple(order) {
  return [
    addressWord(order.maker),
    addressWord(order.sellToken),
    addressWord(order.buyToken),
    uintWord(order.sellAmountRaw, 128),
    uintWord(order.minBuyAmountRaw, 128),
    addressWord(order.recipient),
    bytes32Word(order.marketId),
    uintWord(order.nonce),
    uintWord(order.expiry, 64),
    boolWord(order.allowPartial),
  ].join('');
}

export function encodeCancelOrder(order) {
  const signature = 'cancelOrder((address,address,address,uint128,uint128,address,bytes32,uint256,uint64,bool))';
  return functionSelector(signature) + encodeLimitOrderTuple(order);
}

export function encodeIsQualified(exchangeAssetId) {
  return functionSelector('isQualified(bytes32)') + bytes32Word(exchangeAssetId);
}

export function encodeInitiateOutbound({
  adapterId, routeId, assetId, recipientBytes, amountRaw, extra = '0x',
}) {
  const signature = 'initiateOutbound(bytes32,bytes32,bytes32,bytes,uint256,bytes)';
  const recipient = dynamicBytes(recipientBytes);
  const extraData = dynamicBytes(extra);
  const headBytes = 6 * 32;
  const recipientOffset = headBytes;
  const extraOffset = headBytes + recipient.length / 2;
  const head = [
    bytes32Word(adapterId),
    bytes32Word(routeId),
    bytes32Word(assetId),
    uintWord(recipientOffset),
    uintWord(amountRaw),
    uintWord(extraOffset),
  ].join('');
  return functionSelector(signature) + head + recipient + extraData;
}
