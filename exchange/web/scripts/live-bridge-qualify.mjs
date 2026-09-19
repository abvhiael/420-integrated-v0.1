import fs from 'node:fs';
import path from 'node:path';
import { bindExchangeRuntime } from '../core/deployment.js';
import { qualifyLiveTestnetBridge } from '../core/live-bridge-qualification.js';

function required(name) { const value=process.env[name];if(!value) throw Error(`missing ${name}`);return value; }
function json(file,label) { try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch { throw Error(`cannot read valid ${label} JSON`); } }
class Rpc {
 constructor(url) { if(!/^https:\/\//.test(url)) throw Error('secure HTTPS RPC required');this.url=url;this.id=0; }
 async request({method,params=[]}) {
  const response=await fetch(this.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++this.id,method,params})});
  if(!response.ok) throw Error(`RPC HTTP ${response.status}`);
  const data=await response.json();if(data.error){const error=Error(data.error.message??'RPC error');error.code=data.error.code;error.data=data.error.data;throw error;}return data.result;
 }
}
const root=path.resolve(import.meta.dirname,'..');
const sourceRuntime=bindExchangeRuntime(json(path.join(root,'runtime-config.json'),'source runtime template'),json(required('EXCHANGE_TESTNET_MANIFEST'),'source manifest'));
const destinationRuntime=bindExchangeRuntime(json(path.join(root,'runtime-config.json'),'destination runtime template'),json(required('EXCHANGE_TESTNET_DESTINATION_MANIFEST'),'destination manifest'));
const fixture=json(required('EXCHANGE_TESTNET_BRIDGE_FIXTURE'),'bridge fixture');
if(fixture.schema!=='420-exchange-live-bridge-fixture-v15.8'||fixture.environment!=='testnet') throw Error('invalid V15.8 fixture');
if(!fixture.operatorApproved) throw Error('operator approval required for value-moving bridge drill');
const sourceProvider=new Rpc(required('EXCHANGE_TESTNET_SOURCE_SIGNER_RPC_URL'));
const destinationProvider=new Rpc(required('EXCHANGE_TESTNET_DESTINATION_SIGNER_RPC_URL'));
const proofUrl=new URL(required('EXCHANGE_TESTNET_PROOF_URL'));
if(proofUrl.protocol!=='https:'||proofUrl.username||proofUrl.password) throw Error('proof URL must be credential-free HTTPS');
const proofProvider=async(binding)=>{
 const response=await fetch(proofUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(binding)});
 if(!response.ok) throw Error(`proof provider HTTP ${response.status}`);
 return response.json();
};
const result=await qualifyLiveTestnetBridge({
 sourceProvider,destinationProvider,sourceRuntime,destinationRuntime,reviewedIntent:fixture.reviewedIntent,
 execution:fixture.execution,
 sourceFreshness:fixture.freshness?{...fixture.freshness,nowSeconds:Math.floor(Date.now()/1000)}:null,
 sourceAuthorizationChecks:fixture.authorizationChecks,
 sourceAllowanceChecks:fixture.allowanceChecks??[],sourceStaticCalls:fixture.staticCalls??[],
 proofProvider,destinationAdapterId:fixture.destinationAdapterId,expectedTransferId:fixture.expectedTransferId??null,
 maxAttempts:Number(fixture.maxAttempts??60),pollMs:Number(fixture.pollMs??5000),
});
const evidence={schema:'420-exchange-live-bridge-evidence-v15.8',status:'QUALIFIED',sourceSha:process.env.GITHUB_SHA??null,generatedAt:new Date().toISOString(),...result};
const output=path.resolve(required('EXCHANGE_TESTNET_EVIDENCE_OUT'));
fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
console.log(`V15.8 bridge qualified: source ${result.sourceTxHash}; inbound ${result.destinationTxHash}; evidence ${output}`);
