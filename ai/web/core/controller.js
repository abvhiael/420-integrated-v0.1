import {AiWalletSession420} from './wallet.js';
import {AiReadApi420} from './read-api.js';
import {encodeCreateRequest420,encodeCancel420,encodeOpenDispute420,keccak256,randomBytes32} from './abi.js';
import {submitReviewedAiTransaction420} from './transactions.js';
import {clientReadiness420} from './config.js';

export class AiClientController420{
  constructor({config,ethereum=globalThis.ethereum,fetchImpl=globalThis.fetch,onState=()=>{}}={}){
    this.config=config;this.ethereum=ethereum;this.fetchImpl=fetchImpl;this.onState=onState;this.wallet=null;this.readApi=null;this.disposeWallet=null;this.pending=null;
    const readiness=clientReadiness420(config);this.onState({type:'readiness',...readiness});
    if(config.readApi?.baseUrl&&config.network?.chainId)this.readApi=new AiReadApi420({baseUrl:config.readApi.baseUrl,chainId:BigInt(config.network.chainId),fetchImpl});
  }
  async connect(){if(!this.config.features.walletConnection)throw Error('wallet connection disabled');this.wallet=new AiWalletSession420(this.ethereum);const session=await this.wallet.connect(this.config.network.chainId);this.disposeWallet=this.wallet.installInvalidation((reason)=>{this.pending=null;this.onState({type:'wallet-invalidated',reason});});this.onState({type:'wallet-connected',...session});return session;}
  async discover(){if(!this.readApi)throw Error('AI read API not configured');const [models,versions,deployments,policies]=await Promise.all([this.readApi.models({limit:100}),this.readApi.modelVersions({limit:100}),this.readApi.deployments({limit:100}),this.readApi.policies({limit:100})]);const result={models:models.items??models,versions:versions.items??versions,deployments:deployments.items??deployments,policies:policies.items??policies};this.onState({type:'discovery',...result});return result;}
  async loadJob(jobId){if(!this.readApi)throw Error('AI read API not configured');const job=await this.readApi.job(jobId);this.onState({type:'job',job});return job;}
  prepareRequest({modelVersionId,workloadClass,privateInput,privacyPolicyId,verificationProfileId,maxSpend,deadline,jobId=randomBytes32()}){
    if(!this.config.features.requestCreation)throw Error('request creation disabled until deployment materialization');
    if(typeof privateInput!=='string'||!privateInput.length)throw Error('private input required');
    const inputCommitment=keccak256(privateInput);const intent=Object.freeze({jobId,modelVersionId,workloadClass,inputCommitment,privacyPolicyId,verificationProfileId,maxSpend:String(maxSpend),deadline:String(deadline)});
    this.pending={kind:'CREATE',intent,data:encodeCreateRequest420(intent)};this.onState({type:'review',kind:'CREATE',intent});return this.pending;
  }
  prepareCancel(jobId){if(!this.config.features.requestCancellation)throw Error('request cancellation disabled until deployment materialization');const intent=Object.freeze({jobId});this.pending={kind:'CANCEL',intent,data:encodeCancel420(jobId)};this.onState({type:'review',kind:'CANCEL',intent});return this.pending;}
  prepareDispute(jobId,disputeRef){if(!this.config.features.disputeOpening)throw Error('dispute opening disabled until deployment materialization');const intent=Object.freeze({jobId,disputeRef});this.pending={kind:'DISPUTE',intent,data:encodeOpenDispute420(jobId,disputeRef)};this.onState({type:'review',kind:'DISPUTE',intent});return this.pending;}
  clearReview(){this.pending=null;this.onState({type:'review-cleared'});}
  async submitReviewed(){
    if(!this.pending)throw Error('no reviewed transaction');if(!this.wallet?.account)throw Error('wallet not connected');
    const frozen=this.pending;this.pending=null;
    const result=await submitReviewedAiTransaction420({wallet:this.wallet,to:this.config.contracts.jobManager,data:frozen.data,policy:this.config.transactions,onState:(state)=>this.onState({type:'transaction',kind:frozen.kind,...state})});
    this.onState({type:'transaction-confirmed',kind:frozen.kind,result});
    if(frozen.intent.jobId&&this.readApi){try{await this.loadJob(frozen.intent.jobId);}catch{}}
    return result;
  }
  dispose(){this.disposeWallet?.();this.wallet?.dispose();this.wallet=null;this.pending=null;}
}
