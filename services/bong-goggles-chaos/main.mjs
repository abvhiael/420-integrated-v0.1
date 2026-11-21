import pg from 'pg';
import {PostgresRooms} from './postgres.mjs';
import {createChaosServer} from './http.mjs';
function required(name){const value=process.env[name];if(!value)throw Error(name+' is required');return value;}
if(process.env.CHAOS_MODE!=='restricted-acceptance')throw Error('CHAOS_MODE must be restricted-acceptance');
const key=Buffer.from(required('CHAOS_PROXY_KEY'),'base64url');
if(key.length!==32||key.toString('base64url')!==process.env.CHAOS_PROXY_KEY)throw Error('Invalid CHAOS_PROXY_KEY');
const url=new URL(required('CHAOS_DATABASE_URL'));
if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||
 url.searchParams.get('sslmode')!=='verify-full'||url.searchParams.getAll('sslmode').length!==1)
 throw Error('CHAOS_DATABASE_URL needs certificate-verified PostgreSQL');
const pool=new pg.Pool({connectionString:url.toString(),max:8,idleTimeoutMillis:30000,
 connectionTimeoutMillis:5000,ssl:{rejectUnauthorized:true}});
await pool.query('SELECT 1 FROM bg_account_social.chaos_rooms LIMIT 0');
const app=createChaosServer({repo:new PostgresRooms(pool),key});
const port=Number(process.env.PORT||10000);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
app.listen(port,'0.0.0.0',()=>console.log('Authenticated CCC multiplayer service ready'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{
 app.close(()=>pool.end().then(()=>process.exit(0),()=>process.exit(1)));
});
