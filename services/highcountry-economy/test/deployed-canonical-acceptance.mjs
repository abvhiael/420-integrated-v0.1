// Manual-only, read-only deployed testnet acceptance. No Anvil fallback; never includes credentials.
// Requires independently approved funded escrow transaction, finalized operator receipt,
// indexer observation and post-restart SQL settlement before reporting PASS.
import assert from 'node:assert/strict';
import pg from 'pg';
import {FinalizedRpc,calldata,address} from '../src/finalized-rpc.js';
import {CanonicalRpcEscrowClient} from '../src/settlement-runtime.js';
import {CanonicalEscrowReader} from '../src/canonical-escrow-reader.js';
import {CanonicalHttpIndexer} from '../src/canonical-http-indexer.js';
import {CanonicalIndexerReconciler} from '../src/canonical-indexer-reconciler.js';
import {keccak256} from '../src/keccak.js';
const configText=process.env.HC_DEPLOYED_CANONICAL_ACCEPTANCE;
if(!configText)throw Error('DEPLOYED CHAIN ACCEPTANCE NOT RUN: explicit deployment evidence configuration required');
const c=JSON.parse(configText);
if(c.environment!=='authorized-deployed-testnet'||c.operatorApproval!==true)
 throw Error('independent testnet operator authorization required');
for(const field of ['rpcUrl','chainId','contracts','issuer','listingId','transferOp','sellerWallet',
 'buyerWallet','buyerPrincipal','sellerPrincipal','asset','quantity','txHash','indexerUrl','postgresUrl','namespace','fromBlock','expectedBurned'])
 if(c[field]===undefined||c[field]===null||c[field]==='')
  throw Error('missing deployed acceptance evidence: '+field);
assert.ok(Number.isSafeInteger(c.quantity)&&c.quantity>0,'safe canonical quantity required');
assert.ok(Number.isSafeInteger(c.expectedBurned)&&c.expectedBurned>=0,'pinned burn policy required');
for(const u of [c.rpcUrl,c.indexerUrl,c.postgresUrl]){
 const p=new URL(u);
 if(['127.0.0.1','localhost','[::1]'].includes(p.hostname))throw Error('local fixtures are not deployed-chain evidence');
}
if(!c.rpcUrl.startsWith('https://')||!c.indexerUrl.startsWith('https://'))
 throw Error('pinned HTTPS deployed-chain endpoints required');
const canon=x=>x.toLowerCase();
const rpc=new FinalizedRpc({url:c.rpcUrl,chainId:c.chainId,contracts:c.contracts});
const reader=new CanonicalEscrowReader({client:new CanonicalRpcEscrowClient(rpc),
 escrow:address(c.contracts.escrow.address),chainId:c.chainId,issuer:address(c.issuer),
 fromBlock:BigInt(c.fromBlock)});
const expected=await reader.expectedTransferOperation(c.listingId,address(c.buyerWallet));
assert.equal(canon(expected),canon(c.transferOp),'deterministic transfer operation');
const receipt=await reader.confirmedReservedTransfer(c.transferOp,1);
assert.ok(receipt,'independently finalized receipt required');
assert.equal(canon(receipt.sourceReceiptId),canon(c.listingId));
assert.equal(canon(receipt.from),canon(c.sellerWallet));
assert.equal(canon(receipt.to),canon(c.buyerWallet));
assert.equal(canon(receipt.asset),canon(c.asset));
assert.equal(receipt.quantity,c.quantity);
const tx=await rpc.request('eth_getTransactionReceipt',[c.txHash]);
assert.ok(tx&&tx.status==='0x1','successful deployed operator transaction required');
assert.equal(canon(address(tx.to)),canon(address(c.contracts.escrow.address)));
const head=await rpc.header();
assert.ok(BigInt(tx.blockNumber)<=BigInt(head.number),'transaction must reach finalized height');
const block=await rpc.request('eth_getBlockByNumber',[tx.blockNumber,false]);
assert.equal(canon(block.hash),canon(tx.blockHash),'finalized transaction block');
const settledTopic=keccak256(Buffer.from('EscrowSettled(bytes32,bytes32,address)'));
assert.ok(tx.logs.some(l=>canon(l.address)===canon(c.contracts.escrow.address)
 &&canon(l.topics?.[0]||'')===canon(settledTopic)
 &&canon(l.topics?.[1]||'')===canon(c.listingId)
 &&canon(l.topics?.[2]||'')===canon(c.transferOp)
 &&canon(l.topics?.[3]||'').endsWith(canon(c.buyerWallet).slice(2))),
 'exact successful escrow settlement log required');
const indexer=new CanonicalHttpIndexer({baseUrl:c.indexerUrl,chainId:c.chainId,
 escrow:c.contracts.escrow.address,token:process.env.HC_DEPLOYED_INDEXER_TOKEN});
const pool=new pg.Pool({connectionString:c.postgresUrl,ssl:{rejectUnauthorized:true}});
try {
 const rows=await pool.query('SELECT state FROM highcountry_buds_state WHERE namespace=$1',[c.namespace]);
 assert.equal(rows.rows.length,1,'durable canonical namespace required');
 const state=rows.rows[0].state;
 const intents=new Map(state.transferIntents),listings=new Map(state.listings);
 const t=intents.get(c.transferOp),l=listings.get(c.listingId);
 assert.ok(t&&l&&t.status==='finalized'&&l.status==='sold','post-restart canonical settlement required');
 assert.equal(t.sourceReceiptId,c.listingId);
 assert.equal(t.quantity,c.quantity);
 assert.equal(t.buyer,c.buyerPrincipal);
 assert.equal(t.seller,c.sellerPrincipal);
 const total=new Map(state.balances);
 const sum=[...total.values()].reduce((n,b)=>n+b.available+b.reserved,0);
 assert.equal(sum,state.issued-state.burned,'durable BUDS conservation required');
 assert.equal(state.burned,c.expectedBurned,'unexpected canonical burn or marketplace fee');
 const mirrorStore={transact:async fn=>fn({transferIntents:intents,listings})};
 const recon=new CanonicalIndexerReconciler({store:mirrorStore,reader,indexer});
 assert.equal((await recon.transfer(c.transferOp)).status,'finalized');
 assert.equal((await recon.listing(c.listingId)).status,'sold');
 console.log(JSON.stringify({status:'DEPLOYED_CHAIN_ACCEPTANCE_PASS',chainId:c.chainId,
  listingId:c.listingId,transferOp:c.transferOp,txHash:c.txHash,finalizedBlock:head.number,
  namespace:c.namespace,issued:state.issued,burned:state.burned,indexerReconciled:true}));
}finally{await pool.end();}
