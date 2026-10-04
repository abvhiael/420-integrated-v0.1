export class AiWalletSession420{
  constructor(provider){if(!provider||typeof provider.request!=='function')throw Error('EIP-1193 wallet required');this.provider=provider;this.account=null;this.chainId=null;this.listeners=[];}
  async connect(expectedChainId){
    const accounts=await this.provider.request({method:'eth_requestAccounts'});
    const chainId=String(await this.provider.request({method:'eth_chainId'})).toLowerCase();
    const account=accounts?.[0]?.toLowerCase();
    if(!/^0x[0-9a-f]{40}$/.test(account??''))throw Error('wallet returned no valid account');
    if(expectedChainId&&chainId!==expectedChainId.toLowerCase())throw Error('wrong network: expected '+expectedChainId+', received '+chainId);
    this.account=account;this.chainId=chainId;return Object.freeze({account,chainId});
  }
  installInvalidation(onInvalidate){
    const invalidate=(reason)=>{this.account=null;this.chainId=null;onInvalidate(reason);};
    for(const event of ['accountsChanged','chainChanged','disconnect']){
      if(typeof this.provider.on==='function'){const fn=()=>invalidate(event);this.provider.on(event,fn);this.listeners.push([event,fn]);}
    }
    return ()=>this.dispose();
  }
  async sendTransaction(tx){if(!this.account)throw Error('wallet not connected');return this.provider.request({method:'eth_sendTransaction',params:[{from:this.account,...tx}]});}
  async estimateGas(tx){if(!this.account)throw Error('wallet not connected');return this.provider.request({method:'eth_estimateGas',params:[{from:this.account,...tx}]});}
  dispose(){if(typeof this.provider.removeListener==='function')for(const [e,fn] of this.listeners)this.provider.removeListener(e,fn);this.listeners=[];this.account=null;this.chainId=null;}
}
