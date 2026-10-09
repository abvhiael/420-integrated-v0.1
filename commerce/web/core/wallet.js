import {Interface,keccak256,toUtf8Bytes} from 'ethers';
export const writeABIs={
  MerchantRegistry420:['function register(bytes32,bytes32,bytes32,address)'],
  ListingRegistry420:['function createListing(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,address,uint256,uint256,uint64)','function reviseListing(bytes32,bytes32,bytes32,bytes32,bytes32,address,uint256,uint256,uint64)']
};
export const stateABIs={MerchantRegistry420:['function merchants(bytes32) view returns(address controller,bytes32 profileId,bytes32 metadataHash,uint8 status,bool active,uint32 payoutVersion)'],ListingRegistry420:['function getListing(bytes32) view returns(tuple(address seller,bytes32 sellerProfileId,bytes32 itemClass,bytes32 assetRef,bytes32 metadataHash,bytes32 policyId,bytes32 saleMechanism,bytes32 settlementAdapterId,address quoteAsset,uint256 unitPrice,uint256 quantity,uint64 expiresAt,uint32 revision,bool active))']};
const registryABI=new Interface(['function component(bytes32) view returns(tuple(bytes32 componentId,address implementation,bytes32 runtimeCodeHash,tuple(uint16 major,uint16 minor,uint16 patch) version,uint8 lifecycle))','function isActive(bytes32) view returns(bool)']);
const versionABI=new Interface(['function protocolVersion() view returns(uint32)']);
const fail=code=>{throw new Error(code);};
export function validateConfig(config) {
  if(!config || config.schema!=='420-commerce-web-v1' || !/^[1-9][0-9]*$/.test(config.chainId) || !config.registry || !config.contracts)fail('Verified deployment configuration is unavailable.');
  const api=new URL(config.apiUrl);if(api.origin!==config.origin || api.pathname!=='/' || api.search || api.hash || api.username || api.password || (api.protocol!=='https:' && !(config.environment==='local'&&api.hostname==='127.0.0.1')))fail('Invalid service origin.');
  const names=['MerchantRegistry420','ListingRegistry420','InventoryReservation420','MarketPolicyRegistry420','OrderRegistry420','PaymentRegistry420','InvoiceRegistry420','MarketPaySettlementAdapter420'];
  const optional=['PaymentRouter420'];
  const supplied=Object.keys(config.contracts);
  if(supplied.length!==names.length && supplied.length!==names.length+1 || supplied.some(name=>![...names,...optional].includes(name)) || names.some(name=>!config.contracts[name]))fail('Invalid contract inventory.');
  if(config.contracts.PaymentRouter420){const router=config.contracts.PaymentRouter420;const expected=keccak256(toUtf8Bytes('420/APP/420PAY/PAYMENT_ROUTER'));if(router.componentId!==expected||!Array.isArray(router.registryVersion)||router.registryVersion.length!==3)fail('Unapproved Pay router identity.');}
  if(config.contracts.PaymentRouter420)names.push('PaymentRouter420');
  for(const binding of [config.registry,...names.map(n=>config.contracts[n])])if(!binding || !/^0x[0-9a-fA-F]{40}$/.test(binding.address) || /^0x0{40}$/.test(binding.address) || !/^0x[0-9a-f]{64}$/.test(binding.codeHash))fail('Missing approved binding.');
  for(const name of names){const b=config.contracts[name];if(b.verified!==true||!/^0x[0-9a-f]+$/.test(b.versionResult)||!b.version)fail('Missing approved version.');if(['MerchantRegistry420','PaymentRegistry420','InvoiceRegistry420'].includes(name)){const component=keccak256(toUtf8Bytes('420/APP/420PAY/'+name.replace('Registry420','').toUpperCase()+'_REGISTRY'));if(b.componentId!==component||!Array.isArray(b.registryVersion)||b.registryVersion.length!==3)fail('Missing canonical Pay identity.');}}
  if(config.arbitration){
    const a=config.arbitration;
    if(a.serviceId!=='420/service/arbitration/v1'||String(a.chainId)!==config.chainId||!Number.isInteger(a.version)||a.version<1||a.version>4294967295)fail('Unapproved Arbitration service.');
    const entries=[a.router,a.dependencies?.policies,a.dependencies?.cases,a.dependencies?.rulings];
    if(entries.some(x=>x?.verified!==true||!/^0x[0-9a-fA-F]{40}$/.test(x.address)||/^0x0{40}$/.test(x.address)||!/^0x[0-9a-f]{64}$/.test(x.codeHash)||/^0x0{64}$/.test(x.codeHash)))fail('Unverified Arbitration contracts.');
    if(new Set(entries.map(x=>x.address.toLowerCase())).size!==4)fail('Arbitration contract aliases.');
    for(const value of [a.manifestHash,a.interfaceHash,a.dependencyRoot])if(!/^0x[0-9a-f]{64}$/.test(value)||/^0x0{64}$/.test(value))fail('Unapproved Arbitration profile.');
  }
  return structuredClone(config);
}
export class WalletSession {
  constructor(provider,config,{onReset=()=>{},now=Date.now}={}) {
    this.provider=provider;this.config=validateConfig(config);this.now=now;this.onReset=onReset;this.epoch=0;this.address=null;this.pending=false;
    this.reset=()=>{this.epoch++;this.address=null;this.onReset();};
    for(const event of ['accountsChanged','chainChanged','disconnect'])provider.on?.(event,this.reset);
  }
  dispose(){for(const event of ['accountsChanged','chainChanged','disconnect'])this.provider.removeListener?.(event,this.reset);this.reset();}
  host(){return {network:{chainIdDecimal:this.config.chainId},contract:name=>this.config.contracts[name]??null};}
  async connect(){const epoch=this.epoch;const accounts=await this.provider.request({method:'eth_requestAccounts'});if(epoch!==this.epoch)fail('Wallet changed while connecting.');if(!Array.isArray(accounts)||!/^0x[0-9a-fA-F]{40}$/.test(accounts[0]??''))fail('Wallet account unavailable.');this.address=accounts[0].toLowerCase();try{await this.verify();}catch(e){this.reset();throw e;}return this.address;}
  async switchChain(){await this.provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x'+BigInt(this.config.chainId).toString(16)}]});this.reset();}
  async verify(){
    const epoch=this.epoch,address=this.address,deadline=this.now()+10000;
    if(!address)fail('Connect Wallet first.');
    const request=async(method,params=[])=>{if(this.now()>deadline||epoch!==this.epoch)fail('Wallet session changed or verification expired.');const result=await this.provider.request({method,params});if(this.now()>deadline||epoch!==this.epoch)fail('Wallet session changed or verification expired.');return result;};
    if(BigInt(await request('eth_chainId'))!==BigInt(this.config.chainId))fail('Wrong network. Switch to the approved chain.');
    const accounts=await request('eth_accounts');if(accounts[0]?.toLowerCase()!==address)fail('Wallet account changed.');
    const block=await request('eth_getBlockByNumber',['finalized',false]);if(!block||!/^0x[0-9a-f]{64}$/.test(block.hash)||Math.abs(this.now()/1000-Number(BigInt(block.timestamp)))>120)fail('Finalized authority is stale or unavailable.');
    const tag={blockHash:block.hash,requireCanonical:true};
    for(const [name,b] of [['Registry',this.config.registry],...Object.entries(this.config.contracts)]){
      const code=await request('eth_getCode',[b.address,tag]);if(code==='0x'||keccak256(code)!==b.codeHash)fail('Contract code does not match the approved manifest.');
      if(name!=='Registry'){
        if((await request('eth_call',[{to:b.address,data:versionABI.encodeFunctionData('protocolVersion')},tag])).toLowerCase()!==b.versionResult)fail('Contract version changed.');
        if(b.componentId){const ref=registryABI.decodeFunctionResult('component',await request('eth_call',[{to:this.config.registry.address,data:registryABI.encodeFunctionData('component',[b.componentId])},tag]))[0];const active=registryABI.decodeFunctionResult('isActive',await request('eth_call',[{to:this.config.registry.address,data:registryABI.encodeFunctionData('isActive',[b.componentId])},tag]))[0];if(ref.componentId!==b.componentId||ref.implementation.toLowerCase()!==b.address.toLowerCase()||ref.runtimeCodeHash!==b.codeHash||!ref.version.every((n,i)=>Number(n)===b.registryVersion[i])||!active)fail('Canonical Registry identity changed.');}
      }
    }
    return {epoch,address,tag,deadline};
  }
  wallet(){const address=this.address;return {address,signMessage:async message=>{if(address!==this.address)fail('Wallet session changed.');await this.verify();const epoch=this.epoch;const result=await this.provider.request({method:'personal_sign',params:['0x'+[...new TextEncoder().encode(message)].map(x=>x.toString(16).padStart(2,'0')).join(''),address]});if(epoch!==this.epoch)fail('Wallet changed while signing.');await this.verify();return result;}};}
  async sendMarketDispute(proposal){
    if(this.pending)fail('A transaction is already awaiting Wallet.');
    this.pending=true;
    try {
      if(!proposal||proposal.executed!==false||proposal.state!=='AWAITING_MARKET_WALLET_SUBMISSION')fail('Invalid dispute handoff.');
      const binding=this.config.contracts.OrderRegistry420;
      if(!binding||proposal.requester!==this.address||!/^0x[0-9a-f]{64}$/.test(proposal.orderId)||!/^0x[0-9a-f]{64}$/.test(proposal.disputeHash))fail('Dispute is not bound to seller and Market.');
      const intent=proposal.intent;
      if(intent?.chainId!==this.config.chainId||intent?.target?.toLowerCase()!==binding.address.toLowerCase()||intent.method!=='disputeOrder'||intent.requiresWalletAuthorization!==true||intent.canonicalAuthority!==false||intent.args?.length!==2||intent.args[0]!==proposal.orderId||intent.args[1]!==proposal.disputeHash)fail('Dispute transaction intent mismatch.');
      const abi=new Interface(['function disputeOrder(bytes32,bytes32)','function getOrder(bytes32) view returns(tuple(bytes32 listingId,uint32 listingRevision,address buyer,address seller,uint256 quantity,address paymentAsset,uint256 totalAmount,bytes32 settlementAdapterId,bytes32 paymentRef,bytes32 fulfillmentHash,bytes32 disputeHash,uint8 status,uint64 createdAt,uint64 updatedAt))']);
      const data=abi.encodeFunctionData('disputeOrder',intent.args);
      const checked=await this.verify();
      const read=abi.encodeFunctionData('getOrder',[proposal.orderId]);
      const raw=await this.provider.request({method:'eth_call',params:[{to:binding.address,data:read},checked.tag]});
      const order=abi.decodeFunctionResult('getOrder',raw)[0];
      if(order.seller.toLowerCase()!==checked.address||![2,3].includes(Number(order.status))||order.disputeHash!=='0x'+'0'.repeat(64))fail('Canonical Market seller or eligibility changed.');
      const tx={from:checked.address,to:binding.address,data,value:'0x0'};
      await this.provider.request({method:'eth_call',params:[tx,checked.tag]});
      if(checked.epoch!==this.epoch)fail('Wallet changed.');
      if(BigInt(await this.provider.request({method:'eth_chainId'}))!==BigInt(this.config.chainId)||(await this.provider.request({method:'eth_accounts'}))[0]?.toLowerCase()!==checked.address)fail('Wallet account or chain changed.');
      if(checked.epoch!==this.epoch)fail('Wallet changed.');
      const hash=await this.provider.request({method:'eth_sendTransaction',params:[tx]});
      if(!/^0x[0-9a-f]{64}$/.test(hash)||checked.epoch!==this.epoch)fail('Dispute submission unverified.');
      return {transactionHash:hash,finalized:false,marketDisputed:false,arbitrationCaseOpened:false};
    } finally {this.pending=false;}
  }
  async send(plan){
    if(this.pending)fail('A transaction is already awaiting Wallet.');this.pending=true;
    try {
      const {intent}=plan,abi=writeABIs[intent?.contract],binding=this.config.contracts[intent?.contract];
      if(!abi||!binding||intent.chainId!==this.config.chainId||intent.target.toLowerCase()!==binding.address.toLowerCase()||intent.requiresWalletAuthorization!==true||intent.canonicalAuthority!==false||plan.controller.toLowerCase()!==this.address||plan.expiresAt<=this.now()||plan.expiresAt>this.now()+60000)fail('Transaction plan is invalid or expired.');
      const iface=new Interface(abi),encoded=iface.encodeFunctionData(intent.method,intent.args);
      if(encoded!==intent.data)fail('Transaction calldata does not match reviewed terms.');
      if(intent.contract==='ListingRegistry420'&&intent.args[intent.method==='createListing'?6:3]!==keccak256(toUtf8Bytes('420/MARKET/SALE/FIXED_PRICE/V1')))fail('Unsupported sale mechanism.');
      const checked=await this.verify(),tx={from:this.address,to:binding.address,data:encoded,value:'0x0'};
      const state=new Interface(stateABIs[intent.contract]),getter=intent.contract==='MerchantRegistry420'?'merchants':'getListing';
      const row=state.decodeFunctionResult(getter,await this.provider.request({method:'eth_call',params:[{to:binding.address,data:state.encodeFunctionData(getter,[intent.args[0]])},checked.tag]}));
      if(intent.method==='register'){if(row.controller.toLowerCase()!=='0x0000000000000000000000000000000000000000')fail('Merchant identity changed after review.');}
      else {const listing=row[0];if(intent.method==='createListing'){if(listing.seller.toLowerCase()!=='0x0000000000000000000000000000000000000000')fail('Listing was created after review.');}else if(listing.seller.toLowerCase()!==checked.address||Number(listing.revision)+1!==plan.revision||listing.quantity.toString()!==String(intent.args[7]))fail('Listing revision or seller changed after review.');}
      await this.provider.request({method:'eth_call',params:[tx,checked.tag]});
      if(checked.epoch!==this.epoch||plan.expiresAt<=this.now())fail('Transaction plan expired or Wallet changed.');
      // Recheck chain/account immediately after simulation, before explicit send.
      if(BigInt(await this.provider.request({method:'eth_chainId'}))!==BigInt(this.config.chainId)||(await this.provider.request({method:'eth_accounts'}))[0]?.toLowerCase()!==this.address)fail('Wallet network or account changed.');
      if(checked.epoch!==this.epoch||checked.address!==this.address||plan.expiresAt<=this.now())fail('Wallet session changed or plan expired.');
      const hash=await this.provider.request({method:'eth_sendTransaction',params:[tx]});if(checked.epoch!==this.epoch)fail('Wallet changed while sending.');if(!/^0x[0-9a-f]{64}$/.test(hash))fail('Invalid transaction response.');return hash;
    } finally {this.pending=false;}
  }
}
