import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
// Temporary qualification dependency, not a production database replacement.
// npm install --prefix /tmp/bridge-audit-sql @electric-sql/pglite@0.3.14
const {PGlite}=await import(process.env.PGLITE_MODULE??'/tmp/bridge-audit-sql/node_modules/@electric-sql/pglite/dist/index.js');
const root=new URL('../../',import.meta.url),db=new PGlite();
for(const file of ['003-genesis-projections.sql','005-genesis-state-views.sql','008-bridge-lifecycle.sql'])await db.exec(await readFile(new URL('420-indexer/sql/'+file,root),'utf8'));
async function event(block,index,name,fields){await db.query('insert into idx_protocol_events values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[420,block,'0x'+block,'tx'+block,0,index,'0xregistry','420Bridge',name,JSON.stringify(fields)]);}
await event(1,0,'TransferCreated',{transferId:'0xAA',routeId:'shared',assetId:'asset',amount:'100'});
await event(1,1,'TransferCreated',{transferId:'0xBB',routeId:'shared',assetId:'asset',amount:'100'});
await event(2,0,'TransferStatus',{transferId:'0xAA',status:'6'});
await event(3,0,'TransferTransition',{transferId:'0xAA',fromStatus:'6',toStatus:'7',evidenceHash:'qualified'});
await event(3,1,'SourceTransactionBound',{transferId:'0xAA',sourceTxId:'tx',evidenceHash:'evidence'});
let states=(await db.query('select object_key,lifecycle_state from idx_bridge_state order by object_key')).rows;
assert.deepEqual(states,[{object_key:'transferId:0xaa',lifecycle_state:'COMPLETED'},{object_key:'transferId:0xbb',lifecycle_state:'CREATED'}]);
assert.equal((await db.query("select * from idx_protocol_object_events where object_key='transferId:0xaa'")).rows.length,4);
await db.exec('delete from idx_protocol_events where block_number > 2');
assert.equal((await db.query("select lifecycle_state from idx_bridge_state where object_key='transferId:0xaa'")).rows[0].lifecycle_state,'DESTINATION_PENDING');
await event(3,0,'TransferStatus',{transferId:'0xAA',status:'8'});
assert.equal((await db.query("select lifecycle_state from idx_bridge_state where object_key='transferId:0xaa'")).rows[0].lifecycle_state,'FAILED');
await event(4,0,'TransferStatus',{transferId:'0xAA',status:'9'});
await event(5,0,'TransferStatus',{transferId:'0xAA',status:'13'});
assert.equal((await db.query("select lifecycle_state from idx_bridge_state where object_key='transferId:0xaa'")).rows[0].lifecycle_state,'REFUNDED');
await db.close();console.log('PASS: real PostgreSQL engine, fresh-install and upgrade SQL; distinct transfer history, non-state-event preservation, reorg rollback/replay, failure/retry/refund mapping');
