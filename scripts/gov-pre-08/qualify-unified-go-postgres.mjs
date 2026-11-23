#!/usr/bin/env node
// Inspect REAL durable PostgreSQL16 canonical Go Indexer state. The production
// Go Explorer consumes this Go Indexer's HTTP API; both must reflect the same
// BLS-certified 420 blocks as the separate production TypeScript SQL worker.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const requireIndexer=createRequire(path.join(root,'420-indexer/package.json'));
const {Pool}=requireIndexer('pg');
const args=process.argv.slice(2);
function opt(k){const i=args.indexOf('--'+k);if(i<0||!args[i+1])throw Error(k+' required');return args[i+1];}
function need(v,m){if(!v)throw Error('GOV-PRE-08 Go PostgreSQL: '+m);}
const expected=opt('expected-block-hash').toLowerCase();
const txhash=opt('expected-tx-hash').toLowerCase();
need(/^0x[0-9a-f]{64}$/.test(expected) && /^0x[0-9a-f]{64}$/.test(txhash),
     'missing canonical block or locally signed EOA hash');
const dsn=process.env.INDEXER_PG_URL;
need(/^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:5432\/[a-z0-9_]+$/i.test(dsn||''),
     'PG16 must be isolated loopback');
const pool=new Pool({connectionString:dsn,ssl:false});
try{
  const result=await pool.query(
    'select mutation_version,snapshot from idx_go_canonical_state_v1 where singleton=1');
  need(result.rows.length===1,'missing real Go Indexer PostgreSQL snapshot');
  const row=result.rows[0];
  const data=typeof row.snapshot==='string'?JSON.parse(row.snapshot):row.snapshot;
  need(data.version===1 && data.checkpoint?.chainId===420 &&
       data.checkpoint.indexedHeight===2 &&
       data.checkpoint.indexedHash?.toLowerCase()===expected,
       'BLS-certified canonical block lost or wrong network in PostgreSQL');
  const blocks=data.blocks;
  need(Object.keys(blocks).length===3 &&
       blocks['2']?.hash.toLowerCase()===expected &&
       blocks['2']?.producer?.certified===true &&
       /^0x[0-9a-f]{64}$/i.test(blocks['2'].producer.consensusBlockRoot),
       'real BLS producer lineage missing from canonical PG state');
  const transactions=data.transactions||{},receipts=data.receipts||{};
  need(Object.keys(transactions).length===1 && Object.keys(receipts).length===1 &&
       transactions[txhash]?.hash.toLowerCase()===txhash &&
       transactions[txhash]?.blockHash.toLowerCase()===expected &&
       receipts[txhash]?.transactionHash.toLowerCase()===txhash &&
       receipts[txhash]?.blockHash.toLowerCase()===expected &&
       receipts[txhash]?.status===1,
       'actual signed Wallet transaction/receipt missing from PostgreSQL-backed Go Indexer');
  const native=Object.values(data.logs||{}).filter(x=>x.decoderVersion==='native-systemcall-v1');
  const zero='0x'+'00'.repeat(32);
  need(native.length>=10 && native.every(x=>x.chainId===420 &&
       x.transactionHash.toLowerCase()===zero &&
       (x.blockHash.toLowerCase()===blocks['1'].hash.toLowerCase() ||
        x.blockHash.toLowerCase()===expected)),
       'native system-call logs incorrectly attributed to ordinary EOA receipts');
  const report={
    schema:'GOV_PRE_08_CERTIFIED_GO_INDEXER_POSTGRES_CANONICAL_STORE_V1',
    chainId:420,canonicalBlockHash:expected,localSignedWalletTx:txhash,
    realGoIndexerPostgresDurable:true,realNativeBLSEngineLogsInPostgres:true,
    canonicalProducerBlock2:true,realWalletReceiptDurable:true,
    authenticNativeLogCount:native.length,mutations:String(row.mutation_version),
    testnetOrV4Authorized:false
  };
  await fs.writeFile(opt('output'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log('GOV_PRE_08_GO_INDEXER_EXPLORER_NATIVE_BLS_POSTGRES_CANONICAL=PASS',native.length,expected);
}finally{await pool.end();}
