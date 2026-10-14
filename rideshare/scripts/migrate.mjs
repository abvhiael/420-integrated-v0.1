import {createDatabasePool,migrate} from '../src/postgres-store.mjs';
if (!process.env.LIFTD_DATABASE_URL) throw new Error('LIFTD_DATABASE_URL required for approved migration connection');
const pool=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
try {await migrate(pool);console.log('LIFTd migration ledger verified.');}
finally {await pool.end();}
