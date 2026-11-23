// Signed civic lifecycle actions for the isolated GOV-PRE-08 execution ledger.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const requireIndexer=createRequire(new URL('../../420-indexer/package.json',import.meta.url));
const {Interface,Wallet,keccak256,toUtf8Bytes}=requireIndexer('ethers');
const [rpcUrl,graphPath,proposalPath,stage]=process.argv.slice(2);
assert.match(rpcUrl,/^http:\/\/127\.0\.0\.1:\d+$/);
const graph=JSON.parse(await fs.readFile(graphPath,'utf8'));
const proposal=JSON.parse(await fs.readFile(proposalPath,'utf8'));
assert.equal(graph.approvedV4,false);
assert.equal(graph.chainId,31337);
assert.equal(proposal.localOnly,true);
const wallet=new Wallet('0x'+'00'.repeat(31)+'01');
assert.equal(wallet.address.toLowerCase(),graph.localBrowserSigner.toLowerCase());

let requestId=0;
async function rpc(method,params=[]){
  const id=++requestId;
  const response=await fetch(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id,method,params})});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.id,id);
  if(result.error)throw new Error(method+': '+result.error.message);
  return result.result;
}
assert.equal(await rpc('eth_chainId'),'0x1a4');
const civic=graph.walletCivicModuleAddresses;
const timelock='0x0000000000000000000000000000000000000429';
const policy=graph.actualProductionConstructorAddresses.TreasuryPolicyRegistry420;
const asset='0x000000000000000000000000000000000000d00d';
const empty='0x'+'00'.repeat(32);
const cancelled=keccak256(toUtf8Bytes('GOV-PRE-08/native/local/bootstrap-cancellation'));
const actions=proposal.actions;
assert.equal(actions.length,10);
const release=graph.localCivicReleaseExecutor;
assert.equal(keccak256(await rpc('eth_getCode',[release.address,'latest'])),release.runtimeHash);
assert.equal(actions[0][0].toLowerCase(),policy.toLowerCase());

const abi=new Interface([
  'event CivicProposalCreated(bytes32 indexed proposalId,address indexed proposer,uint8 indexed class_,bytes32 metadataHash,bytes32 actionsHash,uint64 snapshotBlock,uint64 voteStart,uint64 voteEnd,uint32 constitutionRevision)',
  'function preview(bytes32) view returns(bytes,bytes32)',
  'function execute(bytes32,bytes32)',
  'function register(bytes32,bytes,address,bytes32)',
  'function isFullyProtocolSponsoredOwner(address) view returns(bool)',
  'function createProposal(uint8,bytes32,bytes32)',
  'function castVote(bytes32,uint8,uint8,bytes)',
  'function ballot(bytes32,uint8,address) view returns(uint8,uint256,bool)',
  'function finalize(bytes32) returns(bool)',
  'function queue(bytes32,(address to,uint256 value,bytes data)[])',
  'function executeQueuedBatch(bytes32,(address to,uint256 value,bytes data)[]) payable',
  'function bootstrapGovernor() view returns(address)',
  'function civicAuthorityActivated() view returns(bool)',
  'function scheduler() view returns(address)',
  'function activateCivicAuthority(address)',
  'function schedule(bytes32,address,uint256,bytes,uint8)',
  'function cancel(bytes32)',
  'function execute(bytes32)',
  'function operations(bytes32) view returns(address,uint256,bytes,uint64,uint8,bool,bool)',
  'function assetPolicy(address) view returns(bool,uint128,uint128,uint64,uint32)',
  'function setAssetPolicy(address,bool,uint128,uint128,uint64)',
  'function proposals(bytes32) view returns(address,uint8,bytes32,bytes32,uint64,uint64,uint64,uint8,bool)',
]);
const receipt=await rpc('eth_getTransactionReceipt',[proposal.proposalTxHash]);
assert.equal(receipt.status,'0x1');
assert.equal(receipt.to.toLowerCase(),civic.governor.toLowerCase());
const [creation]=receipt.logs.filter(log=>log.address.toLowerCase()===civic.governor.toLowerCase())
  .map(log=>abi.parseLog(log)).filter(log=>log?.name==='CivicProposalCreated');
const {proposalId,voteEnd}=creation.args;

function transaction(to,name,args,from=wallet.address){
  return {to,from,data:abi.encodeFunctionData(name,args)};
}
async function read(to,name,args=[]){
  const result=await rpc('eth_call',[transaction(to,name,args),'latest']);
  return abi.decodeFunctionResult(name,result);
}
async function rejects(to,name,args,from){
  await assert.rejects(rpc('eth_call',[transaction(to,name,args,from),'latest']),/execution reverted/i);
}
async function send(to,name,args){
  const tx=transaction(to,name,args);
  const nonce=await rpc('eth_getTransactionCount',[wallet.address,'pending']);
  const raw=await wallet.signTransaction({chainId:420,type:2,to,data:tx.data,nonce,
    gasLimit:3_000_000n,maxPriorityFeePerGas:1_000_000_000n,maxFeePerGas:2_000_000_000n});
  const hash=await rpc('eth_sendRawTransaction',[raw]);
  assert.equal(hash,keccak256(raw));
  return hash;
}

