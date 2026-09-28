export class PresentationError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'PresentationError420';
  }
}

export const escapeHtml420 = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
}[c]));

const decimalPattern = /^(0|[1-9][0-9]*)$/;
const hexPattern = /^0x[0-9a-fA-F]*$/;

export function decimalString420(value, label) {
  const raw = typeof value === 'number' ? String(value) : String(value ?? '');
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) {
    throw new PresentationError420(`${label} is not an exact non-negative integer`);
  }
  if (!decimalPattern.test(raw)) throw new PresentationError420(`${label} is not a canonical non-negative decimal integer`);
  return raw;
}

export function rawHex420(value, label, exactBytes = null, allowEmpty = false) {
  const raw = String(value ?? '');
  if (raw === '' && allowEmpty) return raw;
  if (!hexPattern.test(raw) || raw.length % 2 !== 0) {
    throw new PresentationError420(`${label} is malformed raw hex`);
  }
  if (exactBytes !== null && (raw.length - 2) / 2 !== exactBytes) {
    throw new PresentationError420(`${label} has invalid length`);
  }
  return raw;
}

export function address420(value, label = 'address', allowEmpty = false) {
  return rawHex420(value, label, 20, allowEmpty);
}

export function hash420(value, label = 'hash', allowEmpty = false) {
  return rawHex420(value, label, 32, allowEmpty);
}

export function feePresentation420(receipt) {
  const gasUsed = decimalString420(receipt?.gasUsed, 'gas used');
  const effectiveGasPriceWei = decimalString420(receipt?.effectiveGasPriceWei, 'effective gas price');
  const actualFeeWei = decimalString420(receipt?.actualFeeWei, 'actual fee');
  if (BigInt(gasUsed) * BigInt(effectiveGasPriceWei) !== BigInt(actualFeeWei)) {
    throw new PresentationError420('actual fee is inconsistent with gas used × effective gas price');
  }
  return {gasUsed, effectiveGasPriceWei, actualFeeWei};
}

export function renderFeeSummary420(receipt) {
  const fee = feePresentation420(receipt);
  const row = (label, value) => `<div class="stat"><span class="label">${escapeHtml420(label)}</span><span class="value mono">${escapeHtml420(value)}</span></div>`;
  return `<div class="grid fee-grid" aria-label="transaction fee details">${row('Gas used',fee.gasUsed)}${row('Effective gas price (wei)',fee.effectiveGasPriceWei)}${row('Actual fee (wei)',fee.actualFeeWei)}</div>`;
}

export function transactionRawPresentation420(tx) {
  const valueWei = decimalString420(tx?.valueWei ?? '0', 'transaction value');
  const input = rawHex420(tx?.input ?? '', 'transaction input', null, true);
  if (tx?.from) address420(tx.from, 'transaction from');
  if (tx?.to) address420(tx.to, 'transaction to');
  if (tx?.hash) hash420(tx.hash, 'transaction hash');
  if (tx?.blockHash) hash420(tx.blockHash, 'transaction block hash');
  return {valueWei, input};
}

export function transactionDetailPresentation420(view) {
  const tx = view?.transaction ?? {};
  const receipt = view?.receipt ?? {};
  const raw = transactionRawPresentation420(tx);
  const fee = feePresentation420(receipt);
  const txChain = decimalString420(tx.chainId, 'transaction chain id');
  const receiptChain = decimalString420(receipt.chainId, 'receipt chain id');
  const txBlock = decimalString420(tx.blockNumber, 'transaction block number');
  const receiptBlock = decimalString420(receipt.blockNumber, 'receipt block number');
  const txIndex = decimalString420(tx.index, 'transaction index');
  const receiptIndex = decimalString420(receipt.transactionIndex, 'receipt transaction index');
  const txHash = hash420(tx.hash, 'transaction hash');
  const receiptTxHash = hash420(receipt.transactionHash, 'receipt transaction hash');
  const txBlockHash = hash420(tx.blockHash, 'transaction block hash');
  const receiptBlockHash = hash420(receipt.blockHash, 'receipt block hash');
  const contractAddress = receipt.contractAddress ? address420(receipt.contractAddress, 'created contract address') : '';
  if (txChain !== receiptChain || txBlock !== receiptBlock || txIndex !== receiptIndex ||
      txHash.toLowerCase() !== receiptTxHash.toLowerCase() ||
      txBlockHash.toLowerCase() !== receiptBlockHash.toLowerCase()) {
    throw new PresentationError420('transaction and receipt provenance are inconsistent');
  }
  return {raw, fee, chainId:txChain, blockNumber:txBlock, transactionIndex:txIndex, txHash, blockHash:txBlockHash, contractAddress};
}

