import { readFileSync } from 'node:fs';
import { Database } from './database.mjs';
import { hash, requireThat, RequestAuth } from './security.mjs';
import { RpcAuthority } from './authority.mjs';
import { Projection } from './projection.mjs';
import { ProjectionWorker } from './worker.mjs';
import { CommerceService } from './service.mjs';
import { commerceServer } from './http.mjs';

process.umask(0o077);
const manifest=readFileSync(process.env.COMMERCE_MANIFEST_FILE);
requireThat(hash(manifest)===process.env.COMMERCE_MANIFEST_SHA256,'unapproved_manifest',503);
const config=JSON.parse(manifest),origin=new URL(config.origin);
requireThat(origin.origin===config.origin&&(origin.protocol==='https:'||config.environment==='local'&&origin.hostname==='127.0.0.1'),'invalid_origin');
requireThat(/^[a-fA-F0-9]{64}$/.test(process.env.COMMERCE_DELIVERY_KEY_HEX??''),'missing_delivery_key',503);
const deliveryKey=Buffer.from(process.env.COMMERCE_DELIVERY_KEY_HEX,'hex');
const db=new Database(process.env.COMMERCE_DB_FILE),authority=new RpcAuthority(config);
const projection=new Projection(db,authority,{...config,contracts:config.contracts}),worker=new ProjectionWorker(projection,authority,config);
const service=new CommerceService(db,authority,projection,{chainId:config.chainId,deliveryKey});
service.reconcileTaxonomy(config.globalTaxonomy??[]);
const auth=new RequestAuth(db,{origin:config.origin,chainId:config.chainId,verifyContractSignature:(...args)=>authority.verifyContractSignature(...args)});
const server=commerceServer(service,auth,{origin:config.origin});
let stopped=false,timer;
const tick=async()=>{
  try{await worker.syncOnce();service.purge();}
  catch{console.error(JSON.stringify({event:'commerce_projection_unavailable',state:projection.health().state}));}
  if(!stopped)timer=setTimeout(tick,10000);
};
await authority.snapshot();await worker.syncOnce();
const port=Number(process.env.PORT??8080);requireThat(Number.isInteger(port)&&port>0&&port<=65535,'invalid_port');
server.listen(port,'127.0.0.1');tick();
const shutdown=()=>{stopped=true;clearTimeout(timer);server.close(()=>{db.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();};
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
