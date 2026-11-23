// Trusted backend entrypoint; intentionally separate from Cloudflare static Worker.
// Requires operator-approved provider module; never substitutes a fake transport.
import {createServer} from 'node:http';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createBetNotificationsMailRuntime} from './notifications-mail-runtime.mjs';
import {openBetOperationalDeliveryWorker} from './delivery-worker.mjs';
import {openDeliveryAlertJournal,createSignedDeliveryAlertWebhook} from './delivery-alerts.mjs';

const env=process.env;
const required=(name)=>{const value=env[name];if(!value)throw Error('420Bet delivery service: '+name+' required');return value;};
const bound=(name,fallback,min,max)=>{
 const number=Number(env[name]??fallback);
 if(!Number.isSafeInteger(number)||number<min||number>max)throw Error('420Bet delivery service: invalid '+name);
 return number;
};
const providerPath=required('BET_NOTIFICATIONS_PROVIDER_MODULE');
if(!isAbsolute(providerPath))throw Error('420Bet delivery service: absolute approved adapter module required');
const providerModule=await import(pathToFileURL(resolve(providerPath)).href);
const notifications=providerModule.notifications??providerModule.default;
if(!notifications||!['deliverAuthenticated','readReceipt','cancelDelivery'].every(k=>typeof notifications[k]==='function'))
 throw Error('420Bet delivery service: qualified 420Notifications callback adapter required');
const statePath=required('BET_DELIVERY_WORKER_STATE_PATH');
let runtime,worker,http,alerts=null,alertTimer=null,alertInFlight=null;
try{
 runtime=await createBetNotificationsMailRuntime({notifications});
 worker=await openBetOperationalDeliveryWorker({
  runtime,statePath,indexerCheckpointPath:required('BET_INDEXER_EVENT_CHECKPOINT'),
  intervalMs:bound('BET_DELIVERY_INTERVAL_MS',5000,100,3600000),
  retryMaxMs:bound('BET_DELIVERY_RETRY_MAX_MS',60000,100,3600000),
  staleAfterMs:bound('BET_DELIVERY_STALE_AFTER_MS',30000,100,86400000),
  maxBlocks:bound('BET_DELIVERY_MAX_BLOCKS',64,1,64),
  drainLimit:bound('BET_DELIVERY_DRAIN_LIMIT',20,1,100)
 });
 const alertConfigured=['BET_DELIVERY_ALERT_URL','BET_DELIVERY_ALERT_SECRET',
  'BET_DELIVERY_ALERT_STATE_PATH'].some(key=>env[key]);
 if(alertConfigured){
  alerts=await openDeliveryAlertJournal({
   worker,outbox:runtime.outbox,path:required('BET_DELIVERY_ALERT_STATE_PATH'),
   send:createSignedDeliveryAlertWebhook({
    url:required('BET_DELIVERY_ALERT_URL'),secret:required('BET_DELIVERY_ALERT_SECRET')}),
   cancellationAgeMs:bound('BET_DELIVERY_ALERT_CANCELLATION_AGE_MS',60000,100,86400000),
   pendingAgeMs:bound('BET_DELIVERY_ALERT_PENDING_AGE_MS',180000,100,86400000)
  });
 }
 const host=env.BET_DELIVERY_MONITOR_HOST??'127.0.0.1';
 if(!['127.0.0.1','::1','localhost'].includes(host))
  throw Error('420Bet delivery service: monitoring must be loopback-only');
 const port=bound('BET_DELIVERY_MONITOR_PORT',8427,1,65535);
 http=createServer(async(req,res)=>{
  const report=worker.health();
  const url=req.url?.split('?')[0];
  let summary=null;
  try{if(url==='/metrics')summary=await runtime.outbox.summary();}
  catch{res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
   res.end(JSON.stringify({error:'monitor_unavailable'}));return;}
  if(req.method!=='GET'||!['/healthz','/readyz','/metrics'].includes(url)){
   res.writeHead(404,{'Content-Type':'application/json','Cache-Control':'no-store'});
   res.end(JSON.stringify({error:'not_found'}));return;
  }
  const status=url==='/readyz'&&!report.ready?503:200;
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify(url==='/metrics'?{worker:report,outbox:summary,
   alerts:alerts?await alerts.snapshot():{configured:false}}:report));
 });
 await new Promise((done,fail)=>{
  http.once('error',fail);
  http.listen(port,host,()=>{http.off('error',fail);done();});
 });
 worker.start();
 if(alerts){
  const fire=()=>{if(alertInFlight)return;
   alertInFlight=alerts.poll().catch(()=>{}).finally(()=>{alertInFlight=null;});
  };
  fire();
  alertTimer=setInterval(fire,bound('BET_DELIVERY_ALERT_POLL_MS',15000,1000,3600000));
  alertTimer.unref?.();
 }
 // No private envelope, credential or account fields in logs.
 console.log(JSON.stringify({service:'420Bet delivery worker',status:'started',monitor:'loopback'}));
}catch(error){
 if(alertTimer)clearInterval(alertTimer);
 if(alertInFlight)await alertInFlight.catch(()=>{});
 if(alerts)await alerts.close().catch(()=>{});
 if(http?.listening)await new Promise(resolve=>http.close(resolve));
 if(worker)await worker.stop().catch(()=>{});
 else if(runtime)await runtime.stop().catch(()=>{});
 throw error;
}
let exiting=false;
async function shutdown(){
 if(exiting)return;exiting=true;
 if(alertTimer){clearInterval(alertTimer);alertTimer=null;}
 if(alertInFlight)await alertInFlight.catch(()=>{});
 if(alerts)await alerts.close();
 if(http?.listening)await new Promise(resolve=>http.close(resolve));
 await worker.stop();process.exitCode=0;
}
process.once('SIGTERM',()=>void shutdown().catch(()=>{process.exitCode=1;}));
process.once('SIGINT',()=>void shutdown().catch(()=>{process.exitCode=1;}));
