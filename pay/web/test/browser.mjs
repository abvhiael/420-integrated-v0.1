import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { keccak256Hex } from '../../../wallet/web/core/keccak.js';

const origin = 'https://pay.420integrated.org';
const rpcUrl = 'https://rpc.example.test/';
const address = digit => '0x' + digit.repeat(40);
const hash = digit => '0x' + digit.repeat(64);
const word = item => (typeof item === 'string' ? item.slice(2) : item.toString(16)).padStart(64, '0');
const encode = (...items) => '0x' + items.map(word).join('');
const digest = text => keccak256Hex(new TextEncoder().encode(text));
const key = (signature, arg) => digest(signature).slice(0, 10) + digest(arg).slice(2);
const blocks = { hash: hash('a'), number: '0x80', timestamp: '0xfa' };
const account = address('9');
const bytecode = '0x6000';
const codeHash = keccak256Hex(Uint8Array.of(0x60, 0x00));
const names = ['INVOICE_REGISTRY', 'PAYMENT_REGISTRY', 'PAYMENT_ROUTER'].map(id => '420/APP/420PAY/' + id);
const service = digit => ({ implementation: address(digit), metadataHash: hash('b'), codeHash, version: 1 });
const config = { origin, rpcUrl, chainId: '420', registry: address('1'), registryCodeHash: codeHash,
  pay: service('2'), names: service('3'), identity: service('4'),
  components: Object.fromEntries(names.map(name => [name, codeHash])) };
