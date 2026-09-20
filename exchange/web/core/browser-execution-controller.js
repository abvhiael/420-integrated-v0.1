import { WalletController, normalizeAccount, normalizeChainId } from './wallet-session.js';
import { discoverWalletProviders, selectWalletProvider, verifyWalletSnapshot } from './wallet-compatibility.js';
import { preflightExchangeTransaction, transactionFingerprint } from './preflight.js';
import { submitPreflightedTransaction, signQualifiedLimitOrder } from './wallet-execution.js';

export class BrowserExecutionError extends Error {
  constructor(code, message) { super(message); this.name='BrowserExecutionError'; this.code=code; }
}

// Browser display fixtures are never an authority to construct executable transactions.
export function assertExecutableRuntime(runtime) {
  if (runtime?.deployment?.status !== 'RESOLVED' || runtime?.deployment?.environment !== 'testnet' || !runtime?.network?.chainId) {
    throw new BrowserExecutionError('DEPLOYMENT_UNRESOLVED', 'A verified testnet deployment is required before signing or submission');
  }
  return runtime;
}

export class BrowserExecutionController {
  constructor({runtime=null,onInvalidate=()=>{},onState=()=>{}}={}) {
    this.runtime=runtime;
    this.onInvalidate=onInvalidate;
    this.onState=onState;
    this.announcements=[];
    this.wallet=null;
    this.selection=null;
    this.generation=0;
    this.providerListeners=[];
    this.discoveryListeners=[];
    this.disposed=false;
  }
  discover(ethereum=null) { return discoverWalletProviders({ethereum,announcements:this.announcements}); }
  announce(detail) {
    if(this.disposed || !detail?.provider || !detail?.info) return;
    const index=this.announcements.findIndex(candidate=>candidate.info?.uuid===detail.info.uuid);
    if(index<0) this.announcements.push(detail);
    else this.announcements[index]=detail;
  }
  listen(target,ethereum=null) {
    if(this.disposed) throw new BrowserExecutionError('DISPOSED','controller disposed');
    if(!target?.addEventListener || !target?.removeEventListener) throw new BrowserExecutionError('EVENT_TARGET_REQUIRED','browser event target required');
    const receive=event=>{this.announce(event?.detail);this.onState({type:'wallets-discovered',candidates:this.discover(ethereum)});};
    target.addEventListener('eip6963:announceProvider',receive);
    this.discoveryListeners.push(()=>target.removeEventListener('eip6963:announceProvider',receive));
    if(typeof target.dispatchEvent==='function' && typeof Event==='function') target.dispatchEvent(new Event('eip6963:requestProvider'));
    return this.discover(ethereum);
  }
  unbind() {
    for(const off of this.providerListeners.splice(0)) off();
    // The prior wallet must not finish an in-flight request or retain a connected
    // session after its provider is superseded by the selected V15 provider.
    this.wallet?.dispose();
    this.wallet=null;this.selection=null;this.generation++;
  }
  async connect({ethereum=null,selectedId=null}={}) {
    if(this.disposed) throw new BrowserExecutionError('DISPOSED','controller disposed');
    const selected=selectWalletProvider(this.discover(ethereum),{selectedId});
    this.unbind();
    const epoch=this.generation;
    const wallet=new WalletController(selected.provider,{expectedChainId:this.runtime?.network?.chainId??null});
    this.wallet=wallet;this.selection=selected;
    const invalidate=reason=>{
      if(this.disposed||this.wallet!==wallet)return;
      this.generation++;this.onInvalidate(reason);this.onState({type:'wallet-invalidated',reason});
    };
    for(const [event,change] of [
      ['accountsChanged',accounts=>wallet.session.accountChanged(accounts?.[0]??null)],
      ['chainChanged',chainId=>wallet.session.chainChanged(chainId,this.runtime?.network?.chainId)],
      ['disconnect',()=>wallet.session.disconnected()],
    ]) {
      const handler=payload=>{try{change(payload);}catch{wallet.session.disconnected();}invalidate(event);};
      selected.provider.on?.(event,handler);
      this.providerListeners.push(()=>selected.provider.removeListener?.(event,handler));
    }
    try {
      await wallet.connect();
      if(this.disposed||epoch!==this.generation||this.wallet!==wallet) throw new BrowserExecutionError('STALE_CONNECT','wallet changed during connection');
      this.onState({type:'wallet-connected',account:wallet.session.account,chainId:wallet.session.chainId});
      return wallet.session;
    } catch(error) {if(this.wallet===wallet)this.unbind();throw error;}
  }
  async assertLiveSession() {
    if(this.disposed||!this.wallet) throw new BrowserExecutionError('WALLET_UNAVAILABLE','connect a wallet');
    const wallet=this.wallet,generation=wallet.session.generation,epoch=this.generation;
    const [chainId,accounts]=await Promise.all([
      wallet.provider.request({method:'eth_chainId'}),wallet.provider.request({method:'eth_accounts'}),
    ]);
    if(this.wallet!==wallet||epoch!==this.generation) throw new BrowserExecutionError('STALE_SESSION','wallet changed while checking state');
    const check=verifyWalletSnapshot({session:wallet.session,chainId,accounts,generation});
    if(!check.ok) throw new BrowserExecutionError(check.reason,'wallet changed since review');
    if(normalizeChainId(wallet.session.chainId)!==normalizeChainId(assertExecutableRuntime(this.runtime).network.chainId)) {
      throw new BrowserExecutionError('CHAIN_MISMATCH','wallet is on the wrong network');
    }
    return {wallet,session:wallet.session,generation,epoch};
  }
  assertUnchanged(wallet,generation,epoch) {
    if(this.disposed||this.wallet!==wallet||this.generation!==epoch||wallet.session.generation!==generation) {
      throw new BrowserExecutionError('STALE_SESSION','wallet changed during review or preflight');
    }
  }
  async submit({transaction,reviewedIntent,allowanceChecks=[],authorizationChecks=[],staticCalls=[],freshness}={}) {
    const {wallet,session,generation,epoch}=await this.assertLiveSession();
    if(!transaction?.request||!reviewedIntent||!freshness) throw new BrowserExecutionError('REVIEW_REQUIRED','canonical transaction, review and freshness inputs required');
    if(transaction.kind!==reviewedIntent.kind || normalizeAccount(transaction.request.from)!==normalizeAccount(session.account) || reviewedIntent.transactionFingerprint!==transactionFingerprint(transaction)) {
      throw new BrowserExecutionError('REVIEW_MISMATCH','review must identify the exact transaction being submitted');
    }
    const preflight=await preflightExchangeTransaction({provider:wallet.provider,runtime:this.runtime,transaction,allowanceChecks,authorizationChecks,staticCalls,freshness});
    this.assertUnchanged(wallet,generation,epoch);
    if(!preflight.ok) throw new BrowserExecutionError('PREFLIGHT_FAILED','transaction failed preflight');
    return submitPreflightedTransaction({provider:wallet.provider,session,expectedChainId:this.runtime.network.chainId,expectedGeneration:generation,transaction,preflight});
  }
  async signOrder({signingRequest,qualification}={}) {
    const {wallet,session,generation,epoch}=await this.assertLiveSession();
    if(!signingRequest||!qualification?.ok) throw new BrowserExecutionError('QUALIFICATION_REQUIRED','qualified canonical order required');
    this.assertUnchanged(wallet,generation,epoch);
    return signQualifiedLimitOrder({provider:wallet.provider,session,expectedChainId:this.runtime.network.chainId,expectedGeneration:generation,signingRequest,qualification});
  }
  dispose() {
    if(this.disposed)return;
    this.disposed=true;this.unbind();
    for(const off of this.discoveryListeners.splice(0))off();
    this.announcements=[];
  }
}
