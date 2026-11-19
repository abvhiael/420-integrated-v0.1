import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

test('Android embeds canonical checkout links and rejects wrong chain, origin and injected actions', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'pay-android-sdk-'));
  try {
    const bundle = join(temp, 'sdk.js');
    execFileSync(process.execPath, ['build-sdk.mjs', bundle]);
    const realm = { URL, URLSearchParams };
    runInNewContext(await readFile(bundle, 'utf8'), realm);
    const host = 'pay.420integrated.org';
    const chain = '420';
    const id = '0x' + 'a'.repeat(64);
    const invoke = input => realm.reviewPay420(input, host, chain);
    const link = 'https://' + host + '/#pay?v=1&chain=420&kind=invoice&id=' + id;
    assert.equal(invoke(link), link);
    assert.match(invoke('0x' + 'a'.repeat(40)), /kind=address/);
    assert.equal(invoke(link.replace('chain=420', 'chain=42')), null);
    assert.equal(invoke(link.replace(host, host + '.invalid')), null);
    assert.equal(invoke(link + '&to=0x0'), null);
    assert.equal(invoke('420wallet://connect'), null);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
