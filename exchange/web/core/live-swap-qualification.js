import { buildSwapTransaction } from './execution.js';
import { preflightExchangeTransaction } from './preflight.js';
import { WalletSession } from './wallet-session.js';
import { submitPreflightedTransaction } from './wallet-execution.js';
import { inspectAndReconcileTransaction } from './transaction-lifecycle.js';

const FINALITY_ORDER=Object.freeze(['PENDING','INCLUDED','CONFIRMED','SAFE','FINALIZED']);
const TERMINAL_FAILURES=new Set(['REVERTED','REORGED','DROPPED']);

export class LiveSwapQualificationError extends Error{
  constructor(code,message,details={}){
    super(message);
    this.name='LiveSwapQualificationError';
    this.code=code;
    this.details=Object.freeze({...details});
  }
}

function rank(state){return FINALITY_ORDER.indexOf(state);}
function reached(state,target){
  const s=rank(state),t=rank(target);
  return s>=0&&t>=0&&s>=t;
}
function delay(ms){return new Promise((resolve)=>setTimeout(resolve,ms));}

export async function qualifyLiveTestnetSwap({
  provider,
  runtime,
  reviewedIntent,
  execution,
  freshness,
  allowanceChecks=[],
  authorizationChecks=[],
  staticCalls=[],
  exchangeClient=null,
  subjectId=null,
  minConfirmations=2,
  targetState='FINALIZED',
  maxAttempts=60,
  pollIntervalMs=5000,
  sleep=delay,
}={}){
  if(runtime?.deployment?.environment!=='testnet'||runtime?.deployment?.status!=='RESOLVED'){
    throw new LiveSwapQualificationError('TESTNET_RUNTIME_REQUIRED','resolved Exchange testnet runtime required');
  }
  if(!FINALITY_ORDER.includes(targetState)||targetState==='PENDING'){
    throw new LiveSwapQualificationError('INVALID_TARGET','targetState must be INCLUDED, CONFIRMED, SAFE or FINALIZED');
  }
  if(!Number.isInteger(maxAttempts)||maxAttempts<1) throw new LiveSwapQualificationError('INVALID_POLICY','maxAttempts must be >= 1');
  if(!Number.isInteger(pollIntervalMs)||pollIntervalMs<0) throw new LiveSwapQualificationError('INVALID_POLICY','pollIntervalMs must be >= 0');

  const accounts=await provider.request({method:'eth_accounts'});
  const account=accounts?.[0];
  if(typeof account!=='string') throw new LiveSwapQualificationError('TEST_ACCOUNT_UNAVAILABLE','testnet provider exposes no account');

  const transaction=buildSwapTransaction({runtime,account,reviewedIntent,execution});
  const preflight=await preflightExchangeTransaction({
    provider,transaction,runtime,freshness,allowanceChecks,authorizationChecks,staticCalls,
  });

  const session=new WalletSession();
  session.connected({account,chainId:runtime.network.chainId,providerKind:'testnet-rpc'});
  const generation=session.generation;
  const submission=await submitPreflightedTransaction({
    provider,
    session,
    expectedChainId:runtime.network.chainId,
    expectedGeneration:generation,
    transaction,
    preflight,
  });

  const observations=[];
  let latest=null;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    latest=await inspectAndReconcileTransaction({
      provider,
      exchangeClient,
      txHash:submission.txHash,
      minConfirmations,
      subjectId,
      kinds:['TRADE','FEE_ROUTING'],
    });
    observations.push(Object.freeze({
      attempt,
      state:latest.rpc.state,
      confirmations:latest.rpc.confirmations,
      indexedStatus:latest.indexed.status,
      indexedConflicts:[...latest.indexed.conflicts],
    }));

    if(TERMINAL_FAILURES.has(latest.rpc.state)){
      throw new LiveSwapQualificationError('SWAP_FAILED',`live swap reached ${latest.rpc.state}`,{
        txHash:submission.txHash,
        lifecycle:latest,
        observations,
      });
    }
    if(reached(latest.rpc.state,targetState)){
      if(exchangeClient&&latest.indexed.conflicts.length){
        throw new LiveSwapQualificationError('INDEXER_CONFLICT','V13 reconciliation conflicts with canonical RPC evidence',{
          txHash:submission.txHash,
          lifecycle:latest,
          observations,
        });
      }
      return Object.freeze({
        qualified:true,
        environment:'testnet',
        chainId:runtime.network.chainId,
        account:submission.account,
        txHash:submission.txHash,
        transactionFingerprint:submission.transactionFingerprint,
        gasEstimate:preflight.gasEstimate,
        targetState,
        finalState:latest.rpc.state,
        confirmations:latest.rpc.confirmations,
        blockNumber:latest.rpc.receipt?.blockNumber?.toString()??null,
        blockHash:latest.rpc.receipt?.blockHash??null,
        indexedStatus:latest.indexed.status,
        indexedReconciled:exchangeClient?latest.indexed.reconciled:null,
        indexedConflicts:[...latest.indexed.conflicts],
        observations:Object.freeze(observations),
      });
    }
    if(attempt<maxAttempts) await sleep(pollIntervalMs);
  }

  throw new LiveSwapQualificationError('FINALITY_TIMEOUT',`live swap did not reach ${targetState}`,{
    txHash:submission.txHash,
    lastState:latest?.rpc?.state??null,
    observations,
  });
}
