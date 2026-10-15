import {createServer} from 'node:http';
import {createDatabasePool} from './postgres-store.mjs';
import {checkSchema} from './schema.mjs';
// Not a passenger service until independent signed authorities and private vault are admitted.
export const readinessPayload=()=>Object.freeze({
  application:'LIFTd',environment:'isolated-testnet-readiness',productionBookingEnabled:false,
  dispatchEnabled:false,paymentsEnabled:false,acceptance:{identity:'NOT_ACCEPTED',
  transport:'NOT_ACCEPTED',privateVault:'NOT_ACCEPTED',messaging:'NOT_ACCEPTED',accessibility:'NOT_ACCEPTED'}
});
export function buildReadinessServer({pool}={}){
 const db=pool??(process.env.DATABASE_URL?createDatabasePool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true}}):null);
 const owned=!pool&&!!db;
 const server=createServer(async(req,res)=>{
   const json=(status,value)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store','x-content-type-options':'nosniff',
    'content-security-policy':"default-src 'none'",'referrer-policy':'no-referrer'});
    res.end(JSON.stringify(value));};
   if(req.method!=='GET')return json(405,{error:'METHOD_NOT_ALLOWED'});
   if(req.url==='/health')return json(200,{service:'liftd-testnet-readiness',alive:true});
   if(req.url==='/database'){
     if(!db)return json(503,{database:'NOT_CONFIGURED'});
     try{
       await checkSchema(db);
       const row=(await db.query("SELECT current_database() AS db, (SELECT count(*)::int FROM liftd.migrations) AS migrations")).rows[0];
       if(row.db!=='liftd_testnet'||row.migrations!==9)throw Error('SCHEMA_UNQUALIFIED');
       return json(200,{database:'CONNECTED',schema:'QUALIFIED',migrations:9});
     }catch{return json(503,{database:'UNAVAILABLE_OR_UNQUALIFIED'});}
   }
   if(req.url==='/readiness')return json(503,readinessPayload());
   return json(404,{error:'NOT_FOUND'});
 });
 if(owned)server.on('close',()=>{void db.end();});
 return server;
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
 const port=Number(process.env.PORT??10000);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('INVALID_PORT');
 if(!process.env.DATABASE_URL)throw Error('LIFTD_DATABASE_URL_REQUIRED');
 const pool=createDatabasePool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true}});
 try{
   await checkSchema(pool);
   const verified=(await pool.query("SELECT current_database() AS database, count(*)::int AS migration_count FROM liftd.migrations")).rows[0];
   if(verified?.database!=='liftd_testnet'||verified.migration_count!==9)throw Error('LIFTD_SCHEMA_INVALID');
   console.info('LIFTD_NEON_SCHEMA_PASS migrations=9 db=liftd_testnet');
 }catch{
   console.error('LIFTD_NEON_SCHEMA_FAILED');
   await pool.end();
   process.exitCode=1;
   throw Error('LIFTD_DATABASE_UNAVAILABLE');
 }
 buildReadinessServer({pool}).listen(port,'0.0.0.0');
}
