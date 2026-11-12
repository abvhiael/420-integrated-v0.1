// Canonical transaction confirmation shared by Wallet Core and native clients.
// A receipt alone is not sufficient: its block must remain canonical at the
// requested confirmation depth. Never convert an RPC timeout into success.
export function normalizeTransactionHash420(hash) {
  if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('invalid transaction hash');
  return hash.toLowerCase();
}

function blockQuantity(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) throw new Error(`invalid ${label}`);
  return BigInt(value);
}

function normalizeBlockHash(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid receipt block hash');
  return value.toLowerCase();
}

export async function waitForCanonicalTransaction420(provider, hash, options = {}) {
  const txHash = normalizeTransactionHash420(hash);
  const attempts = options.attempts === undefined ? 30 : options.attempts;
  const delayMs = options.delayMs === undefined ? 1000 : options.delayMs;
  const confirmations = options.confirmations === undefined ? 1 : options.confirmations;
  if (!Number.isSafeInteger(attempts) || attempts < 1) throw new Error('invalid transaction confirmation attempts');
  if (!Number.isSafeInteger(delayMs) || delayMs < 0) throw new Error('invalid transaction confirmation delay');
  if (!Number.isSafeInteger(confirmations) || confirmations < 1 || confirmations > 256) throw new Error('invalid transaction confirmation depth');
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let mined = false;
  for (let i = 0; i < attempts; i += 1) {
    if (options.signal?.aborted) throw new Error('transaction confirmation cancelled');
    const receipt = await provider.request('eth_getTransactionReceipt', [txHash]);
    if (receipt) {
      mined = true;
      if (receipt.transactionHash && normalizeTransactionHash420(receipt.transactionHash) !== txHash) {
        throw new Error('transaction receipt hash mismatch');
      }
      if (receipt.status === '0x0') throw new Error('transaction reverted');
      if (receipt.status !== '0x1') throw new Error('transaction receipt has invalid status');
      const height = blockQuantity(receipt.blockNumber, 'receipt block number');
      const blockHash = normalizeBlockHash(receipt.blockHash);
      const canonical = await provider.request('eth_getBlockByNumber', [`0x${height.toString(16)}`, false]);
      if (canonical && normalizeBlockHash(canonical.hash) === blockHash) {
        const head = blockQuantity(await provider.request('eth_blockNumber'), 'latest block number');
        if (head >= height && head - height + 1n >= BigInt(confirmations)) {
          // A reorganization between the block query and this final receipt
          // query invalidates the earlier observation.
          const current = await provider.request('eth_getTransactionReceipt', [txHash]);
          if (current && current.status === '0x1' &&
              current.transactionHash && normalizeTransactionHash420(current.transactionHash) === txHash &&
              blockQuantity(current.blockNumber, 'receipt block number') === height &&
              normalizeBlockHash(current.blockHash) === blockHash) {
            return { txHash, receipt: current, confirmations: head - height + 1n, blockHash, blockNumber: height };
          }
        }
      }
    }
    if (i + 1 < attempts) {
      if (options.signal?.aborted) throw new Error('transaction confirmation cancelled');
      await sleep(delayMs);
    }
  }
  throw new Error(mined ? 'transaction confirmation not canonical or insufficiently deep (possible reorganization)' : 'transaction was not confirmed (pending or dropped)');
}
