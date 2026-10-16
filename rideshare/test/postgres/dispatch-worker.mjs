import {readFileSync} from 'node:fs';
import {createDatabasePool} from '../../src/postgres-store.mjs';
import {fixture} from './dispatch-fixture.mjs';
const config=JSON.parse(readFileSync(process.argv[2],'utf8'));
const pool=createDatabasePool({connectionString:config.url});
try {
  const app=fixture(pool,config.pairs,config.controls);
  try {const result=await app.transition('operator','operator_dispatch',process.argv[3],'match',0,process.argv[4]);console.log(JSON.stringify({ok:true,result}));}
  catch(error){console.log(JSON.stringify({ok:false,code:error.code}));}
}finally{await pool.end();}
