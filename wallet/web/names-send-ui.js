import { normalizeAddress } from './core/abi.js';
import { createQualifiedNamesSend420 } from './core/names-guided-send.js';

const $ = (selector) => document.querySelector(selector);
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const sameRequest = (a, b) => a && b && a.target === b.target && a.value === b.value && a.data === b.data;
function currentRequest() {
  return { target: $('#execute-target').value.trim().toLowerCase(), value: $('#execute-value').value.trim(), data: $('#execute-data').value.trim().toLowerCase() };
}
function installNamesSend() {
  const prepare = $('#prepare-send');
  const recipient = $('#send-recipient');
  if (!prepare || !recipient) return;
  let prepared = null;
  let client = null;
  let busy = false;
  let generation = 0;
  let replay = null;
  const preview = $('#send-preview');
  const clear = (notice) => {
    generation += 1;
    prepared = null;
    client = null;
    if (notice && preview) preview.textContent = notice;
  };
  for (const input of ['#send-recipient', '#send-amount', '#send-asset']) {
    $(input)?.addEventListener(input === '#send-asset' ? 'change' : 'input', () => clear('Recipient or amount changed. Prepare the send again.'));
  }
  for (const input of ['#execute-target', '#execute-value', '#execute-data']) {
    $(input)?.addEventListener('input', () => {
      if (prepared && !sameRequest(currentRequest(), prepared.request)) clear('Transaction details changed. Prepare the named send again.');
    });
  }
  const error = (cause) => { clear(cause?.message || '420 Names resolution failed'); };
  prepare.addEventListener('click', async (event) => {
    const raw = recipient.value.trim();
    if (ADDRESS.test(raw)) { clear(); return; } // Existing address-based send handler remains authoritative.
    event.preventDefault(); event.stopImmediatePropagation();
    if (busy) return;
    clear();
    const snapshot = generation;
    busy = true;
    prepare.disabled = true;
    if (preview) preview.textContent = 'Verifying the canonical 420 Name and connected chain…';
    try {
      const response = await fetch('./runtime-config.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('qualified 420 Names runtime is unavailable');
      const config = await response.json();
      if (!globalThis.ethereum?.request) throw new Error('Connect an EIP-1193 wallet before resolving a 420 Name');
      const provider = { request: (method, params = []) => globalThis.ethereum.request({ method, params }) };
      const expectedChain = BigInt(config.network?.chainId);
      if (BigInt(await provider.request('eth_chainId')) !== expectedChain) throw new Error('Wrong network for 420 Names');
      const nextClient = createQualifiedNamesSend420({
        provider, config,
        confirm: ({ name, recipient: address, recheck }) => globalThis.confirm?.(
          `${recheck ? 'Reconfirm' : 'Confirm'} 420 Name ${name}\nFull on-chain recipient address:\n${address}\nSend only if you recognize and trust this address.`
        ) === true,
      });
      const assetOption = $('#send-asset').selectedIndex;
      const tracked = config.trackedAssets || [];
      const asset = assetOption === 0 ? { kind: 'native', symbol: '420', decimals: 18 } :
        tracked[assetOption - 1] && { kind: 'erc20', ...tracked[assetOption - 1] };
      if (!asset) throw new Error('Selected asset is unavailable');
      const result = await nextClient.prepare({ recipient: raw, amount: $('#send-amount').value, asset });
      if (generation !== snapshot || recipient.value.trim() !== raw) throw new Error('Send details changed during name resolution');
      prepared = result;
      client = nextClient;
      const fields = [$('#execute-target'), $('#execute-value'), $('#execute-data')];
      for (const [index, value] of [result.request.target, result.request.value, result.request.data].entries()) {
        fields[index].value = value;
        fields[index].dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (preview) preview.textContent = `${result.name} → ${result.verified.recipient} · ${result.summary.amount} ${result.summary.symbol}. Verify the full address, then simulate. Name will be rechecked before execution.`;
      $('#simulate-execution')?.focus();
    } catch (cause) { error(cause); }
    finally { busy = false; prepare.disabled = false; }
  }, { capture: true });
  for (const selector of ['#simulate-execution', '#send-execution']) {
    const button = $(selector);
    button?.addEventListener('click', async (event) => {
      if (!prepared) return;
      if (replay === selector) { replay = null; return; }
      event.preventDefault(); event.stopImmediatePropagation();
      if (busy) return;
      if (!sameRequest(currentRequest(), prepared.request)) { error(new Error('Transaction details changed. Prepare the named send again.')); return; }
      const snapshot = generation;
      busy = true;
      button.disabled = true;
      try {
        await client.revalidate(prepared);
        if (generation !== snapshot || !prepared || !sameRequest(currentRequest(), prepared.request)) throw new Error('Send details changed during 420 Name verification');
        replay = selector;
        button.disabled = false;
        button.click(); // Delegate simulation/signing to the existing SmartAccount owner handler.
        replay = null;
      } catch (cause) { error(cause); }
      finally { replay = null; busy = false; }
    }, { capture: true });
  }
  globalThis.ethereum?.on?.('chainChanged', () => clear('Network changed. Prepare the named send again.'));
  globalThis.ethereum?.on?.('accountsChanged', () => clear('Account changed. Prepare the named send again.'));
}
if (typeof document !== 'undefined') installNamesSend();
