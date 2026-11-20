import test from 'node:test';
import assert from 'node:assert/strict';
import {TOKEN_TEMPLATES_420, TOKEN_MAX_CALLDATA_BYTES_420, normalizeTokenDraft420,
  encodeTokenCreation420, decodeTokenCreation420, validateTokenCreationEncoding420} from '../core/token-app.js';
import {tokenWord420,tokenAddressWord420,tokenHashWord420,tokenHashHex420} from '../core/token-sdk.js';
import {normalizeCallData} from '../core/execution.js';
import {buildTokenDeploymentRequest420,prepareTokenDeploymentHandoff420} from '../core/token-handoff.js';
import {fixture,draftFor,digest,controller,state,addr} from './token-test-fixture.js';

const commitments=c=>({data:c.data,templateId:c.template.id,configHash:c.configHash,calldataHash:c.calldataHash});
const editWord=(data,index,value)=>data.slice(0,10+64*index)+value.padStart(64,'0')+data.slice(10+64*(index+1));
const editByte=(data,index,value)=>data.slice(0,2+2*index)+value+data.slice(4+2*index);
const max=(1n<<256n)-1n;
const voteMax=(1n<<208n)-1n;

test('all eight templates round trip canonical factory bytes and exact immutable JSON drafts',()=>{
  for(const p of TOKEN_TEMPLATES_420){
    const c=encodeTokenCreation420(draftFor(p));
    assert.deepEqual(decodeTokenCreation420(c.data),c);
    assert.deepEqual(decodeTokenCreation420('0x'+c.data.slice(2).toUpperCase()),c);
    assert.deepEqual(validateTokenCreationEncoding420(JSON.parse(JSON.stringify(c.draft)),commitments(c)),c);
    assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.draft)&&Object.isFrozen(c.template));
    assert.equal(normalizeCallData(c.data),c.data);
  }
});
test('draft schema rejects inherited/accessor/hidden/symbol fields without evaluating getters',()=>{
  const valid=draftFor();
  let accessed=0;
  const getter={...valid};Object.defineProperty(getter,'name',{enumerable:true,get(){accessed++;return 'N';}});
  const hidden={...valid};Object.defineProperty(hidden,'owner',{value:addr(3)});
  const hiddenKnown={...valid};Object.defineProperty(hiddenKnown,'name',{enumerable:false,value:'N'});
  for(const invalid of [Object.create(valid),getter,hidden,hiddenKnown,{...valid,[Symbol('owner')]:addr(5)},
    {...valid,owner:addr(2)},{...valid,uri:''},{...valid,templateId:digest(7)},new Date(),[],null])
    assert.throws(()=>normalizeTokenDraft420(invalid));
  assert.equal(accessed,0);
  const nullProto=Object.assign(Object.create(null),valid);
  assert.deepEqual(normalizeTokenDraft420(nullProto),normalizeTokenDraft420(valid));
  const d=normalizeTokenDraft420(valid);valid.name='changed';assert.notEqual(d.name,valid.name);
});
test('integer, salt and hex conversion reject trailing newline, noncanonical quantities and overflow',()=>{
  for(const v of ['1\n','1\r',' 1','1 ','01','1e3','0x1','+1','-1','9'.repeat(79),null,undefined,true,1.5,Number.MAX_SAFE_INTEGER+1,max+1n])assert.throws(()=>tokenWord420(v));
  for(const v of [digest(1)+'\n',digest(1)+'\r','0x1234'])assert.throws(()=>tokenHashWord420(v));
  assert.throws(()=>tokenAddressWord420(addr(1)+'\n'));
  assert.throws(()=>tokenHashHex420('0x00\n'));
  assert.throws(()=>decodeTokenCreation420(encodeTokenCreation420(draftFor()).data+'\n'));
  assert.equal(tokenWord420(max),'f'.repeat(64));
  assert.equal(normalizeTokenDraft420({...draftFor(),userSalt:'0x'+'AB'.repeat(32)}).userSalt,'0x'+'ab'.repeat(32));
});
test('supply/cap rules match actual constructor bounds; omitted uncapped cap becomes zero, explicit null is not a quantity',()=>{
  for(const p of TOKEN_TEMPLATES_420.filter(p=>p.standard==='ERC20')){
    const d=draftFor(p),limit=p.votes?voteMax:max;
    const valid={...d,initialSupply:limit,cap:p.capped?limit:0n};
    assert.equal(decodeTokenCreation420(encodeTokenCreation420(valid).data).draft.initialSupply,limit.toString());
    assert.throws(()=>encodeTokenCreation420({...valid,initialSupply:limit+1n}));
    for(const cap of [null,undefined,-1n,p.capped?0n:1n])assert.throws(()=>normalizeTokenDraft420({...valid,cap}));
    const omitted={...valid};delete omitted.cap;
    if(p.capped)assert.throws(()=>normalizeTokenDraft420(omitted));
    else assert.equal(normalizeTokenDraft420(omitted).cap,'0');
  }
});
test('aggregate ABI calldata size is enforced by normalization and decoding including selector and padding',()=>{
  for(const [template,field,base,length] of [
    ['ERC20_FIXED','name',{symbol:'',initialSupply:'0'},3808],
    ['ERC721_COLLECTION','baseURI',{name:'',symbol:''},3840],
    ['ERC1155_MULTI','uri',{},3968],
  ]){
    const d={template,userSalt:digest(1),...base,[field]:'x'.repeat(length)};
    const c=encodeTokenCreation420(d);
    assert.equal((c.data.length-2)/2,4068);
    assert.ok((c.data.length-2)/2<=TOKEN_MAX_CALLDATA_BYTES_420);
    assert.deepEqual(decodeTokenCreation420(c.data),c);
    for(const val of ['x'.repeat(length+1),'🌿'.repeat(length/4)+'x']){
      const bad={...d,[field]:val};
      assert.throws(()=>normalizeTokenDraft420(bad),/Wallet limit/);
      assert.throws(()=>encodeTokenCreation420(bad),/Wallet limit/);
    }
    assert.throws(()=>decodeTokenCreation420(c.data+'00'.repeat(32)),/calldata/);
  }
});
test('canonical empty strings, UTF8 byte boundaries, BOM and embedded null preserve exact metadata bytes',()=>{
  const values=['','a','x'.repeat(31),'x'.repeat(32),'x'.repeat(33),'🌿'.repeat(8),'a🌿'.repeat(7),'\ufeffName','a\u0000b','e\u0301','é'];
  for(const v of values){
    const d={template:'ERC721_COLLECTION',name:v,symbol:v,baseURI:v,userSalt:digest(0)};
    assert.deepEqual(decodeTokenCreation420(encodeTokenCreation420(d).data).draft,normalizeTokenDraft420(d));
  }
  for(const value of ['\ud800','\udc00'])assert.throws(()=>normalizeTokenDraft420({...draftFor(),name:value}),/Unicode/);
});
test('decoder rejects malformed offsets, lengths, padding, trailing bytes and invalid UTF8',()=>{
  const c=encodeTokenCreation420(draftFor()),d=c.data;
  const invalid=[
    '0xdeadbeef'+d.slice(10),d.slice(0,-2),d+'00'.repeat(32),
    editWord(d,0,TOKEN_TEMPLATES_420[6].id.slice(2)),editWord(d,1,'0'),editWord(d,1,'c1'),
    editWord(d,1,'f'.repeat(64)),editWord(d,1,'1000000'),editWord(d,2,'c0'),
    editWord(d,6,'f'.repeat(64)),editByte(d,4+7*32,'ff'),
    editByte(d,4+8*32-1,'01'),editWord(d,4,'01'),
  ];
  for(const data of invalid)assert.throws(()=>decodeTokenCreation420(data),undefined,data.slice(0,75));
  const n=encodeTokenCreation420({template:'ERC721_COLLECTION',name:'A',symbol:'B',baseURI:'C',userSalt:digest(1)}).data;
  const m=encodeTokenCreation420({template:'ERC1155_MULTI',uri:'X',userSalt:digest(1)}).data;
  for(const data of [editWord(n,1,'80'),editWord(m,0,'60'),n+'00'.repeat(32),m+'00'.repeat(32)])
    assert.throws(()=>decodeTokenCreation420(data));
});
test('configuration hash is not template or salt identity: complete commitments bind exact calldata',()=>{
  const d=draftFor(),c=encodeTokenCreation420(d);
  for(const changed of [{...d,template:'ERC20_MINTABLE'},{...d,userSalt:digest(9)}]){
    const x=encodeTokenCreation420(changed);
    assert.equal(x.configHash,c.configHash);assert.notEqual(x.calldataHash,c.calldataHash);
    assert.throws(()=>validateTokenCreationEncoding420(changed,commitments(c)),/canonical draft/);
  }
  for(const key of Object.keys(commitments(c))){
    const missing=commitments(c);delete missing[key];assert.throws(()=>validateTokenCreationEncoding420(d,missing));
    assert.throws(()=>validateTokenCreationEncoding420(d,{...commitments(c),[key]:null}));
  }
});
test('handoff rejects omitted/tampered commitments, extra fields and accessors before any RPC',async()=>{
  const {binding}=fixture(),r=buildTokenDeploymentRequest420(binding,draftFor());
  let calls=0,access=0;
  const provider={request:async()=>{calls++;throw Error('unexpected RPC');}};
  const bad=[{...r,templateId:null},{...r,configHash:null},{...r,calldataHash:null},
    {...r,templateId:digest(42)},{...r,calldataHash:digest(42)},{...r,owner:addr(1)},
    {...r,value:r.value.toString()+'\n'},Object.create(r)];
  for(const key of ['templateId','configHash','calldataHash']){
    const missing={...r};delete missing[key];bad.push(missing);
  }
  const getter={...r};Object.defineProperty(getter,'data',{enumerable:true,get(){access++;return r.data;}});bad.push(getter);
  for(const invalid of bad)await assert.rejects(prepareTokenDeploymentHandoff420(provider,controller,state,binding,invalid));
  assert.equal(calls,0);assert.equal(access,0);
});
