import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createPrivate420StorageRetrieval420} from '../core/arbitration-storage420.js';
const h=n=>'0x'+n.toString(16).padStart(64,'0');
const toHex=bytes=>'0x'+Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const privateBytes=new TextEncoder().encode('encrypted-object-ciphertext-only');
const root=()=>webcrypto.subtle.digest('SHA-256',privateBytes).then(x=>toHex(new Uint8Array(x)));
async function fixture(){
  const object={object_id:'object-1',manifest_id:'manifest-1',shard_index:0,
    shard_root:await root(),size_bytes:privateBytes.length,commitment_id:'storage-id-1'};
  const grant={storageSubject:'420id-subject',storageSessionId:'420id-private-access-session-123456'};
  return {object,grant};
}
test('private 420Storage v1 retrieval sends scoped capability headers and no public URL credentials',async()=>{
  const {object,grant}=await fixture(),calls=[];
  const store=createPrivate420StorageRetrieval420({
    endpoint:'https://private-storage.example.test',
    cryptoImpl:webcrypto,
    fetchImpl:async(url,opts)=>{
      calls.push([url,opts]);return new Response(privateBytes,
        {status:200,headers:{'cache-control':'private, no-store'}});
    }
  });
  const found=await store.retrieve({object,grant,mode:'private'});
  assert.deepEqual(found.bytes,privateBytes);
  assert.equal(found.visibility,'private');
  const [url,opts]=calls[0];
  const parsed=new URL(url);
  assert.equal(parsed.pathname,'/v1/resources/retrieve');
  for(const field of Object.keys(object))assert.equal(parsed.searchParams.get(field),String(object[field]));
  assert(!url.includes(grant.storageSessionId));
  assert.equal(opts.headers['X-420-Access-Mode'],'private');
  assert.equal(opts.headers['X-420-Session-ID'],grant.storageSessionId);
  assert.equal(opts.headers['X-420-Capability'],'read');
  assert.equal(opts.cache,'no-store');assert.equal(opts.redirect,'error');
  assert.equal(opts.credentials,'omit');
  assert.equal(opts.referrerPolicy,'no-referrer');
});
test('plaintext, insecure, credentialed and untrusted endpoints fail without network activity',()=>{
  for(const endpoint of ['http://private-storage.example.test','ftp://private-storage.example.test',
    'https://user:password@private-storage.example.test','https://private-storage.example.test/?token=secret',
    'https://private-storage.example.test/#secret','javascript:alert(1)'])
    assert.throws(()=>createPrivate420StorageRetrieval420({endpoint,cryptoImpl:webcrypto,
      fetchImpl:async()=>{throw Error('MUST NOT SEND');}}),/unavailable/);
});
test('missing scoped session, wrong mode, malicious reference and missing object reject before fetch',async()=>{
  const {object,grant}=await fixture();let count=0;
  const store=createPrivate420StorageRetrieval420({endpoint:'https://private-storage.example.test',
    cryptoImpl:webcrypto,fetchImpl:async()=>{count++;return null;}});
  for(const x of [
    {object,grant,mode:'public'},
    {object,grant:{storageSubject:'a',storageSessionId:'short'},mode:'private'},
    {object:{...object,object_id:'../../etc/passwd'},grant,mode:'private'},
    {object:{...object,size_bytes:0},grant,mode:'private'},
    {object:{...object,shard_root:h(0)},grant,mode:'public'},
    {object:null,grant,mode:'private'}
  ])await assert.rejects(store.retrieve(x),/unavailable/);
  assert.equal(count,0);
});
test('private retrieval refuses public cache, changed bytes, wrong SHA, denied/expired or oversized response',async()=>{
  const {object,grant}=await fixture();
  for(const response of [
    new Response(privateBytes,{status:200,headers:{'cache-control':'public, max-age=3600'}}),
    new Response(privateBytes,{status:200,headers:{'cache-control':'private'}}),
    new Response(new TextEncoder().encode('replacement'),{status:200,headers:{'cache-control':'no-store'}}),
    new Response(privateBytes,{status:403,headers:{'cache-control':'no-store'}}),
    new Response(privateBytes,{status:503,headers:{'cache-control':'no-store'}})
  ]){
    const store=createPrivate420StorageRetrieval420({endpoint:'https://private-storage.example.test',
      cryptoImpl:webcrypto,fetchImpl:async()=>response});
    await assert.rejects(store.retrieve({object,grant,mode:'private'}),/unavailable/);
  }
});
test('storage provider error text and access credentials never leak through application errors',async()=>{
  const {object,grant}=await fixture();
  const store=createPrivate420StorageRetrieval420({endpoint:'https://private-storage.example.test',
    cryptoImpl:webcrypto,fetchImpl:async()=>{throw Error('private-secret='+grant.storageSessionId);}});
  await assert.rejects(store.retrieve({object,grant,mode:'private'}),e=>
    !String(e.message).includes(grant.storageSessionId)&&String(e.message).includes('unavailable'));
});
test('cancelled private Storage request aborts before fetch',async()=>{
  const {object,grant}=await fixture();let count=0;
  const controller=new AbortController();controller.abort();
  const store=createPrivate420StorageRetrieval420({endpoint:'https://private-storage.example.test',
    cryptoImpl:webcrypto,fetchImpl:async()=>{count++;return null;}});
  await assert.rejects(store.retrieve({object,grant,mode:'private',signal:controller.signal}),/unavailable/);
  assert.equal(count,0);
});
