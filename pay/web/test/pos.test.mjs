import assert from 'node:assert/strict';
import test from 'node:test';
import { posTotal } from '../pos.js';

test('POS uses exact native units for quick pay and cart, tax and tip', () => {
  assert.deepEqual(posTotal({ quick: '0.000000000000000001', items: '', tax: '', tip: '' }),
    { subtotal: 1n, tax: 0n, tip: 0n });
  assert.deepEqual(posTotal({ quick: '', items: 'Private item | 3 | 1.23\nAnother item | 2 | 0.02',
    tax: '0.42', tip: '1.1' }), { subtotal: 3730000000000000000n,
    tax: 420000000000000000n, tip: 1100000000000000000n });
});

test('POS rejects mixed draft modes, negative prices and values beyond native precision', () => {
  const base = { quick: '', items: 'Item | 2 | 1', tax: '', tip: '' };
  assert.throws(() => posTotal({ ...base, quick: '2' }), /quick amount or cart/);
  assert.throws(() => posTotal({ ...base, items: 'Item | 2 | -1' }), /valid 420/);
  assert.throws(() => posTotal({ ...base, tip: '0.0000000000000000001' }), /valid 420/);
  assert.throws(() => posTotal({ ...base, items: '', quick: '9'.repeat(78) }), /out of range/);
});
