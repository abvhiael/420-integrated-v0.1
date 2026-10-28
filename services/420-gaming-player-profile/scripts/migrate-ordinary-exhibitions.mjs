// Restricted operator entry point. Requires migration role membership and explicit URL.
import {Pool} from 'pg';
import {migrateOrdinaryExhibitions420} from '../src/highcountry-ordinary-migrations.js';
if(!process.env.GAMING_DATASTORE_MIGRATION_URL)throw Error('migration-connection-required');
const pool=new Pool({connectionString:process.env.GAMING_DATASTORE_MIGRATION_URL});
try{
 const status=await migrateOrdinaryExhibitions420(pool);
 console.log(JSON.stringify(status));
}catch{
 console.error('HighCountry ordinary exhibitions migration refused. Review privileged migration logs.');
 process.exitCode=1;
}finally{await pool.end();}
