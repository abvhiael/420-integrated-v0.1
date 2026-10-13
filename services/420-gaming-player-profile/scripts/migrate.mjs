import { Pool } from 'pg';
import { bootstrapDatastoreRoles,migrateDatastore } from '../src/schema-migrations.js';
if(!process.env.GAMING_DATASTORE_MIGRATION_URL)throw Error('migration connection required');
const pool=new Pool({connectionString:process.env.GAMING_DATASTORE_MIGRATION_URL});
try{
  if(process.argv[2]==='bootstrap')await bootstrapDatastoreRoles(pool);
  else console.log(JSON.stringify(await migrateDatastore(pool,process.argv[2]??'up')));
}catch{console.error('Gaming datastore migration failed; inspect protected operator diagnostics.');process.exitCode=1;}
finally{await pool.end();}
