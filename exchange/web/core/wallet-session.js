export const SESSION_STATES=Object.freeze(['DISCONNECTED','CONNECTING','CONNECTED','WRONG_CHAIN','ERROR']);

function required(value,label){
  if(value===null||value===undefined||value==='') throw new Error(`missing ${label}`);
  return value;
}

export function normalizeChainId(value){
  if(typeof value==='number'){
    if(!Number.isInteger(value)||value<0) throw new Error('invalid chainId');
    return '0x'+value.toString(16);
  }
  if(typeof value!=='string') throw new Error('invalid chainId');
  const trimmed=value.trim().toLowerCase();
  if(!/^0x[0-9a-f]+$/.test(trimmed)) throw new Error('invalid chainId');
  return '0x'+BigInt(trimmed).toString(16);
}

export function normalizeAccount(value){
  if(typeof value!=='string'||!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error('invalid account');
  return value.toLowerCase();
}

export function validateNetwork(session,expectedChainId){
  if(!expectedChainId) return {ok:false,reason:'chain-unconfigured'};
  const expected=normalizeChainId(expectedChainId);
  if(!session?.chainId) return {ok:false,reason:'chain-unavailable'};
  const actual=normalizeChainId(session.chainId);
  return actual===expected?{ok:true,reason:null}:{ok:false,reason:'chain-mismatch'};
}

export class WalletSession {
  constructor(){
    this.status='DISCONNECTED';
    this.account=null;
    this.chainId=null;
    this.providerKind=null;
    this.error=null;
    this.generation=0;
  }
  connecting(){ this.status='CONNECTING'; this.error=null; }
  connected({account,chainId,providerKind='eip1193'}){
    this.account=normalizeAccount(account);
    this.chainId=normalizeChainId(chainId);
    this.providerKind=providerKind;
    this.status='CONNECTED';
    this.error=null;
    this.generation+=1;
  }
  wrongChain(chainId){
    this.chainId=normalizeChainId(chainId);
    this.status='WRONG_CHAIN';
    this.generation+=1;
  }
  accountChanged(account){
    this.account=account?normalizeAccount(account):null;
    this.status=this.account?'CONNECTED':'DISCONNECTED';
    this.generation+=1;
  }
  chainChanged(chainId,expectedChainId){
    this.chainId=normalizeChainId(chainId);
    this.status=validateNetwork(this,expectedChainId).ok?'CONNECTED':'WRONG_CHAIN';
    this.generation+=1;
  }
  disconnected(){
    this.status='DISCONNECTED';
    this.account=null;
    this.chainId=null;
    this.providerKind=null;
    this.generation+=1;
  }
  failed(error){ this.status='ERROR'; this.error=String(error??'wallet error'); this.generation+=1; }
}

export class WalletController {
  constructor(provider,{expectedChainId=null}={}){
    if(!provider||typeof provider.request!=='function') throw new Error('EIP-1193 provider required');
    this.provider=provider;
    this.expectedChainId=expectedChainId;
    this.session=new WalletSession();
  }
  async connect(){
    this.session.connecting();
    try{
      const accounts=await this.provider.request({method:'eth_requestAccounts'});
      const chainId=await this.provider.request({method:'eth_chainId'});
      const account=accounts?.[0];
      this.session.connected({account,chainId});
      const gate=validateNetwork(this.session,this.expectedChainId);
      if(!gate.ok && gate.reason==='chain-mismatch') this.session.wrongChain(chainId);
      return this.session;
    }catch(error){
      this.session.failed(error);
      throw error;
    }
  }
  async switchChain(){
    const chainId=normalizeChainId(required(this.expectedChainId,'expectedChainId'));
    await this.provider.request({method:'wallet_switchEthereumChain',params:[{chainId}]});
    this.session.chainChanged(chainId,chainId);
    return this.session;
  }
  bind({onInvalidate}={}){
    if(typeof this.provider.on!=='function') return;
    this.provider.on('accountsChanged',(accounts)=>{
      this.session.accountChanged(accounts?.[0]??null);
      onInvalidate?.('account-change');
    });
    this.provider.on('chainChanged',(chainId)=>{
      this.session.chainChanged(chainId,this.expectedChainId);
      onInvalidate?.('chain-change');
    });
    this.provider.on('disconnect',()=>{
      this.session.disconnected();
      onInvalidate?.('disconnect');
    });
  }
}

export function signingGate({session,expectedChainId,intent,intentGeneration}){
  if(!session||session.status!=='CONNECTED'||!session.account) return {ok:false,reason:'wallet-disconnected'};
  const network=validateNetwork(session,expectedChainId);
  if(!network.ok) return network;
  if(!intent) return {ok:false,reason:'missing-review'};
  if(intentGeneration!==session.generation) return {ok:false,reason:'stale-draft'};
  return {ok:true,reason:null};
}

export function buildSigningRequest({session,expectedChainId,intent,intentGeneration,kind}){
  const gate=signingGate({session,expectedChainId,intent,intentGeneration});
  if(!gate.ok) throw new Error(`signing unavailable: ${gate.reason}`);
  if(!['SWAP','LIMIT_ORDER','BRIDGE','ORDER_CANCEL'].includes(kind)) throw new Error('unsupported signing kind');
  return Object.freeze({
    kind,
    account:session.account,
    chainId:normalizeChainId(expectedChainId),
    generation:session.generation,
    intent,
  });
}
