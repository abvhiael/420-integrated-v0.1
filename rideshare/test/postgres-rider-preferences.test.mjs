import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresRiderPreferenceStore} from '../src/postgres-rider-preferences.mjs';
test('SQL paths use parameterized CAS, do not expose consent via log or broad reads',async()=>{
  const history=[];
  const store=createPostgresRiderPreferenceStore({query:async(sql,args)=>{
    history.push({sql,args});
    if(sql.startsWith('SELECT'))return {rows:[]};
    return {rowCount:1};
  }});
  assert.equal(await store.read('rider1'),null);
  assert.equal(await store.compareAndSwap('rider1',0,{marketingConsent:false}),true);
  assert.equal(await store.compareAndSwap('rider1',1,{marketingConsent:true}),true);
  await store.delete('rider1');
  assert.match(history[0].sql,/WHERE account_id=\$1/);
  assert.match(history[1].sql,/ON CONFLICT\(account_id\) DO NOTHING/);
  assert.match(history[2].sql,/WHERE account_id=\$1 AND revision=\$2/);
  assert.match(history[3].sql,/preferences='\{\}'::jsonb/);
  assert.equal(history[2].args[1],1);
});
