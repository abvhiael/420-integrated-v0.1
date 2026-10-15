import {createDatabasePool,createPostgresTripStore} from '../src/postgres-store.mjs';
if(!process.env.LIFTD_DATABASE_URL)throw Error('Approved LIFTD_DATABASE_URL required');
const pool=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
try {
  // Verify current migration ledger before a retention mutation; no decryption keys required.
  await createPostgresTripStore(pool).get('retention_readiness_check');
  const result=await pool.query('UPDATE liftd.private_locations SET sealed=NULL,tombstoned=true WHERE NOT tombstoned AND expires_at<=$1',[Math.floor(Date.now()/1000)]);
  console.log(`Expired private payloads erased: ${result.rowCount}`);
}finally{await pool.end();}
