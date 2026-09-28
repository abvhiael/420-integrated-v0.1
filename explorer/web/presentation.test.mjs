import test from 'node:test';
import assert from 'node:assert/strict';
import {
  feePresentation420,
  inspectableRaw420,
  renderFeeSummary420,
  renderRawLog420,
  renderRawLogs420,
  transactionDetailPresentation420,
  validateRawLog420
} from './static/presentation.mjs';

const h = (n) => '0x' + BigInt(n).toString(16).padStart(64,'0');
const addr = (n) => '0x' + BigInt(n).toString(16).padStart(40,'0');

function txView(overrides={}) {
  const transaction = {
    chainId:420,
    blockNumber:9,
    blockHash:h(9),
    hash:h(10),
    index:2,
    from:addr(1),
    to:addr(2),
    valueWei:'420',
    input:'0xdeadbeef',
    ...(overrides.transaction || {})
  };
  const receipt = {
    chainId:420,
    blockNumber:9,
    blockHash:h(9),
    transactionHash:h(10),
    transactionIndex:2,
    status:0,
    statusLabel:'REVERTED',
    gasUsed:21000,
    effectiveGasPriceWei:'2000000000',
    actualFeeWei:'42000000000000',
    ...(overrides.receipt || {})
  };
  return {transaction,receipt,logs:overrides.logs || [],finality:'FINALIZED'};
}

function rawLog(overrides={}) {
  return {
    chainId:420,
    blockNumber:9,
    blockHash:h(9),
    transactionHash:h(10),
    transactionIndex:2,
    logIndex:3,
    address:addr(4),
    topics:[h(11),h(12),h(13)],
    data:'0xdeadbeef',
    ...overrides
  };
}

test('known fee vector renders gas used, effective gas price, and actual fee distinctly', () => {
  const fee=feePresentation420(txView().receipt);
  assert.deepEqual(fee,{gasUsed:'21000',effectiveGasPriceWei:'2000000000',actualFeeWei:'42000000000000'});
  const html=renderFeeSummary420(txView().receipt);
  assert.match(html,/Gas used/);
  assert.match(html,/Effective gas price \(wei\)/);
  assert.match(html,/Actual fee \(wei\)/);
  assert.match(html,/42000000000000/);
});

test('zero fee and very large integer-string fee values remain exact', () => {
  assert.deepEqual(
    feePresentation420({gasUsed:0,effectiveGasPriceWei:'999999999999999999999999',actualFeeWei:'0'}),
    {gasUsed:'0',effectiveGasPriceWei:'999999999999999999999999',actualFeeWei:'0'}
  );
  const price='123456789012345678901234567890';
  const gasUsed=30000000;
  const actual=(BigInt(price)*BigInt(gasUsed)).toString();
  const html=renderFeeSummary420({gasUsed,effectiveGasPriceWei:price,actualFeeWei:actual});
  assert.ok(html.includes(price));
  assert.ok(html.includes(actual));
  assert.ok(!html.includes('…'));
});

test('missing, unsafe, or inconsistent fee provenance fails closed', () => {
  assert.throws(()=>feePresentation420({gasUsed:21000,effectiveGasPriceWei:'1'}),/actual fee/);
  assert.throws(()=>feePresentation420({gasUsed:21000,effectiveGasPriceWei:'2',actualFeeWei:'1'}),/inconsistent/);
  assert.throws(()=>feePresentation420({gasUsed:Number.MAX_SAFE_INTEGER+1,effectiveGasPriceWei:'1',actualFeeWei:'1'}),/exact/);
  assert.throws(()=>feePresentation420({gasUsed:1,effectiveGasPriceWei:'01',actualFeeWei:'1'}),/canonical/);
});

test('reverted transaction preserves raw input and value with exact provenance', () => {
  const qualified=transactionDetailPresentation420(txView());
  assert.equal(qualified.raw.input,'0xdeadbeef');
  assert.equal(qualified.raw.valueWei,'420');
  assert.equal(qualified.chainId,'420');
  assert.equal(qualified.txHash,h(10));
});

test('transaction/receipt provenance contradiction fails closed', () => {
  assert.throws(()=>transactionDetailPresentation420(txView({receipt:{transactionHash:h(99)}})),/provenance/);
  assert.throws(()=>transactionDetailPresentation420(txView({receipt:{chainId:421}})),/provenance/);
});

test('multi-topic raw event renders complete values and provenance without clipping', () => {
  const log=rawLog();
  const html=renderRawLog420(log,'multi');
  assert.ok(html.includes(addr(4)));
  assert.ok(html.includes(h(9)));
  assert.ok(html.includes(h(10)));
  for (const topic of log.topics) assert.ok(html.includes(topic));
  assert.ok(html.includes('0xdeadbeef'));
  assert.ok(html.includes('Chain ID'));
  assert.ok(html.includes('Transaction index'));
  assert.ok(html.includes('Log index'));
  assert.ok(!html.includes('…'));
});

test('empty raw event data is represented explicitly and remains copyable as empty', () => {
  const html=renderRawLog420(rawLog({data:''}),'empty');
  assert.ok(html.includes('(empty raw value)'));
  assert.ok(html.includes('data-copy-value=""'));
});

test('transaction and block event views share the same deterministic raw renderer', () => {
  const logs=[rawLog({logIndex:0}),rawLog({logIndex:1,topics:[h(21)]})];
  const tx=renderRawLogs420(logs,'tx');
  const block=renderRawLogs420(logs,'block');
  const normalize=(html)=>html.replaceAll(/(tx|block)-/g,'view-');
  assert.equal(normalize(tx),normalize(block));
});

test('malformed event address, topic, and data fail closed', () => {
  assert.throws(()=>validateRawLog420(rawLog({address:'0x1234'})),/invalid length/);
  assert.throws(()=>validateRawLog420(rawLog({topics:['0x1234']})),/invalid length/);
  assert.throws(()=>validateRawLog420(rawLog({data:'0xabc'})),/malformed/);
  assert.throws(()=>validateRawLog420(rawLog({data:'javascript:alert(1)'})),/malformed/);
});

test('hostile strings are escaped and decoded labels cannot override raw values', () => {
  const raw='<script>alert(1)</script>';
  const html=inspectableRaw420(raw,'hostile','hostile');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  const eventHtml=renderRawLog420({...rawLog(),decodedLabel:'<img src=x onerror=alert(1)>'},'decoded');
  assert.ok(!eventHtml.includes('onerror'));
  assert.ok(eventHtml.includes('Raw indexed values are primary'));
});

test('long raw values remain fully inspectable and copy payload is not truncated', () => {
  const raw='0x'+'ab'.repeat(512);
  const html=inspectableRaw420(raw,'long raw','long');
  assert.ok(html.includes(raw));
  assert.ok(html.includes(`data-copy-value="${raw}"`));
  assert.ok(!html.includes('…'));
});