export function validateRawLog420(log) {
  const chainId = decimalString420(log?.chainId, 'log chain id');
  const blockNumber = decimalString420(log?.blockNumber, 'log block number');
  const transactionIndex = decimalString420(log?.transactionIndex, 'log transaction index');
  const logIndex = decimalString420(log?.logIndex, 'log index');
  const address = address420(log?.address, 'log emitting address');
  const blockHash = hash420(log?.blockHash, 'log block hash');
  const transactionHash = hash420(log?.transactionHash, 'log transaction hash');
  if (!Array.isArray(log?.topics)) throw new PresentationError420('log topics are missing');
  const topics = log.topics.map((topic, index) => rawHex420(topic, `log topic ${index}`, 32));
  const data = rawHex420(log?.data ?? '', 'log data', null, true);
  return {chainId, blockNumber, transactionIndex, logIndex, address, blockHash, transactionHash, topics, data};
}

export function inspectableRaw420(value, label, id) {
  const raw = String(value ?? '');
  const display = raw === '' ? '<span class="muted">(empty raw value)</span>' : escapeHtml420(raw);
  return `<div class="inspectable-raw"><div id="${escapeHtml420(id)}" class="codebox mono raw-full" data-raw-value="${escapeHtml420(raw)}">${display}</div><button type="button" class="copy-raw" data-copy-value="${escapeHtml420(raw)}" aria-label="Copy full ${escapeHtml420(label)}">Copy full value</button></div>`;
}

export function renderRawLog420(log, prefix = 'log') {
  const v = validateRawLog420(log);
  const topicRows = v.topics.length
    ? v.topics.map((topic, index) => `<div class="raw-topic"><span class="label">Topic ${index}</span>${inspectableRaw420(topic, `topic ${index}`, `${prefix}-topic-${index}`)}</div>`).join('')
    : '<p class="muted">No topics.</p>';
  return `<article class="raw-event" data-log-index="${escapeHtml420(v.logIndex)}">
    <h4>Log ${escapeHtml420(v.logIndex)}</h4>
    <dl class="details">
      <div><dt>Chain ID</dt><dd>${escapeHtml420(v.chainId)}</dd></div>
      <div><dt>Block</dt><dd>${escapeHtml420(v.blockNumber)}</dd></div>
      <div><dt>Block hash</dt><dd>${inspectableRaw420(v.blockHash,'block hash',`${prefix}-block-hash`)}</dd></div>
      <div><dt>Transaction</dt><dd><a class="link mono" href="#/transactions/${escapeHtml420(v.transactionHash)}">${escapeHtml420(v.transactionHash)}</a></dd></div>
      <div><dt>Transaction index</dt><dd>${escapeHtml420(v.transactionIndex)}</dd></div>
      <div><dt>Log index</dt><dd>${escapeHtml420(v.logIndex)}</dd></div>
      <div><dt>Emitting address</dt><dd><a class="link mono" href="#/addresses/${escapeHtml420(v.address)}">${escapeHtml420(v.address)}</a></dd></div>
    </dl>
    <div class="raw-topics"><h5>Topics</h5>${topicRows}</div>
    <div class="raw-data"><h5>Raw data</h5>${inspectableRaw420(v.data,'raw event data',`${prefix}-data`)}</div>
    <p class="muted raw-authority-note">Raw indexed values are primary; decoded labels must never replace conflicting raw data.</p>
  </article>`;
}

export function renderRawLogs420(logs, prefix = 'logs') {
  if (!Array.isArray(logs)) throw new PresentationError420('logs payload is malformed');
  if (!logs.length) return '<p class="muted">No logs indexed for this resource.</p>';
  return logs.map((log, index) => renderRawLog420(log, `${prefix}-${index}`)).join('');
}