const hashes=[];
let executeAfter;
let payoutCommitment;
switch(stage){
case 'validator-ballot':
  assert.equal((await read(timelock,'bootstrapGovernor'))[0].toLowerCase(),wallet.address.toLowerCase());
  assert.equal((await read(timelock,'civicAuthorityActivated'))[0],false);
  await rejects(civic.governor,'createProposal',[0,empty,empty]);
  await rejects(civic.governor,'finalize',[proposalId]);
  await rejects(civic.voting,'castVote',[proposalId,0,1,'0x']);
  await rejects(civic.voting,'castVote',[proposalId,1,1,'0x'],graph.localBrowserChangedAccount);
  await rejects(timelock,'activateCivicAuthority',[civic.governor],graph.localBrowserChangedAccount);
  await rejects(civic.governor,'executeQueuedBatch',[proposalId,actions]);
  const [, ,data]=actions[0];
  await rejects(policy,'setAssetPolicy',abi.decodeFunctionData('setAssetPolicy',data));
  hashes.push(await send(civic.voting,'castVote',[proposalId,1,1,'0x']));
  hashes.push(await send(timelock,'schedule',[cancelled,policy,0,data,0]));
  break;
case 'cancel':
  assert.deepEqual(Array.from(await read(civic.voting,'ballot',[proposalId,1,wallet.address])),[1n,1n,true]);
  hashes.push(await send(timelock,'cancel',[cancelled]));
  break;
case 'activate':
  await rejects(timelock,'execute(bytes32)',[cancelled]);
  hashes.push(await send(timelock,'activateCivicAuthority',[civic.governor]));
  break;
case 'finalize':
  assert.equal(BigInt(await rpc('eth_blockNumber')),voteEnd);
  assert.equal((await read(timelock,'scheduler'))[0].toLowerCase(),civic.governor.toLowerCase());
  await rejects(civic.governor,'finalize',[proposalId]);
  await rejects(timelock,'cancel',[cancelled]);
  hashes.push(await send(civic.governor,'finalize',[proposalId]));
  break;
case 'queue':
  assert.equal((await read(civic.proposalRegistry,'proposals',[proposalId]))[7],2n);
  await rejects(civic.voting,'castVote',[proposalId,1,1,'0x']);
  await rejects(civic.governor,'queue',[proposalId,[[policy,1,actions[0][2]]]]);
  hashes.push(await send(civic.governor,'queue',[proposalId,actions]));
  break;
case 'delay':
  assert.equal((await read(civic.proposalRegistry,'proposals',[proposalId]))[7],4n);
  assert.equal((await read(policy,'assetPolicy',[asset]))[4],0n);
  await rejects(timelock,'execute(bytes32)',[proposalId]);
  await rejects(civic.governor,'queue',[proposalId,actions]);
  executeAfter=Number((await read(timelock,'operations',[proposalId]))[3]);
  hashes.push(await send(timelock,'execute(bytes32)',[proposalId]));
  break;
case 'verify-delay':
  assert.equal((await read(civic.proposalRegistry,'proposals',[proposalId]))[7],4n);
  assert.equal((await read(policy,'assetPolicy',[asset]))[4],0n);
  assert.equal((await read(timelock,'operations',[proposalId]))[5],false);
  assert.equal((await read(timelock,'operations',[cancelled]))[6],true);
  await rejects(civic.governor,'finalize',[proposalId]);
  break;
case 'execute':
  hashes.push(await send(timelock,'execute(bytes32)',[proposalId]));
  break;
case 'verify-execution': {
  const [, ,data]=actions[0];
  const [targetAsset,allowed,maxSingle,maxEpoch,epochSeconds]=abi.decodeFunctionData('setAssetPolicy',data);
  assert.equal(targetAsset.toLowerCase(),asset.toLowerCase());
  assert.deepEqual(Array.from(await read(policy,'assetPolicy',[asset])),[allowed,maxSingle,maxEpoch,epochSeconds,1n]);
  assert.equal((await read(timelock,'operations',[proposalId]))[5],true);
  assert.equal((await read(civic.proposalRegistry,'proposals',[proposalId]))[7],5n);
  await rejects(timelock,'execute(bytes32)',[proposalId]);
  break;
}
case 'pay-treasury': {
  const [,commitment]=await read(release.address,'preview',[proposal.payoutId]);
  await rejects(release.address,'execute(bytes32,bytes32)',[proposal.payoutId,commitment],proposal.recipient);
  await rejects(release.address,'execute(bytes32,bytes32)',[proposal.payoutId,empty]);
  payoutCommitment=commitment;
  hashes.push(await send(release.address,'execute(bytes32,bytes32)',[proposal.payoutId,commitment]));
  break;
}
case 'verify-payout':
  assert.match(process.env.GOVPRE08_PAYOUT_COMMITMENT,/^0x[0-9a-f]{64}$/);
  await rejects(release.address,'execute(bytes32,bytes32)',[proposal.payoutId,process.env.GOVPRE08_PAYOUT_COMMITMENT]);
  break;
case 'register-sponsor': {
  const validator='0x0000000000000000000000000000000000000423';
  const id=keccak256(toUtf8Bytes('GOV-PRE-08 sponsored validator'));
  const pubkey=process.env.GOVPRE08_SPONSOR_PUBKEY;
  assert.match(pubkey,/^0x[0-9a-f]{96}$/);
  hashes.push(await send(validator,'register',[id,pubkey,wallet.address,id]));
  break;
}
case 'verify-sponsor':
  assert.equal((await read('0x0000000000000000000000000000000000000423',
    'isFullyProtocolSponsoredOwner',[wallet.address]))[0],true);
  break;
default:
  throw new Error('Unknown Civic qualification stage');
}
console.log(JSON.stringify({proposalId,hashes,executeAfter,payoutCommitment}));
