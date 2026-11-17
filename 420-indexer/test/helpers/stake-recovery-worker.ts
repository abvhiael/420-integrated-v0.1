import { PostgresSql420 } from '../../src/postgres.js';
import { createStakeIndexer420 } from '../../src/stake-indexer.js';
import { artifacts, manifest, StakeSource420 } from './stake-recovery-fixture.js';
import type { SqlExecutor420 } from '../../src/core-projections.js';
class InterruptedDatabase420 extends PostgresSql420 {
 override async transaction<T>(work:(tx:SqlExecutor420)=>Promise<T>):Promise<T>{
  return super.transaction(tx=>work({query:async(sql,params)=>{
   const result=await tx.query(sql,params);
   if(sql.includes('insert into idx_protocol_events')) {
    process.send?.({ready:true,pid:process.pid});
    await new Promise(()=>{});
   }
   return result;
  }}));
 }
}
const db=new InterruptedDatabase420({connectionString:process.env.INDEXER_PG_URL,options:'-c search_path=stake_recovery_9_3'});
await createStakeIndexer420(new StakeSource420(),db,420n,manifest,artifacts,{finality:{mode:'head'}}).runOnce();
throw new Error('worker unexpectedly committed');
