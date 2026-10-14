import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PostgresBudsStore} from '../src/postgres-store.js';
import {BudsLedger} from '../src/buds-ledger.js';
const empty=()=>({schema:1,balances:[],operations:[],claims:[],sourceIssued:[],issued:0,burned:0});
function db(){
 let current=empty(),rolled=0,commits=0;
 const client={
  async query(sql,args){
   if(sql.startsWith('BEGIN'))return {};
   if(sql.startsWith('SELECT'))return {rows:[{state:structuredClone(current)}]};
   if(sql.startsWith('UPDATE')){this.updated=JSON.parse(args[1]);return {rowCount:1};}
   if(sql==='COMMIT'){current=this.updated;commits++;return {};}
   if(sql==='ROLLBACK'){rolled++;return {};}
   throw Error(sql);
  },
  release(){}
 };
 return {pool:{async connect(){return client;}},state:()=>current,commits:()=>commits,rollbacks:()=>rolled};
}
test('durable state round trip and replay persists across distinct store instances',async()=>{
 const fake=db();
 const catalogue={authorize:()=>true,sourceLimit:()=>100,authorizeSink:()=>true};
 const first=new BudsLedger(new PostgresBudsStore(fake.pool,'hc:registered'),catalogue);
 await first.earn('one','alice','mission','proof-1',50);
 const second=new BudsLedger(new PostgresBudsStore(fake.pool,'hc:registered'),catalogue);
 await assert.rejects(second.earn('one','alice','mission','proof-1',50));
 await assert.rejects(second.earn('two','alice','mission','proof-1',50));
 await second.earn('two','alice','mission','proof-2',50);
 assert.equal(fake.state().issued,100);
 assert.equal(fake.commits(),2);
 assert.equal(fake.rollbacks(),2);
});
test('durable transaction rollback on malformed state',async()=>{
 const fake=db();
 const ledger=new BudsLedger(new PostgresBudsStore(fake.pool,'hc:registered'),{authorize:()=>false});
 await assert.rejects(ledger.earn('one','alice','bad','bad',1));
 assert.equal(fake.commits(),0);assert.equal(fake.rollbacks(),1);
});
