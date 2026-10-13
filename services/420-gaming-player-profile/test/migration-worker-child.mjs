import { Pool } from 'pg';
import { DurableMigrationCoordinator420 } from '../src/migration-coordinator.js';
const uri=process.env.GAMING_MIGRATION_TEST_URL;
if(!uri||!new URL(uri).pathname.endsWith('/r053_ci'))throw Error('isolated test database required');
const pool=new Pool({connectionString:uri});
try {
  const coordinator=new DurableMigrationCoordinator420({
    operatorPool:pool,
    verifyBoundClaim:async()=>{throw Error('no issuance in recovery child');},
    verifyReceipt:async()=>{throw Error('no receipts in recovery child');}
  });
  const leased=await coordinator.lease();
  if(leased.length!==1)throw Error('expected exactly one durable outstanding operation');
  process.stdout.write(JSON.stringify(leased[0]));
}finally{await pool.end();}
