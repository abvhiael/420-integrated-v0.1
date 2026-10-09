import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { RequestAuth,signingMessage,hash,safeMedia,encryptDelivery,decryptDelivery } from '../src/security.mjs';
import { setup,seller,attacker,NOW } from './fixtures.mjs';
const origin='https://commerce.example.invalid';
test('wallet request signature binds origin/chain/wallet/method/path/body/expiry and nonce is one use',async t=>{
  const f=setup();t.after(()=>f.close());const auth=new RequestAuth(f.db,{origin,chainId:'420',now:f.now}),c=auth.challenge(seller.address),body=Buffer.from('{"test":true}');
  const message=signingMessage({...c,method:'POST',path:'/v1/test',bodyHash:hash(body)}),signature=await seller.signMessage(message),headers={'x-commerce-wallet':seller.address,'x-commerce-nonce':c.nonce,'x-commerce-signature':signature};
  for(const [method,path,payload,site] of [['PATCH','/v1/test',body,origin],['POST','/v1/other',body,origin],['POST','/v1/test',Buffer.from('{}'),origin],['POST','/v1/test',body,'https://evil.invalid']])assert.throws(()=>auth.authenticate(headers,method,path,payload,site));
  assert.equal(auth.authenticate(headers,'POST','/v1/test',body,origin),seller.address.toLowerCase());assert.throws(()=>auth.authenticate(headers,'POST','/v1/test',body,origin),e=>e.code==='invalid_nonce');
});
test('wrong signer, malformed headers, different network and expired nonce fail closed',async t=>{
  const f=setup();t.after(()=>f.close());const auth=new RequestAuth(f.db,{origin,chainId:'420',now:f.now}),c=auth.challenge(seller.address),body=Buffer.alloc(0),message=signingMessage({...c,chainId:'421',method:'GET',path:'/v1/test',bodyHash:hash(body)}),headers={'x-commerce-wallet':seller.address,'x-commerce-nonce':c.nonce,'x-commerce-signature':await seller.signMessage(message)};
  assert.throws(()=>auth.authenticate(headers,'GET','/v1/test',body,origin));headers['x-commerce-signature']=await attacker.signMessage(signingMessage({...c,method:'GET',path:'/v1/test',bodyHash:hash(body)}));assert.throws(()=>auth.authenticate(headers,'GET','/v1/test',body,origin));f.advance(120001);assert.throws(()=>auth.authenticate(headers,'GET','/v1/test',body,origin));assert.throws(()=>auth.authenticate({},'GET','/v1/test',body,origin));
});
test('contract wallet signature requires canonical verifier and consumes nonce only after success',async t=>{
  const f=setup();t.after(()=>f.close());let valid=false,calls=0;
  const auth=new RequestAuth(f.db,{origin,chainId:'420',now:f.now,verifyContractSignature:async(address,message,signature)=>{calls++;assert.ok(message.includes('Chain: 420'));assert.equal(signature,'0x1234');return valid;}}),c=auth.challenge(seller.address),headers={'x-commerce-wallet':seller.address,'x-commerce-nonce':c.nonce,'x-commerce-signature':'0x1234'};
  await assert.rejects(()=>auth.authenticate(headers,'GET','/v1/test',Buffer.alloc(0),origin),e=>e.code==='invalid_signature');assert.equal(f.db.get('SELECT used FROM auth_nonces').used,0);valid=true;assert.equal(await auth.authenticate(headers,'GET','/v1/test',Buffer.alloc(0),origin),seller.address.toLowerCase());assert.equal(calls,2);
});
test('JPEG/PNG/WebP safely re-encode, strip metadata and reject SVG/HTML/MIME confusion/truncated bytes',async()=>{
  for(const [format,mime] of [['png','image/png'],['jpeg','image/jpeg'],['webp','image/webp']]){const image=await sharp({create:{width:8,height:8,channels:3,background:'#123456'}})[format]().withMetadata().toBuffer(),output=await safeMedia(image,mime),meta=await sharp(output).metadata();assert.equal(meta.format,'png');assert.equal(meta.exif,undefined);assert.equal(meta.icc,undefined);}
  for(const [data,mime] of [[Buffer.from('<svg onload="alert(1)"></svg>'),'image/svg+xml'],[Buffer.from('<script>evil</script>'),'image/png'],[Buffer.from('http://169.254.169.254/metadata'),'image/jpeg'],[Buffer.alloc(6*1024*1024),'image/png']])await assert.rejects(()=>safeMedia(data,mime));
  const png=await sharp({create:{width:2,height:2,channels:3,background:'#000'}}).png().toBuffer();await assert.rejects(()=>safeMedia(png,'image/jpeg'));await assert.rejects(()=>safeMedia(png.subarray(0,20),'image/png'));
});
test('dimension bomb and active animated media cannot pass public upload policy',async()=>{
  const large=await sharp({create:{width:4097,height:1,channels:3,background:'#000'}}).png().toBuffer();await assert.rejects(()=>safeMedia(large,'image/png'));
});
test('private payload AEAD fails on tampering, wrong tenant, order or key; nonce randomized',()=>{
  const key=randomBytes(32),first=encryptDelivery(key,'order','store','PRIVATE'),second=encryptDelivery(key,'order','store','PRIVATE');assert.notDeepEqual(first,second);assert.equal(decryptDelivery(key,'order','store',first),'PRIVATE');
  assert.throws(()=>decryptDelivery(key,'order','other',first));assert.throws(()=>decryptDelivery(key,'other','store',first));assert.throws(()=>decryptDelivery(randomBytes(32),'order','store',first));first[15]^=1;assert.throws(()=>decryptDelivery(key,'order','store',first));
});
