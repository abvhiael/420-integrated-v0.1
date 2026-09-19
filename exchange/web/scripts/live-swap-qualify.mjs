import fs from 'node:fs';
import path from 'node:path';
import { bindExchangeRuntime } from '../core/deployment.js';
import { ExchangeClient } from '../core/exchange-client.js';
import { qualifyLiveTestnetSwap } from '../core/live-swap-qualification.js';

function requiredEnv(name){
  const value=process.env[name];
  if(!value) throw new Error(`missing ${name}`);
  return value;
}
function readJson(file,label){
  let raw;
  try{raw=fs.readFileSync(file,'utf8');}
  catch{throw new Error(`cannot read ${label}`);}
  try{return JSON.parse(raw);}
  catch{throw new Error(`invalid JSON in ${label}`);}
}

class JsonRpcProvider{
  constructor(url,fetchImpl=globalThis.fetch){
    this.url=url;
    this.fetchImpl=fetchImpl;
    this.id=0;
  }
  async request({method,params=[]}){
    const response=await this.fetchImpl(this.url,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:++this.id,method,params}),
    });
    if(!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const body=await response.json();
    if(body?.error){
      const error=new Error(body.error.message??'RPC error');
      error.code=body.error.code;
      error.data=body.error.data;
      throw error;
    }
    return body?.result;
  }
}

const root=path.resolve(import.meta.dirname,'..');
const repoRoot=path.resolve(root,'..','..');
const manifestPath=path.resolve(requiredEnv('EXCHANGE_TESTNET_MANIFEST'));
const fixturePath=path.resolve(requiredEnv('EXCHANGE_TESTNET_SWAP_FIXTURE'));
const outputPath=path.resolve(process.env.EXCHANGE_TESTNET_EVIDENCE_OUT||path.join(root,'v15.6-live-evidence.json'));

const deployment=readJson(manifestPath,'testnet deployment manifest');
const template=readJson(path.join(root,'runtime-config.json'),'runtime template');
const fixture=readJson(fixturePath,'swap qualification fixture');
const runtime=bindExchangeRuntime(template,deployment);

if(runtime.deployment.environment!=='testnet'||runtime.deployment.status!=='RESOLVED') throw new Error('resolved testnet runtime required');
if(fixture.schema!=='420-exchange-live-swap-fixture-v15.6') throw new Error('invalid V15.6 fixture schema');
if(fixture.environment!=='testnet') throw new Error('V15.6 fixture must target testnet');
if(fixture.chainId&&String(fixture.chainId).toLowerCase()!==runtime.network.chainId.toLowerCase()) throw new Error('fixture chainId mismatch');

const provider=new JsonRpcProvider(runtime.network.rpcUrl);
const exchangeClient=new ExchangeClient({baseUrl:runtime.api.baseUrl});
const targetState=process.env.EXCHANGE_TESTNET_TARGET_STATE||fixture.targetState||'FINALIZED';
const minConfirmations=Number(process.env.EXCHANGE_TESTNET_MIN_CONFIRMATIONS||fixture.minConfirmations||2);
const maxAttempts=Number(process.env.EXCHANGE_TESTNET_MAX_ATTEMPTS||fixture.maxAttempts||60);
const pollIntervalMs=Number(process.env.EXCHANGE_TESTNET_POLL_MS||fixture.pollIntervalMs||5000);

const evidence=await qualifyLiveTestnetSwap({
  provider,
  runtime,
  reviewedIntent:fixture.reviewedIntent,
  execution:fixture.execution,
  freshness:fixture.freshness ? {...fixture.freshness,nowSeconds:Math.floor(Date.now()/1000)} : null,
  allowanceChecks:fixture.allowanceChecks??[],
  authorizationChecks:fixture.authorizationChecks??[],
  staticCalls:fixture.staticCalls??[],
  exchangeClient,
  subjectId:fixture.subjectId??null,
  minConfirmations,
  targetState,
  maxAttempts,
  pollIntervalMs,
});

const report={
  schema:'420-exchange-live-swap-evidence-v15.6',
  status:'QUALIFIED',
  sourceSha:process.env.GITHUB_SHA||process.env.EXCHANGE_SOURCE_SHA||null,
  generatedAt:new Date().toISOString(),
  environment:evidence.environment,
  chainId:evidence.chainId,
  account:evidence.account,
  txHash:evidence.txHash,
  transactionFingerprint:evidence.transactionFingerprint,
  gasEstimate:evidence.gasEstimate,
  targetState:evidence.targetState,
  finalState:evidence.finalState,
  confirmations:evidence.confirmations,
  blockNumber:evidence.blockNumber,
  blockHash:evidence.blockHash,
  indexedStatus:evidence.indexedStatus,
  indexedReconciled:evidence.indexedReconciled,
  indexedConflicts:evidence.indexedConflicts,
  observations:evidence.observations,
};

fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(`V15.6 live swap qualified: ${report.txHash} -> ${report.finalState}; evidence ${outputPath}`);
