import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {CreatorQueue,verifyCreatorSignature} from '../core/creator-queue.mjs';
import {wordAddress} from '../core/abi.mjs';
const WHO='0x000000000000000000000000000000000000c111',OTHER='0x000000000000000000000000000000000000c222',
  ID='0x'+'99'.repeat(32);
const sig='0x'+'0'.repeat(63)+'1'+'0'.repeat(63)+'1'+'1b';
function eoaRpc(){return {
  async call(name){if(name==='web3_sha3')return ID;if(name==='eth_getCode')return '0x';throw Error('unexpected '+name);},
  async ethCall(to){if(to==='0x'+'0'.repeat(39)+'1')return '0x'+wordAddress(WHO);throw Error('unexpected precompile');}
};}
const request={schema:'420-launchpad-creator-preparation-v1',canonical:true,requiresGovernance:true,
  requestId:ID,source:{chainId:'0x1a4'},projectId:ID,saleId:ID,
  metadataHash:ID,metadataJson:'{"schema":"sample"}',
  governanceRequest:{requester:WHO,kind:'CREATE_CAMPAIGN',calls:[]}};
test('signed creator request is durable, idempotency protected and never claims governance approval',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'launchpad-creator-'));
  try{
    const file=path.join(dir,'requests.jsonl'),q=new CreatorQueue(file);
    assert.deepEqual(q.list(WHO),[]);
    const receipt=await q.submit(eoaRpc(),request,sig);
    assert.equal(receipt.canonical,true);assert.equal(receipt.status,'RECEIVED_FOR_GOVERNANCE_REVIEW');
    assert.equal(receipt.signatureKind,'EIP191');
    assert.equal(q.list(WHO).length,1);
    assert.equal(q.list(OTHER).length,0);
    assert.equal(q.list(WHO)[0].status,'RECEIVED_FOR_GOVERNANCE_REVIEW');
    assert.equal(q.list(WHO)[0].metadataJson,undefined);
    const raw=fs.readFileSync(file,'utf8');assert.match(raw,/metadataHash/);
    await assert.rejects(()=>q.submit(eoaRpc(),request,sig),/already submitted/);
    assert.equal(q.list(WHO).length,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('unsigned, wrong-account, malleable or noncanonical signature cannot submit',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'launchpad-creator-'));
  try{
    const q=new CreatorQueue(path.join(dir,'requests.jsonl'));
    await assert.rejects(()=>q.submit(eoaRpc(),request,'0x1234'),/invalid Wallet signature/);
    const wrong={...request,governanceRequest:{...request.governanceRequest,requester:OTHER}};
    await assert.rejects(()=>q.submit(eoaRpc(),wrong,sig),/signature not verified/);
    await assert.rejects(()=>q.submit(eoaRpc(),request,'0x'+'00'.repeat(65)),/noncanonical Wallet signature/);
    assert.equal(q.list(WHO).length,0);
    await assert.rejects(()=>new CreatorQueue(null).submit(eoaRpc(),request,sig),/queue is not configured/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('smart Wallet EIP-1271 supports contract-bound arbitrary-length signatures with exact magic',async()=>{
  const rpc={async call(method){if(method==='web3_sha3')return ID;if(method==='eth_getCode')return '0x6001';throw Error(method);},
    async selector(name){assert.equal(name,'isValidSignature(bytes32,bytes)');return '0x1626ba7e';},
    async ethCall(to,data){assert.equal(to,WHO);assert.match(data,/^0x1626ba7e/);return '0x1626ba7e'+'0'.repeat(56);}};
  const proof=await verifyCreatorSignature(rpc,ID,WHO,'0x'+'ab'.repeat(96));
  assert.equal(proof.kind,'EIP1271');
  rpc.ethCall=async()=> '0x00000000'+'0'.repeat(56);
  await assert.rejects(()=>verifyCreatorSignature(rpc,ID,WHO,'0x'+'ab'.repeat(96)),/not verified/);
});