const latest = { blockHash: blocks.hash, requireCanonical: true };
const paymentId = hash('d');
const invoiceId = hash('e');
const topic = digest('PaymentSet(bytes32,bytes32,uint8)');
const mime = { 'index.html': 'text/html', 'app.js': 'text/javascript', 'style.css': 'text/css' };
let status = 5;
let balanceGate;
const browser = await chromium.launch({ channel: process.env.PAY_BROWSER_CHANNEL ?? 'chromium' });
try {
  const context = await browser.newContext({viewport: {width: 1440, height: 900}});
  const page = await context.newPage();
  let deployment = null;
  await page.route(origin + '/**', async route => {
    const file = new URL(route.request().url()).pathname.slice(1) || 'index.html';
    if (file === 'deployment.json') return route.fulfill({json: deployment});
    if (!Object.hasOwn(mime, file)) return route.abort();
    return route.fulfill({contentType: mime[file], body: await readFile(new URL('../dist/' + file, import.meta.url))});
  });
  await page.route(rpcUrl, async route => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({headers: {'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST'}});
    }
    const {id, method, params} = route.request().postDataJSON();
    let result;
    switch (method) {
      case 'eth_chainId': result = '0x1a4'; break;
      case 'eth_getBlockByHash':
      case 'eth_getBlockByNumber': result = blocks; break;
      case 'eth_getCode':
        assert.deepEqual(params[1], latest);
        result = bytecode; break;
      case 'eth_getBalance':
        assert.deepEqual(params, [account, latest]);
        if (balanceGate) await balanceGate;
        result = '0x3a4965bf58a40000'; break;
      case 'eth_getLogs':
        assert.deepEqual(params, [{address: address('7'), topics: [topic], fromBlock: '0x1', toBlock: '0x80'}]);
        result = [{address: address('7'), topics: [topic, paymentId, invoiceId], blockNumber: '0x80',
          blockHash: blocks.hash, logIndex: '0x0', removed: false}];
        break;
      case 'eth_call': {
        const [{to, data}, blockTag] = params;
        assert.deepEqual(blockTag, latest);
        if (data === '0xe66eefc8' + paymentId.slice(2)) {
          assert.equal(to, address('7'));
          result = encode(invoiceId, account, address('8'), address('0'), 12, address('0'), 12, hash('0'), 0, hash('c'), 0, 0, status);
        } else {
          assert.equal(to, config.registry);
          if (data === key('getService(bytes32)', '420/service/pay/v1')) {
            result = encode(config.pay.implementation, codeHash, config.pay.metadataHash, 1, 1, 1);
          } else {
            const index = names.findIndex(name => key('component(bytes32)', name) === data);
            assert.ok(index >= 0, 'unexpected Registry request');
            result = encode(digest(names[index]), address(String(index + 6)), codeHash, 1, 0, 0, 2);
          }
        }
        break;
      }
      default: assert.fail('unexpected RPC method ' + method);
    }
    return route.fulfill({headers: {'access-control-allow-origin': origin}, json: {jsonrpc: '2.0', id, result}});
  });

  await page.goto(origin);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').innerText(), 'Skip to account');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator(':focus').getAttribute('id'), 'main');
  const fixtureButton = page.getByRole('button', {name: 'Open fixture mode'});
  await fixtureButton.click();
  await page.getByText('428.42 420', {exact: true}).waitFor();
  assert.match(await page.locator('#banner').innerText(), /Sample balances/);
  assert.equal(await page.locator('#history li').count(), 3);
  assert.equal(await page.getByRole('button', {name: /Download receipt/}).count(), 2);
  await page.getByLabel('Show').selectOption('sent');
  assert.equal(await page.locator('#history li').count(), 2);
  await page.getByLabel('Hide balances and payment amounts').check();
  assert.equal(await page.getByText('Amount hidden', {exact: true}).count(), 3);
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: /Download receipt/}).click();
  const fixtureReceipt = await download;
  assert.match(fixtureReceipt.suggestedFilename(), /^fixture-/);
  assert.equal(JSON.parse(await readFile(await fixtureReceipt.path(), 'utf8')).status, 'PARTIALLY_REFUNDED');
  await page.getByRole('button', {name: 'Load earlier activity'}).click();
  await page.getByText(/Blocks 0–256/).waitFor();
  assert.equal(await page.locator('#history li').count(), 2);
  for (const width of [1440, 320]) {
    await page.setViewportSize({width, height: 900});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepEqual((await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations, []);
  }
  await page.reload();
  await fixtureButton.waitFor();
  assert.equal(await page.locator('#banner').isVisible(), false);
  assert.equal(await page.getByLabel('Hide balances and payment amounts').isChecked(), true);

  deployment = config;
  await page.addInitScript(({ account }) => {
    const handlers = new Map();
    let accounts = [account];
    window.calls = [];
    window.walletChange = next => {
      accounts = next;
      for (const fn of handlers.get('accountsChanged') ?? []) fn(next);
    };
    const provider = {
      is420Wallet: true,
      async request({method, params}) {
        window.calls.push({method, params});
        if (method === 'eth_chainId') return '0x1a4';
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return accounts;
        if (method === 'wallet_revokePermissions') { accounts = []; return null; }
        throw new Error('Unexpected Wallet method');
      },
      on(event, fn) { handlers.set(event, new Set([...(handlers.get(event) ?? []), fn])); },
      removeListener(event, fn) { handlers.get(event)?.delete(fn); }
    };
    window.addEventListener('eip6963:requestProvider', () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
      detail: { info: { rdns: 'integrated.420.wallet' }, provider }
    })));
  }, {account});
  await page.goto(origin + '/?fixture=1');
  await page.getByRole('button', {name: 'Connect 420 Wallet'}).click();
  await page.getByText('Settled', {exact: true}).waitFor();
  assert.equal(await fixtureButton.count(), 0);
  assert.equal(await page.locator('#banner').isVisible(), false);
  await page.getByLabel('Hide balances and payment amounts').uncheck();
  assert.match(await page.locator('#asset-list').innerText(), /4\.2 420/);
  const liveDownload = page.waitForEvent('download');
  await page.getByRole('button', {name: /Download receipt/}).click();
  const liveReceipt = await liveDownload;
  assert.equal(JSON.parse(await readFile(await liveReceipt.path(), 'utf8')).source, 'canonical-payment-registry');
  status = 1;
  await page.getByRole('button', {name: /Download receipt/}).click();
  await page.getByText(/Receipt evidence is unavailable/).waitFor();
  let unblock;
  balanceGate = new Promise(resolve => { unblock = resolve; });
  await page.getByRole('button', {name: 'Refresh'}).click();
  await page.evaluate(() => window.walletChange([]));
  unblock();
  await page.getByText('Wallet account or network changed. Connect again.').waitFor();
  assert.equal(await page.locator('#history li').count(), 0);
  assert.equal(await page.locator('#asset-list li').count(), 0);
  await page.evaluate(account => window.walletChange([account]), account);
  await page.getByRole('button', {name: 'Connect 420 Wallet'}).click();
  await page.getByText('Submitted', {exact: true}).waitFor();
  await page.getByRole('button', {name: 'Disconnect Wallet'}).click();
  await page.getByText('Wallet disconnected.').waitFor();
  assert.deepEqual(await page.evaluate(() => window.calls.at(-1)), {
    method: 'wallet_revokePermissions', params: [{eth_accounts: {}}]
  });
  console.log('PASS: fixture isolation, responsive layout, axe, balances, statuses, receipts, Wallet invalidation and revocation');
} finally {
  await browser.close();
}
