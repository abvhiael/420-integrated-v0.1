import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PostgresSql420 } from '../src/postgres.js';
import { TOKEN_EVENTS_420 as E,TOKEN_TEMPLATES_420 as T,parseTokenBinding420,tokenDeploymentState420 } from '../src/token-read-model.js';
import { IndexerPublicApiAdapter420 } from '../src/api-surface.js';
import { IndexerQueryService420 } from '../src/query-service.js';
import { routeIndexerHttp420 } from '../src/http-transport.js';
const w=(n:number)=>n.toString(16).padStart(64,'0'),h=(n:number)=>'0x'+w(n),a=(n:number)=>'0x'+n.toString(16).padStart(40,'0'),aw=(v:string)=>'0x'+v.slice(2).padStart(64,'0');
const b=parseTokenBinding420(JSON.stringify({chainId:31337,genesisHash:h(1),factory:a(10),vault:a(11),accounting:a(12),factoryCodeHash:h(21),metadataHash:h(22),manifestHash:h(23),dependencyRoot:h(24),interfaceHash:h(25)}));
test('Token binding rejects incomplete, aliased and reserved addresses',()=>{
 for(const x of [{...b,factory:b.vault},{...b,factory:a(0x455)},{...b,chainId:0},{...b,extra:1}])assert.throws(()=>parseTokenBinding420(JSON.stringify(x)));
});
test('Token SQL projection and HTTP route: exact eight templates, missing/forged evidence, failed receipts, rollback',async()=>{
 const connectionString=process.env.INDEXER_PG_URL;assert.ok(connectionString,'qualification requires PostgreSQL');
 const admin=new PostgresSql420({connectionString});
 const schema='token_audit_6_'+process.pid;
 await admin.query('CREATE SCHEMA '+schema);
 const db=new PostgresSql420({connectionString,options:'-c search_path='+schema});
 try{
  await db.query(await readFile(new URL('../sql/001-core-projections.sql',import.meta.url),'utf8'));
  const block=async(n:number)=>db.query('INSERT INTO idx_blocks(chain_id,block_number,block_hash,parent_hash,block_timestamp) VALUES($1,$2,$3,$4,$5)',['31337',n,h(n+1),h(n),1700000000+n]);
  const tx=async(n:number)=>{await db.query('INSERT INTO idx_transactions(chain_id,tx_hash,block_number,block_hash,tx_index,from_address,to_address,value_wei,input) VALUES($1,$2,$3,$4,0,$5,$6,0,$7)',['31337',h(100+n),n,h(n+1),a(30),b.factory,'0x']);await db.query('INSERT INTO idx_receipts(chain_id,tx_hash,block_number,block_hash,tx_index,status,contract_address) VALUES($1,$2,$3,$4,0,1,NULL)',['31337',h(100+n),n,h(n+1)]);};
  const log=async(n:number,i:number,address:string,topics:string[],data:string)=>db.query('INSERT INTO idx_logs(chain_id,block_number,block_hash,tx_hash,tx_index,log_index,address,topics,data) VALUES($1,$2,$3,$4,0,$5,$6,$7::jsonb,$8)',['31337',n,h(n+1),h(n+100),i,address,JSON.stringify(topics),data]);
  await block(0);await block(1);await tx(1);
  await log(1,0,E.Registry,[E.Published,E.ServiceID,h(1),aw(b.factory)],'0x'+b.factoryCodeHash.slice(2)+b.metadataHash.slice(2)+w(1));
  await log(1,1,E.Registry,[E.Profile,E.ServiceID,h(1)],'0x'+w(3)+b.manifestHash.slice(2)+b.dependencyRoot.slice(2)+b.interfaceHash.slice(2));
  const templates=Object.entries(T);let n=2;
  for(const [id,name] of templates){
   await block(n);await tx(n);
   await log(n,1,b.factory,[E.Deployed,aw(a(1000+n)),aw(a(30)),id],'0x'+w(1)+w(31)+E.FeeWord);
   await log(n,2,b.accounting,[E.Deposit,E.VaultID,h(0)],'0x'+E.FeeWord+E.FeeWord);
   await log(n,3,b.vault,[E.Native,aw(b.factory)],'0x'+E.FeeWord);
   await log(n,4,b.factory,[E.Fee,aw(b.vault),E.VaultID],'0x'+E.FeeWord);n++;
  }
  await db.query('INSERT INTO idx_checkpoints(chain_id,block_number,block_hash,parent_hash) VALUES(31337,9,$1,$2)',[h(10),h(9)]);
  const api=new IndexerPublicApiAdapter420(new IndexerQueryService420(db),undefined,{tokenDeployment:JSON.stringify(b)});
  const route=(token:string,chain=31337)=>routeIndexerHttp420(api,'GET','/v1/token/deployments/'+token+'?chainId='+chain);
  for(let i=0;i<templates.length;i++){const p=await tokenDeploymentState420(db,31337n,b,a(1002+i));assert.equal(p?.template,templates[i][1]);assert.equal(p?.authoritative,false);assert.equal(p?.creationFeeWei,E.FeeWei);assert.equal((await route(a(1002+i))).status,200);}
  assert.equal((await route(a(999))).status,404);assert.equal((await route('bad')).status,400);assert.equal((await route(a(1002),420)).status,503);
  await db.query('UPDATE idx_receipts SET status=0 WHERE block_number=2');assert.equal((await route(a(1002))).status,503);await db.query('UPDATE idx_receipts SET status=1 WHERE block_number=2');
  await db.query('UPDATE idx_logs SET address=$1 WHERE block_number=2 AND log_index=3',[a(99)]);assert.equal((await route(a(1002))).status,503);await db.query('UPDATE idx_logs SET address=$1 WHERE block_number=2 AND log_index=3',[b.vault]);
  await db.query('UPDATE idx_checkpoints SET block_number=8,block_hash=$1,parent_hash=$2',[h(9),h(8)]);
  assert.equal((await route(a(1009))).status,404);assert.equal((await route(a(1008))).status,200);
  await db.query('UPDATE idx_checkpoints SET block_hash=$1',[h(99)]);assert.equal((await route(a(1008))).status,503);
 }finally{await db.close();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.close();}
});
