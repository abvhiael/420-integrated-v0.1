import fs from 'node:fs';
import path from 'node:path';
import {bindExchangeRuntime} from '../core/deployment.js';
import {qualifyLiveLimitOrder} from '../core/live-limit-order-qualification.js';

function env(name){const value=process.env[name];if(!value)throw new Error(`missing ${name}`);return value;}
function json(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
class JsonRpcProvider{
 constructor(url){this.url=url;this.id=0;}
 async request({method,params=[]}){
  const response=await fetch(this.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++this.id,method,params})});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();
  if(body.error){const error=new Error(body.error.message??'RPC error');error.code=body.error.code;error.data=body.error.data;throw error;}
  return body.result;
 }
}
const root=path.resolve(import.meta.dirname,'..');
const deployment=json(path.resolve(env('EXCHANGE_TESTNET_MANIFEST')));
const runtime=bindExchangeRuntime(json(path.join(root,'runtime-config.json')),deployment);
const fixture=json(path.resolve(env('EXCHANGE_TESTNET_ORDER_FIXTURE')));
if(fixture.schema!=='420-exchange-live-limit-order-fixture-v15.7'||fixture.environment!=='testnet')throw new Error('V15.7 testnet fixture required');
if(String(fixture.chainId).toLowerCase()!==runtime.network.chainId.toLowerCase())throw new Error('fixture chain mismatch');
if(runtime.deployment.environment!=='testnet'||runtime.deployment.status!=='RESOLVED')throw new Error('resolved testnet deployment required');
// Separate, disposable, explicitly provisioned testnet account providers; no keys/mnemonics enter this script.
const makerProvider=new JsonRpcProvider(env('EXCHANGE_TESTNET_MAKER_RPC_URL'));
const fillerProvider=new JsonRpcProvider(env('EXCHANGE_TESTNET_FILLER_RPC_URL'));
const evidence=await qualifyLiveLimitOrder({runtime,makerProvider,fillerProvider,reviewedOrder:fixture.reviewedOrder,execution:fixture.execution,fill:fixture.fill,nowSeconds:Math.floor(Date.now()/1000),attempts:Number(fixture.attempts??60),pollMs:Number(fixture.pollMs??5000)});
const report={schema:'420-exchange-live-limit-order-evidence-v15.7',sourceSha:process.env.GITHUB_SHA??null,generatedAt:new Date().toISOString(),status:'QUALIFIED',...evidence};
const output=path.resolve(process.env.EXCHANGE_TESTNET_EVIDENCE_OUT??path.join(root,'v15.7-live-evidence.json'));
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(`V15.7 order ${report.orderHash}: fill ${report.fill.txHash}, cancel ${report.cancel.txHash}, FINALIZED`);
