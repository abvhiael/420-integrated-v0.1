import { WalletController } from './wallet-session.js';
import { discoverWalletProviders, selectWalletProvider, verifyWalletSnapshot } from './wallet-compatibility.js';
import { preflightExchangeTransaction } from './preflight.js';
import { submitPreflightedTransaction, signQualifiedLimitOrder } from './wallet-execution.js';

export class BrowserExecutionError extends Error {
  constructor(code, message) { super(message); this.name='BrowserExecutionError'; this.code=code; }
}

// UI code must bind a verified runtime, never infer execution inputs from V14 display/fixture amounts.
export function assertExecutableRuntime(runtime) {
  if (runtime?.deployment?.status !== 'RESOLVED' || runtime?.deployment?.environment !== 'testnet' || !runtime?.network?.chainId) {
    throw new BrowserExecutionError('DEPLOYMENT_UNRESOLVED', 'A verified testnet deployment is required before signing or submission');
  }
  return runtime;
}

export class BrowserExecutionController {
  constructor({runtime=null, onInvalidate=()=>{}, onState=()=>{}}={}) {
    this.runtime=runtime;
    this.onInvalidate=onInvalidate;
    this.onState=onState;
    this.announcements=[];
    this.wallet=null;
    this.selection=null;
    this.generation=0;
    this.listeners=[];
    this.disposed=false;
  }
  discover(ethereum=null) { return discoverWalletProviders({ethereum,announcements:this.announcements}); }
  announce(detail) { if(this.disposed) return; if(detail?.provider && detail?.info) this.announcements.push(detail); }
  listen(target, ethereum=null) {
    if(this.disposed) throw new BrowserExecutionError('DISPOSED','controller disposed');
    if(!target?.addEventListener || !target?.removeEventListener) throw new BrowserExecutionError('EVENT_TARGET_REQUIRED','browser event target required');
    const receive=event=>{this.announce(event?.detail);this.onState({type:'wallets-discovered',candidates:this.discover(ethereum)});};
    target.addEventListener('eip6963:announceProvider',receive);
    this.listeners.push(()=>target.removeEventListener('eip6963:announceProvider',receive));
    if(typeof target.dispatchEvent==='function' && typeof Event==='function') target.dispatchEvent(new Event('eip6963:requestProvider'));
    return this.discover(ethereum);
  }
  unbind() { for(const off of this.listeners.splice(0)) off(); this.wallet=null; this.selection=null; this.generation++; }
  async connect({ethereum=null,selectedId=null}={}) {
    if(this.disposed) throw new BrowserExecutionError('DISPOSED','controller disposed');
    const selected=selectWalletProvider(this.discover(ethereum),{selectedId});
    this.unbind();
    const epoch=this.generation;
    const wallet=new WalletController(selected.provider,{expectedChainId:this.runtime?.network?.chainId??null});
    this.wallet=wallet;this.selection=selected;
    const invalidate=reason=>{if(this.disposed||this.wallet!==wallet)return;this.generation++;this.onInvalidate(reason);this.onState({type:'wallet-invalidated',reason});};
    for(const [event,change] of [
      ['accountsChanged',accounts=>wallet.session.accountChanged(accounts?.[0]??null)],
      ['chainChanged',chainId=>wallet.session.chainChanged(chainId,this.runtime?.network?.chainId)],
      ['disconnect',()=>wallet.session.disconnected()],
    ]) {
      const handler=payload=>{try{change(payload);}catch{wallet.session.disconnected();}invalidate(event);};
      selected.provider.on?.(event,handler);
      this.listeners.push(()=>selected.provider.removeListener?.(event,handler));
    }
    try {
      await wallet.connect();
      if(this.disposed||epoch!==this.generation||this.wallet!==wallet) throw new BrowserExecutionError('STALE_CONNECT','wallet changed during connection');
      this.onState({type:'wallet-connected',account:wallet.session.account,chainId:wallet.session.chainId});
      return wallet.session;
    } catch(error) { if(this.wallet===wallet) this.unbind(); throw error; }
  }
  async assertLiveSession() {
    if(this.disposed||!this.wallet) throw new BrowserExecutionError('WALLET_UNAVAILABLE','connect a wallet');
    const wallet=this.wallet, generation=wallet.session.generation, epoch=this.generation;
    const [chainId,accounts]=await Promise.all([
      wallet.provider.request({method:'eth_chainId'}),wallet.provider.request({method:'eth_accounts'}),
    ]);
    if(this.wallet!==wallet||epoch!==this.generation) throw new BrowserExecutionError('STALE_SESSION','wallet changed while checking state');
    const check=verifyWalletSnapshot({session:wallet.session,chainId,accounts,generation});
    if(!check.ok) throw new BrowserExecutionError(check.reason,'wallet changed since review');
    if(wallet.session.chainId!==assertExecutableRuntime(this.runtime).network.chainId.toLowerCase()) {
      throw new BrowserExecutionError('CHAIN_MISMATCH','wallet is on the wrong network');
    }
    return {wallet,session:wallet.session,generation};
  }
  async submit({transaction,reviewedIntent,allowanceChecks=[],authorizationChecks=[],staticCalls=[],freshness}={}) {
    const {wallet,session,generation}=await this.assertLiveSession();
    if(!transaction||!reviewedIntent||!freshness) throw new BrowserExecutionError('REVIEW_REQUIRED','canonical transaction, review and freshness inputs required');
    const preflight=await preflightExchangeTransaction({provider:wallet.provider,runtime:this.runtime,account:session.account,transaction,reviewedIntent,allowanceChecks,authorizationChecks,staticCalls,freshness});
    if(this.wallet!==wallet||generation!==wallet.session.generation) throw new BrowserExecutionError('STALE_SESSION','wallet changed during preflight');
    if(!preflight.ok) throw new BrowserExecutionError('PREFLIGHT_FAILED','transaction failed preflight');
    return submitPreflightedTransaction({provider:wallet.provider,session,expectedChainId:this.runtime.network.chainId,expectedGeneration:generation,transaction,preflight});
  }
  async signOrder({signingRequest,qualification}={}) {
    const {wallet,session,generation}=await this.assertLiveSession();
    if(!signingRequest||!qualification?.ok) throw new BrowserExecutionError('QUALIFICATION_REQUIRED','qualified canonical order required');
    return signQualifiedLimitOrder({provider:wallet.provider,session,expectedChainId:this.runtime.network.chainId,expectedGeneration:generation,signingRequest,qualification});
  }
  dispose() {this.disposed=true;this.unbind();this.announcements=[];}
}
