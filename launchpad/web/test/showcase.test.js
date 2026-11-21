import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {examples,bySlug,percentage,filterExamples,parseRoute} from '../sample-catalog.js';

test('each example has a unique safe deep-link and explicit fictional metadata',()=>{
  assert.equal(new Set(examples.map(c=>c.slug)).size,examples.length);
  for(const c of examples){
    assert.match(c.slug,/^[a-z0-9-]{1,60}$/);
    assert.equal(bySlug(c.slug),c);
    assert.ok(c.goal>0&&c.raised>=0);
    assert.ok(['REWARD','DONATION','COMMUNITY_PROJECT','PRODUCT_PREORDER'].includes(c.mode));
    assert.ok(percentage(c)>=0&&percentage(c)<=100);
  }
});
test('route parsing is bounded to declared views and known sample campaign identifiers',()=>{
  assert.deepEqual(parseRoute(''),{page:'home'});
  assert.deepEqual(parseRoute('#/home'),{page:'home'});
  for(const page of ['discover','creator','overview','live'])
    assert.deepEqual(parseRoute('#/'+page),{page});
  assert.deepEqual(parseRoute('#/campaign/greenroots'),{page:'campaign',slug:'greenroots'});
  assert.deepEqual(parseRoute('#/campaign/not-real'),{page:'not-found'});
  assert.deepEqual(parseRoute('#/campaign/../../live'),{page:'not-found'});
  assert.deepEqual(parseRoute('#/transaction/0x0'),{page:'not-found'});
});
test('example filters are case-insensitive and do not alter source fixtures',()=>{
  assert.equal(filterExamples(examples,{category:'Donations'}).length,1);
  assert.equal(filterExamples(examples,{query:'greenroots'}).length,1);
  assert.equal(filterExamples(examples,{query:'not present'}).length,0);
  assert.equal(filterExamples(examples,{category:'All'}).length,examples.length);
});
test('sample routes visibly prohibit payment and preserve the real workspace',()=>{
  const root=path.resolve(import.meta.dirname,'..');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const showcase=fs.readFileSync(path.join(root,'showcase.js'),'utf8');
  const build=fs.readFileSync(path.join(root,'scripts/build.mjs'),'utf8');
  assert.match(html,/FICTIONAL EXAMPLE — NOT FUNDRAISING/);
  assert.match(html,/contributions disabled/);
  assert.match(html,/id="view-live"/);
  assert.match(html,/id="creator-form"/);
  assert.match(html,/id="review-gate"/);
  assert.match(html,/id="connect-wallet"/);
  assert.match(showcase,/All content rendered here is explicitly illustrative/);
  assert.doesNotMatch(showcase,/eth_sendTransaction|creatorSubmit\(|\.prepare\(/);
  assert.match(build,/sample-catalog\.js/);
  assert.match(build,/showcase\.js/);
});
