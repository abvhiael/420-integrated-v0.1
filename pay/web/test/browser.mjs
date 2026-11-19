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
const names = ['INVOICE_REGISTRY', 'PAYMENT_REGISTRY', 'PAYMENT_ROUTER', 'MERCHANT_REGISTRY', 'NATIVE_QUOTE_SOURCE'].map(id => '420/APP/420PAY/' + id);
const service = digit => ({ implementation: address(digit), metadataHash: hash('b'), codeHash, version: 1 });
const config = { origin, rpcUrl, chainId: '420', registry: address('1'), registryCodeHash: codeHash,
  pay: service('2'), names: service('3'), identity: service('4'),
  components: Object.fromEntries(names.map(name => [name, codeHash])) };
const finalizedBlock = { hash: hash('b'), number: '0x7f', timestamp: '0xfa' };
const finalizedTag = { blockHash: finalizedBlock.hash, requireCanonical: true };
const latest = { blockHash: blocks.hash, requireCanonical: true };
const paymentId = hash('d');
const invoiceId = hash('e');
const topic = digest('PaymentSet(bytes32,bytes32,uint8)');
const mime = { 'index.html': 'text/html', 'app.js': 'text/javascript', 'style.css': 'text/css' };
let status = 5;
let finalizedStatus = 1;
let businessRegistered = false;
const businessId = hash('6');
const builtInvoice = hash('7');
let invoicePublished = false;
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
      case 'eth_getBlockByNumber':
        result = ['finalized', finalizedBlock.hash, finalizedBlock.number].includes(params[0]) ? finalizedBlock : blocks;
        break;
      case 'eth_getCode':
        assert.deepEqual(params[1], params[1].blockHash === finalizedBlock.hash ? finalizedTag : latest);
        result = bytecode; break;
      case 'eth_getBalance':
        assert.deepEqual(params, [account, latest]);
        if (balanceGate) await balanceGate;
        result = '0x3a4965bf58a40000'; break;
      case 'eth_getLogs':
                assert.deepEqual(params, [{address: address('7'), topics: [topic],
          fromBlock: params[0].toBlock === '0x7f' ? '0x0' : '0x1', toBlock: params[0].toBlock}]);
        if (params[0].toBlock === '0x7f') { result = []; break; }
        result = [{address: address('7'), topics: [topic, paymentId, invoiceId], blockNumber: '0x80',
          blockHash: blocks.hash, logIndex: '0x0', removed: false}];
        break;
      case 'eth_call': {
        const [{to, data}, blockTag] = params;
        const finalized = blockTag.blockHash === finalizedBlock.hash;
        assert.deepEqual(blockTag, finalized ? finalizedTag : latest);
        if (data === digest('nativeAcceptedAssetsHash()').slice(0, 10)) {
          assert.equal(to, address('a'));
          result = hash('1');
        } else if (data === digest('getInvoice(bytes32)').slice(0, 10) + builtInvoice.slice(2)) {
          assert.equal(to, address('6'));
          result = invoicePublished ? encode(businessId, account, hash('0'), '0x' + '343230'.padEnd(64,'0'),
            100, 500, 600, 2, 1, 1, 42, hash('1'), hash('0'), hash('2'), 1) : encode(...Array(15).fill(0));
        } else if (data === digest('paidAmount(bytes32)').slice(0, 10) + builtInvoice.slice(2)) {
          assert.equal(to, address('6'));
          result = encode(40);
        } else if (data === digest('isClosed(bytes32)').slice(0, 10) + builtInvoice.slice(2)) {
          assert.equal(to, address('6'));
          result = encode(0);
        } else if (data.startsWith(digest('quoteNative(bytes32,address,uint256,uint64)').slice(0, 10))) {
          assert.equal(to, address('a'));
          const at = BigInt('0x' + data.slice(-64));
          result = encode(at === 250n ? hash('8') : hash('9'), address('8'), address('3'), 12, at === 250n ? 292 : 300);
        } else if (data.startsWith(digest('feeQuote(bytes32,bytes)').slice(0, 10))) {
          assert.equal(to, address('a'));
          const at = BigInt('0x' + data.slice(-64));
          result = encode(at === 250n ? hash('8') : hash('9'), 0, 0, 0, 0, 0, at, at === 250n ? 292 : 300);
        } else if (data.startsWith(digest('derivePaymentId(bytes32,address,address,address,uint256,address,uint256,bytes32,uint256)').slice(0, 10))) {
          assert.equal(to, address('7'));
          result = paymentId;
        } else if (data === digest('getInvoice(bytes32)').slice(0, 10) + invoiceId.slice(2)) {
          assert.equal(to, address('6'));
          result = encode(hash('4'), address('8'), hash('0'), '0x' + '343230'.padEnd(64,'0'),
            12, 300, 400, 0, 2, 0, 0, hash('1'), hash('0'), hash('0'), 1);
        } else if (data === digest('isClosed(bytes32)').slice(0, 10) + invoiceId.slice(2)) {
          assert.equal(to, address('6'));
          result = encode(0);
        } else if (data === digest('merchants(bytes32)').slice(0, 10) + businessId.slice(2)) {
          assert.equal(to, address('5'));
          result = businessRegistered ? encode(account, hash('0'), hash('0'), 2, 1, 1) : encode(...Array(6).fill(0));
        } else if (data.startsWith(digest('effectiveRole(bytes32,bytes32,address)').slice(0, 10))) {
          assert.equal(to, address('5'));
          result = encode(0);
        } else if (data === digest('merchants(bytes32)').slice(0, 10) + hash('4').slice(2)) {
          assert.equal(to, address('5'));
          result = encode(address('8'), hash('0'), hash('0'), 1, 1, 1);
        } else if (data === digest('currentPayout(bytes32)').slice(0, 10) + hash('4').slice(2)) {
          assert.equal(to, address('5'));
          result = encode(address('3'), 1, hash('0'));
        } else if (data === '0xe66eefc8' + paymentId.slice(2)) {
          assert.equal(to, address('7'));
          result = encode(invoiceId, account, address('8'), address('0'), 12, address('0'), 12, hash('0'), 0, hash('c'), 0, 0, finalized ? finalizedStatus : status);
        } else {
          assert.equal(to, config.registry);
          if (data === key('getService(bytes32)', '420/service/pay/v1')) {
            result = encode(config.pay.implementation, codeHash, config.pay.metadataHash, 1, 1, 1);
          } else {
            const index = names.findIndex(name => key('component(bytes32)', name) === data);
            assert.ok(index >= 0, 'unexpected Registry request');
            result = encode(digest(names[index]), address(index === 4 ? 'a' : index === 3 ? '5' : String(index + 6)), codeHash, 1, 0, 0, 2);
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

  await fixtureButton.click();
  await page.getByRole('button', {name: 'Create QR and link'}).click();
  await page.getByText('Fixture Receiving address link ready.').waitFor();
  const addressLink = await page.getByLabel('Share link').inputValue();
  assert.match(addressLink, /kind=address/);
  const qr = page.waitForEvent('download');
  await page.getByText('Download QR image', {exact: true}).click();
  await page.getByLabel('Read a QR image').setInputFiles(await (await qr).path());
  await page.getByText('QR read. Review the payment details.').waitFor();
  assert.equal(await page.getByLabel('Address, .420 name or Pay link').inputValue(), addressLink);
  await page.getByLabel('Amount in 420', {exact:true}).fill('1');
  await page.getByRole('button', {name:'Review payment'}).click();
  await page.getByText(/Direct address payment/).waitFor();
  assert.equal(await page.getByRole('button', {name:'Continue in 420 Wallet'}).count(), 0);
  await page.getByLabel('QR and link type').selectOption('invoice');
  await page.getByLabel('Canonical invoice ID').fill(hash('4'));
  await page.getByRole('button', {name:'Create QR and link'}).click();
  await page.getByText('Fixture Canonical invoice link ready.').waitFor();
  const invoiceLink = await page.getByLabel('Share link').inputValue();
  assert.match(invoiceLink, /kind=invoice/);
  assert.equal(new URLSearchParams(new URL(invoiceLink).hash.slice(5)).has('to'), false);
  await page.getByLabel('Amount in 420', {exact:true}).clear();
  await page.getByLabel('Address, .420 name or Pay link').fill(invoiceLink);
  await page.getByRole('button', {name:'Review payment'}).click();
  await page.locator('#payment-review').getByText(/Canonical invoice/).waitFor();
  assert.equal(await page.getByRole('button', {name:'Continue in 420 Wallet'}).count(), 0);

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
        if (method === 'eth_sendTransaction') {
          if (window.rejectSend) throw Object.assign(new Error('User rejected the request'), {code:4001});
          return '0x' + 'f'.repeat(64);
        }
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
  const recipient = address('5');
  const submittedRequest = new URL(origin);
  submittedRequest.hash = 'pay?' + new URLSearchParams({v:'1', kind:'request', chain:'420', to:recipient,
    value:'42000000000000000', expires:'300', id:hash('5')});
  await page.evaluate(fragment => { history.replaceState(null, '', location.pathname); location.hash = fragment; }, submittedRequest.hash);
  await page.getByText('Payment link loaded. Review the details before continuing.').waitFor();
  const review = page.getByRole('button', {name:'Review payment'});
  const confirm = page.getByRole('button', {name:'Continue in 420 Wallet'});
  await review.click();
  await page.locator('#payment-review').getByText(/0.042 420/).waitFor();
  await page.evaluate(() => { window.rejectSend = true; });
  await confirm.click();
  await page.getByText(/Wallet declined the payment before submission/).waitFor();
  await page.evaluate(() => { window.rejectSend = false; });
  await confirm.click();
  await page.locator('#payment-status').getByText(/^Submitted /).waitFor();
  const requests = await page.evaluate(() => window.calls.filter(call => call.method === 'eth_sendTransaction'));
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1].params, [{from:account, to:recipient, chainId:'0x1a4', data:'0x',
    value:'0x' + (42000000000000000n).toString(16)}]);
  await review.click();
  await confirm.click();
  await page.getByText(/^Already submitted /).waitFor();
  assert.equal(await page.evaluate(() => window.calls.filter(call => call.method === 'eth_sendTransaction').length), 2);
  const hostedLink = new URL(origin);
  hostedLink.hash = 'pay?' + new URLSearchParams({v:'1', kind:'invoice', chain:'420', id:invoiceId});
  await page.getByLabel('Address, .420 name or Pay link').fill(hostedLink.href);
  await review.click();
  await page.getByText(/Asset: native 420/).waitFor();
  assert.equal(await confirm.count(), 0);
  await page.getByText(/Acceptance: HIGH_VALUE/).waitFor();
  const invoicePay = page.getByRole('button', {name:'Continue to Wallet for invoice'});
  blocks.timestamp = '0x125';
  await invoicePay.click();
  await page.getByText(/Checkout terms changed or expired/).waitFor();
  assert.equal(await page.evaluate(() => window.calls.filter(call => call.method === 'eth_sendTransaction').length), 2);
  await invoicePay.click();
  await page.getByText(/Submitted to network/).waitFor();
  const invoiceCalls = await page.evaluate(() => window.calls.filter(call => call.method === 'eth_sendTransaction'));
  assert.equal(invoiceCalls.length, 3);
  assert.equal(invoiceCalls[2].params[0].to, address('8'));
  assert.equal(invoiceCalls[2].params[0].value, '0xc');
  assert.equal(invoiceCalls[2].params[0].data.slice(0, 10), digest('payNativeInvoice(bytes32,uint256,uint64,bytes32)').slice(0, 10));
  assert.equal(await page.getByLabel('Existing payment ID').inputValue(), paymentId);
  status = 5;
  await page.getByRole('button', {name:'Check payment status'}).click();
  await page.getByText(/Submitted · Canonical snapshot.*HIGH_VALUE/).waitFor();
  assert.match(await page.locator('#checkout-status').innerText(), new RegExp(finalizedBlock.hash));
  finalizedStatus = 5;
  await page.getByRole('button', {name:'Check payment status'}).click();
  await page.getByText(/Settled · Canonical snapshot/).waitFor();
  await review.click();
  await invoicePay.click();
  await page.getByText(/Previously submitted/).waitFor();
  assert.equal(await page.evaluate(() => window.calls.filter(call => call.method === 'eth_sendTransaction').length), 3);
  await page.getByLabel('Merchant ID', {exact:true}).fill(businessId);
  await page.getByRole('button', {name:'View merchant'}).click();
  await page.getByLabel('Payout address').fill(account);
  await page.getByRole('button', {name:'Review registration in Wallet'}).click();
  await page.locator('#business-status').getByText(/Submitted to Wallet network/).waitFor();
  const businessTx = await page.evaluate(() => window.calls.at(-1).params[0]);
  assert.deepEqual(businessTx, {chainId:'0x1a4', from:account, to:address('5'), value:'0x0',
    data:digest('registerForController(bytes32,address,address)').slice(0, 10) + word(businessId) + word(account) + word(account)});
  businessRegistered = true;
  await page.getByRole('button', {name:'View merchant'}).click();
  await page.getByText('CREDENTIALED · Active · Controller').waitFor();
  await page.getByRole('button', {name:'Load report', exact:true}).click();
  await page.getByText('No payments in this report interval.').waitFor();
  await page.getByLabel('Invoice ID', {exact:true}).fill(builtInvoice);
  await page.getByLabel('Invoice amount in base units').fill('100');
  await page.getByLabel('Invoice expiry (local time)').fill('2028-01-01T10:00');
  await page.getByLabel('Refund window ends (local time)').fill('2028-01-02T10:00');
  await page.getByLabel('Invoice mode').selectOption('2');
  await page.getByLabel('Optional tip policy commitment').fill(hash('2'));
  const callsBeforeDraft = await page.evaluate(() => window.calls.length);
  await context.setOffline(true);
  await page.getByRole('button', {name:'Save local draft'}).click();
  await page.getByText('Draft saved on this browser.').waitFor();
  assert.equal(await page.evaluate(() => window.calls.length), callsBeforeDraft);
  await context.setOffline(false);
  await page.getByRole('button', {name:'View merchant'}).click();
  await page.getByText('CREDENTIALED · Active · Controller').waitFor();
  assert.equal(await page.getByLabel('Invoice ID', {exact:true}).inputValue(), builtInvoice);
  await page.getByRole('button', {name:'Review invoice in Wallet'}).click();
  await page.locator('#business-status').getByText(/Submitted to Wallet network/).waitFor();
  const invoiceTx = await page.evaluate(() => window.calls.at(-1).params[0]);
  assert.equal(invoiceTx.to, address('6'));
  assert.ok(invoiceTx.data.startsWith(digest('createMerchantInvoice(bytes32,(bytes32,address,bytes32,bytes3,uint256,uint64,uint64,uint8,uint8,bool,uint16,bytes32,bytes32,bytes32,bool))').slice(0, 10) + word(builtInvoice) + word(businessId) + word(account)));
  assert.equal(await page.getByLabel('Verified invoice link').isVisible(), false);
  invoicePublished = true;
  await page.getByRole('button', {name:'Check finalized invoice'}).click();
  await page.getByText(/PARTIALLY_PAID · PARTIAL_PAYMENT · FINALIZED · Credited 40 · Outstanding 60/).waitFor();
  assert.match(await page.getByLabel('Verified invoice link').inputValue(), /kind=invoice/);
  await page.getByRole('button', {name:'Review invoice closure in Wallet'}).click();
  await page.getByText(/Closure submitted/).waitFor();
  assert.equal(await page.getByLabel('Verified invoice link').isVisible(), false);
  await page.getByLabel('Merchant ID', {exact:true}).fill(hash('4'));
  await page.getByRole('button', {name:'View merchant'}).click();
  await page.getByText('Merchant access denied').waitFor();
  assert.equal(await page.getByRole('button', {name:'Load report', exact:true}).count(), 0);
  await page.getByRole('button', {name: 'Disconnect Wallet'}).click();
  await page.getByText('Wallet disconnected.').waitFor();
  assert.deepEqual(await page.evaluate(() => window.calls.at(-1)), {
    method: 'wallet_revokePermissions', params: [{eth_accounts: {}}]
  });
  console.log('PASS: fixture isolation, responsive layout, axe, balances, statuses, receipts, Wallet invalidation and revocation');
} finally {
  await browser.close();
}
