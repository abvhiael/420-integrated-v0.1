import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createPublicClient,http} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {recoverSignedSocialEnvelope} from '../src/canonical-social-chain-adapter.js';
import {SocialRecoveryWorker} from '../src/social-recovery-worker.js';
import {keccak256} from '../src/keccak.js';
const rpcUrl=process.env.HC_SOC5D_ANVIL_URL,dbUrl=process.env.HC_SOC5D_TEST_DATABASE_URL;
if(!rpcUrl||!dbUrl)throw Error('local EVM and PostgreSQL required');
const account=privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),to='0x'+'2'.repeat(40);
const client=createPublicClient({transport:http(rpcUrl)});
const pool=new pg.Pool({connectionString:dbUrl,max:4});
test('genuine Anvil signed transaction survives restart; evm_revert quarantines history',async()=>{
 const nonce=await client.getTransactionCount({address:account.address});
 const snapshot=await client.request({method:'evm_snapshot'});
 const raw=await account.signTransaction({chainId:420,to,nonce,gas:21000n,maxFeePerGas:3000000000n,maxPriorityFeePerGas:1000000000n,value:0n,type:'eip1559'});
 const hash=keccak256(Buffer.from(raw.slice(2),'hex')).toLowerCase();
 await pool.query("INSERT INTO highcountry_social_intents(scope,tx_hash,principal,wallet,action,raw_transaction,state) VALUES('hc5d',$1,'alice',$2,'organization.join',$3,'prepared')",[hash,account.address.toLowerCase(),raw]);
 let broadcasts=0;
 const rpc={request:async(method,params)=>{if(method==='eth_sendRawTransaction')broadcasts++;return client.request({method,params});}};
 const chain={rpc,
  recoveryPayload:async()=>({signedRawTransaction:raw}),
  prepareSigned:async({wallet,payload})=>{
   const signed=await recoverSignedSocialEnvelope(payload.signedRawTransaction);
   assert.equal(signed.from.toLowerCase(),wallet);assert.equal(signed.to.toLowerCase(),to);
   return {hash:keccak256(Buffer.from(payload.signedRawTransaction.slice(2),'hex')).toLowerCase()};
  },
  finalizedReceipt:async({hash:tx})=>{
   const r=await rpc.request('eth_getTransactionReceipt',[tx]);return r?{hash:tx,signer:account.address.toLowerCase(),action:'organization.join',blockHash:r.blockHash,blockNumber:r.blockNumber,finalized:true,success:r.status==='0x1',isFundTransfer:false}:null;
  },
  verifyFinality:async(r)=>{const b=await rpc.request('eth_getBlockByNumber',[r.blockNumber,false]);return b?.hash===r.blockHash;},
  indexFinalized:async()=>{}
 };
 const worker=()=>new SocialRecoveryWorker({pool,chain,scope:'hc5d'});
 const first=await worker().reconcileOne(hash);
 assert.ok(first==='broadcast'||first==='finalized','first reconciliation must be broadcast or genuinely finalized');
 // A submitted transaction is not final until Anvil actually mines it.
 // Wait for the genuine receipt; never mock finality or relax block-hash checks.
 const mined=await client.waitForTransactionReceipt({hash,timeout:15000});
 assert.equal(mined.status,'success');
 assert.equal(await worker().reconcileOne(hash),'finalized');
 assert.equal(await worker().reconcileOne(hash),'finalized');
 assert.equal(broadcasts,1);
 assert.equal(await client.request({method:'evm_revert',params:[snapshot]}),true);
 assert.equal(await worker().reconcileOne(hash),'orphaned');
 assert.equal(broadcasts,1);
 assert.equal((await pool.query("SELECT state FROM highcountry_social_intents WHERE scope='hc5d' AND tx_hash=$1",[hash])).rows[0].state,'orphaned');
});
test.after(async()=>pool.end());
