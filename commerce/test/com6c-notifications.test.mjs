import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,checkout,seller,buyer,attacker,b32,address} from './fixtures.mjs';
import {hash} from '../src/security.mjs';
const event=(orderId,number)=>({streamVersion:'v1',source:'protocol',protocol:'420Market',eventName:'OrderDisputed',topic:'420Market.OrderDisputed',id:'420evt:v1:420:'+b32(100)+':'+b32(number)+':0',objectKey:'orderId:'+orderId,lifecycleState:'DISPUTED',fields:{orderId,disputeHash:b32(number)},provenance:{chainId:'420',blockNumber:'1',blockHash:b32(100),transactionHash:b32(number),transactionIndex:0,logIndex:0,contractAddress:address(23)},authoritative:false});
test('COM-6C private notifications are opt-in, finalized only, dedup and revocable',async t=>{
 const f=setup();t.after(()=>f.close());const {store,attempt}=await checkout(f);
 assert.equal((await f.service.merchantNotifications(seller.address,store.store_id)).enabled,false);
 await assert.rejects(()=>f.service.merchantNotificationPreferences(attacker.address,store.store_id,{enabled:true}),e=>e.code==='forbidden');
 await assert.rejects(()=>f.service.merchantNotificationPreferences(seller.address,store.store_id,{enabled:'yes'}),e=>e.code==='invalid_notification_consent');
 await f.service.merchantNotificationPreferences(seller.address,store.store_id,{enabled:true});
 assert.equal((await f.service.merchantNotificationPreferences(seller.address,store.store_id)).enabled,true);
 const original=event(attempt.orderId,111);const insert=(id,canonical=1,finality='finalized')=>{
  f.db.run('INSERT INTO event_inbox(event_id,chain_id,block_number,block_hash,tx_hash,tx_index,log_index,source_contract,topic,payload_hash,payload,finality,applied_at,canonical) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id.id,'420',1,b32(100),id.provenance.transactionHash,0,0,address(23),id.topic,hash(JSON.stringify(id)),JSON.stringify(id),finality,f.now(),canonical);
 };
 insert(original);
 let feed=await f.service.merchantNotifications(seller.address,store.store_id);
 assert.equal(feed.items.length,1);assert.equal(feed.items[0].finality,'finalized');assert.equal(feed.items[0].authoritative,false);
 assert.equal(feed.delivery,'IN_APP_PRESENTATION_ONLY');
 await f.service.merchantNotifications(seller.address,store.store_id);assert.equal(f.db.get('SELECT COUNT(*) AS n FROM commerce_notification_feed').n,1);
 const n=feed.items[0];await f.service.merchantNotificationRead(seller.address,store.store_id,n.id,{read:true});
 feed=await f.service.merchantNotifications(seller.address,store.store_id);assert.equal(feed.items[0].read,true);
 await assert.rejects(()=>f.service.merchantNotificationRead(attacker.address,store.store_id,n.id,{read:true}),e=>e.code==='forbidden');
 f.db.run('UPDATE event_inbox SET canonical=0 WHERE event_id=?',original.id);
 feed=await f.service.merchantNotifications(seller.address,store.store_id);assert.equal(feed.items.length,0);
 await f.service.merchantNotificationPreferences(seller.address,store.store_id,{enabled:false});
 assert.equal(f.db.get('SELECT COUNT(*) AS n FROM commerce_notification_feed').n,0);
 assert.equal((await f.service.merchantNotifications(seller.address,store.store_id)).enabled,false);
});
test('COM-6C foreign order events never cross merchant scope and deactivated controller invalidates preferences',async t=>{
 const f=setup();t.after(()=>f.close());const {store}=await checkout(f);
 await f.service.merchantNotificationPreferences(seller.address,store.store_id,{enabled:true});
 const other=event(b32(9876),114);
 f.db.run('INSERT INTO event_inbox(event_id,chain_id,block_number,block_hash,tx_hash,tx_index,log_index,source_contract,topic,payload_hash,payload,finality,applied_at,canonical) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',other.id,'420',1,b32(100),other.provenance.transactionHash,0,0,address(23),other.topic,hash(JSON.stringify(other)),JSON.stringify(other),'finalized',f.now(),1);
 assert.equal((await f.service.merchantNotifications(seller.address,store.store_id)).items.length,0);
 f.setController(attacker.address);
 await assert.rejects(()=>f.service.merchantNotifications(seller.address,store.store_id),e=>e.code==='forbidden');
 const p=await f.service.merchantNotificationPreferences(attacker.address,store.store_id);
 assert.equal(p.enabled,false);
});

test('COM-6C bounded opaque pagination and read-state isolation remain stable under same-height events',async t=>{
 const f=setup();t.after(()=>f.close());const {store,attempt}=await checkout(f);
 await f.service.merchantNotificationPreferences(seller.address,store.store_id,{enabled:true});
 for(const n of [201,202,203]){
  const x=event(attempt.orderId,n);
  f.db.run('INSERT INTO event_inbox(event_id,chain_id,block_number,block_hash,tx_hash,tx_index,log_index,source_contract,topic,payload_hash,payload,finality,applied_at,canonical) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',x.id,'420',1,b32(100),x.provenance.transactionHash,0,0,address(23),x.topic,hash(JSON.stringify(x)),JSON.stringify(x),'finalized',f.now(),1);
 }
 const first=await f.service.merchantNotifications(seller.address,store.store_id,{limit:2});
 assert.equal(first.items.length,2);assert.match(first.nextCursor,/^[a-f0-9]{64}$/);
 const second=await f.service.merchantNotifications(seller.address,store.store_id,{limit:2,cursor:first.nextCursor});
 assert.equal(second.items.length,1);assert.equal(second.nextCursor,null);
 assert.equal(new Set([...first.items,...second.items].map(x=>x.id)).size,3);
 await assert.rejects(()=>f.service.merchantNotifications(seller.address,store.store_id,{cursor:'f'.repeat(64)}),e=>e.code==='invalid_notification_cursor');
 const target=first.items[0].id;
 await f.service.merchantNotificationRead(seller.address,store.store_id,target,{read:true});
 const reread=await f.service.merchantNotifications(seller.address,store.store_id,{limit:3});
 assert.equal(reread.items.find(x=>x.id===target).read,true);
 assert.equal(reread.items.filter(x=>x.read).length,1);
});
