// SOC-5C genuine signed local EVM transaction and canonical emitted log smoke.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicClient,createWalletClient,http,parseAbi,encodeFunctionData} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import solc from 'solc';
import {CanonicalSocialEventIndexer} from '../src/canonical-social-event-indexer.js';
import {keccak256} from '../src/keccak.js';
const URL=process.env.HC_SOC5C_ANVIL_URL;
if(!URL)throw Error('local Anvil URL required');
const source='// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24; contract SOC5CEmitter {event OrganizationCreated(bytes32 indexed id,address indexed administrator,bytes32 metadataHash); function create(bytes32 id, bytes32 metadataHash) external { emit OrganizationCreated(id,msg.sender,metadataHash); }}';
const compilerInput={language:'Solidity',sources:{'SOC5CEmitter.sol':{content:source}},settings:{outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(compilerInput)));
if(output.errors?.some(x=>x.severity==='error'))throw Error(JSON.stringify(output.errors));
const artifact=output.contracts['SOC5CEmitter.sol'].SOC5CEmitter;
const account=privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const client=createPublicClient({transport:http(URL)}),wallet=createWalletClient({account,transport:http(URL)});
test('Anvil signed EIP-1559 create produces verifiable canonical event',async()=>{
 const deploy=await wallet.deployContract({abi:artifact.abi,bytecode:'0x'+artifact.evm.bytecode.object});
 const deployed=await client.waitForTransactionReceipt({hash:deploy});
 assert.equal(deployed.status,'success');
 const id='0x'+'a'.repeat(64),metadata='0x'+'b'.repeat(64);
 const hash=await wallet.writeContract({address:deployed.contractAddress,abi:artifact.abi,functionName:'create',args:[id,metadata]});
 const receipt=await client.waitForTransactionReceipt({hash});
 assert.equal(receipt.status,'success');assert.equal(receipt.logs.length,1);
 const log=receipt.logs[0];
 assert.equal(log.address.toLowerCase(),deployed.contractAddress.toLowerCase());
 assert.equal(log.topics[1],id);
 const journal={principal:'alice',wallet:account.address.toLowerCase(),action:'organization.create',state:'finalized'};
 let indexed=0, commits=0;
 const pool={connect:async()=>({query:async(sql)=>{
  if(sql.startsWith('SELECT principal'))return {rows:[journal]};
  if(sql.startsWith('INSERT INTO highcountry_social_events')){indexed++;return {rowCount:1};}
  if(sql==='COMMIT')commits++;
  return {rowCount:1};
 },release(){}})};
 const rpc={request:async(method,params)=>{
  if(method==='eth_getTransactionReceipt')return await client.request({method,params});
  if(method==='eth_getTransactionByHash')return await client.request({method,params});
  if(method==='eth_getBlockByNumber')return await client.request({method,params});
  throw Error('unexpected RPC '+method);
 },header:async()=>{const b=await client.getBlock({blockTag:'latest'});return {number:'0x'+b.number.toString(16),hash:b.hash};}};
 const indexer=new CanonicalSocialEventIndexer({pool,rpc,contracts:{organizations:deployed.contractAddress},scope:'HC'});
 assert.equal(await indexer.indexFinalized({txHash:hash.toLowerCase(),principal:'alice',wallet:account.address,action:'organization.create'}),1);
 assert.equal(indexed,1);assert.equal(commits,1);
});
