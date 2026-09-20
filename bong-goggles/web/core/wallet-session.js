const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HEX_CHAIN=/^0x[0-9a-fA-F]+$/;
const SESSION_STORAGE_KEYS=Object.freeze([
  'bg.wallet.account',
  'bg.wallet.chainId',
  'bg.wallet.session',
  'bg.wallet.capabilities'
]);

function normalizeAddress(value){
  if(typeof value!=='string'||!ADDRESS.test(value)) throw new Error('valid wallet account required');
  return value.toLowerCase();
}

export function normalizeChainId(value){
  if(typeof value==='string'&&HEX_CHAIN.test(value)) return `0x${BigInt(value).toString(16)}`;
  try{
    const parsed=BigInt(value);
    if(parsed<=0n) throw new Error();
    return `0x${parsed.toString(16)}`;
  }catch{
    throw new Error('valid chain id required');
  }
}

export function discover420Wallet(windowObject=globalThis.window){
  const provider=windowObject?.ethereum;
  if(!provider||provider.is420Wallet!==true||typeof provider.request!=='function') return null;
  return provider;
}

export function buildWalletHandoffUrl(walletUrl,{action='connect',returnUrl}={}){
  const allowed=new Set(['connect','passkeys','sessions']);
  if(!allowed.has(action)) throw new Error('unsupported Wallet handoff action');
  const wallet=new URL(walletUrl);
  if(wallet.protocol!=='https:') throw new Error('Wallet handoff must use https');
  const target=new URL(returnUrl);
  if(target.protocol!=='https:' && !['localhost','127.0.0.1','::1'].includes(target.hostname)){
    throw new Error('returnUrl must be secure');
  }
  wallet.pathname='/apps/bong-goggles';
  wallet.search='';
  wallet.searchParams.set('action',action);
  wallet.searchParams.set('return',target.toString());
  return wallet.toString();
}

export function clearBongGogglesSessionStorage(storage){
  if(!storage||typeof storage.removeItem!=='function') return;
  for(const key of SESSION_STORAGE_KEYS) storage.removeItem(key);
}

export function sessionPresentation({account=null,chainId=null,expectedChainId,connected=false,permission='read-only',session=null}={}){
  const expected=normalizeChainId(expectedChainId);
  const active=chainId==null?null:normalizeChainId(chainId);
  const supported=active===null||active===expected;
  const normalizedAccount=account==null?null:normalizeAddress(account);
  const expired=Boolean(session?.expiresAt && Date.now()>=Number(session.expiresAt));
  const revoked=session?.revoked===true;
  return Object.freeze({
    account:normalizedAccount,
    chainId:active,
    expectedChainId:expected,
    connected:Boolean(connected&&normalizedAccount),
    supportedNetwork:supported,
    permission:expired||revoked?'read-only':permission,
    sessionState:revoked?'revoked':expired?'expired':session?'active':'none',
    canWrite:Boolean(connected&&normalizedAccount&&supported&&!expired&&!revoked&&permission!=='read-only'),
    authoritative:false,
  });
}

export class WalletSessionController420 {
  constructor({provider,expectedChainId,storage=globalThis.sessionStorage,onChange=()=>{}}={}){
    if(!provider||typeof provider.request!=='function') throw new Error('420 Wallet EIP-1193 provider required');
    this.provider=provider;
    this.expectedChainId=normalizeChainId(expectedChainId);
    this.storage=storage;
    this.onChange=onChange;
    this.accounts=[];
    this.chainId=null;
    this.connected=false;
    this.destroyed=false;
    this.handleAccounts=this.handleAccounts.bind(this);
    this.handleChain=this.handleChain.bind(this);
    this.handleDisconnect=this.handleDisconnect.bind(this);
    provider.on?.('accountsChanged',this.handleAccounts);
    provider.on?.('chainChanged',this.handleChain);
    provider.on?.('disconnect',this.handleDisconnect);
  }

  async snapshot(){
    const [accounts,chainId]=await Promise.all([
      this.provider.request({method:'eth_accounts',params:[]}),
      this.provider.request({method:'eth_chainId',params:[]}),
    ]);
    this.accounts=Array.isArray(accounts)?accounts.map(normalizeAddress):[];
    this.chainId=normalizeChainId(chainId);
    this.connected=this.accounts.length>0;
    return this.emit();
  }

  async connect(){
    const accounts=await this.provider.request({method:'eth_requestAccounts',params:[]});
    this.accounts=Array.isArray(accounts)?accounts.map(normalizeAddress):[];
    this.chainId=normalizeChainId(await this.provider.request({method:'eth_chainId',params:[]}));
    this.connected=this.accounts.length>0;
    return this.emit();
  }

  async requestSupportedNetwork(){
    if(this.chainId===this.expectedChainId) return this.emit();
    try{
      await this.provider.request({method:'wallet_switchEthereumChain',params:[{chainId:this.expectedChainId}]});
    }catch(error){
      if(error?.code===4200) throw new Error('420 Wallet does not permit network switching from this application');
      throw error;
    }
    this.chainId=normalizeChainId(await this.provider.request({method:'eth_chainId',params:[]}));
    return this.emit();
  }

  async signOut(){
    try{
      await this.provider.request({method:'wallet_revokePermissions',params:[{eth_accounts:{}}]});
    }catch(error){
      if(![4200,-32601].includes(error?.code)) throw error;
    }
    this.accounts=[];
    this.connected=false;
    clearBongGogglesSessionStorage(this.storage);
    return this.emit();
  }

  handleAccounts(accounts){
    this.accounts=Array.isArray(accounts)?accounts.map(normalizeAddress):[];
    this.connected=this.accounts.length>0;
    this.emit();
  }

  handleChain(chainId){
    this.chainId=normalizeChainId(chainId);
    this.emit();
  }

  handleDisconnect(){
    this.accounts=[];
    this.connected=false;
    clearBongGogglesSessionStorage(this.storage);
    this.emit();
  }

  emit(){
    const value=sessionPresentation({
      account:this.accounts[0]??null,
      chainId:this.chainId,
      expectedChainId:this.expectedChainId,
      connected:this.connected,
      permission:this.connected?'wallet-confirmed':'read-only',
    });
    this.onChange(value);
    return value;
  }

  destroy(){
    if(this.destroyed) return;
    this.destroyed=true;
    this.provider.removeListener?.('accountsChanged',this.handleAccounts);
    this.provider.removeListener?.('chainChanged',this.handleChain);
    this.provider.removeListener?.('disconnect',this.handleDisconnect);
  }
}
