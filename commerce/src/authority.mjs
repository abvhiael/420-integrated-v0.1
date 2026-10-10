import { JsonRpcProvider, FetchRequest, Interface, keccak256, toUtf8Bytes, hashMessage } from 'ethers';
import { Fault, requireThat, bytes32, wallet } from './security.mjs';
import {validateArbitrationBinding,finalizedArbitrationBinding} from './arbitration.mjs';
import {validateDisplayBindings,optionalMerchantDisplay} from './identity-names.mjs';

export const ABIS = {
  MerchantRegistry420: ['function register(bytes32,bytes32,bytes32,address)', 'function merchants(bytes32) view returns (address controller,bytes32 profileId,bytes32 metadataHash,uint8 status,bool active,uint32 payoutVersion)', 'function currentPayout(bytes32) view returns(address,uint32,bytes32)'],
  ListingRegistry420: ['function createListing(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,address,uint256,uint256,uint64)', 'function reviseListing(bytes32,bytes32,bytes32,bytes32,bytes32,address,uint256,uint256,uint64)', 'function getListing(bytes32) view returns(tuple(address seller,bytes32 sellerProfileId,bytes32 itemClass,bytes32 assetRef,bytes32 metadataHash,bytes32 policyId,bytes32 saleMechanism,bytes32 settlementAdapterId,address quoteAsset,uint256 unitPrice,uint256 quantity,uint64 expiresAt,uint32 revision,bool active))'],
  InventoryReservation420: ['function available(bytes32) view returns(uint256)', 'function inventory(bytes32) view returns(uint256 originalOffered,uint256 reserved,uint256 sold,uint256 released,bool initialized)', 'function listingRegistry() view returns(address)', 'function orderRegistry() view returns(address)'],
  MarketPolicyRegistry420: ['function policyActive(bytes32) view returns(bool)', 'function settlementAdapterActive(bytes32) view returns(bool)', 'function isSettlementReporter(bytes32,address) view returns(bool)'],
  OrderRegistry420: ['function getOrder(bytes32) view returns(tuple(bytes32 listingId,uint32 listingRevision,address buyer,address seller,uint256 quantity,address paymentAsset,uint256 totalAmount,bytes32 settlementAdapterId,bytes32 paymentRef,bytes32 fulfillmentHash,bytes32 disputeHash,uint8 status,uint64 createdAt,uint64 updatedAt))', 'function createOrder(bytes32,bytes32,uint32,uint256,address,uint256)', 'function listingRegistry() view returns(address)', 'function policyRegistry() view returns(address)', 'function inventoryReservation() view returns(address)'],
  PaymentRegistry420: ['function getPayment(bytes32) view returns(tuple(bytes32 invoiceId,address payer,address merchant,address inputAsset,uint256 inputAmount,address settlementAsset,uint256 settlementAmount,bytes32 quoteId,uint256 payerNonce,bytes32 receiptHash,uint256 tipAmount,uint256 refundedAmount,uint8 status))'],
  InvoiceRegistry420: ['function getInvoice(bytes32) view returns(tuple(bytes32 merchantId,address merchant,bytes32 metadataHash,bytes3 currency,uint256 amount,uint64 expiresAt,uint64 refundUntil,uint8 mode,uint8 acceptance,bool partialPayments,uint16 quoteMaxSlippageBps,bytes32 acceptedAssetsHash,bytes32 settlementPlanHash,bytes32 tipPolicyHash,bool active))', 'function paidAmount(bytes32) view returns(uint256)', 'function isClosed(bytes32) view returns(bool)'],
  MarketPaySettlementAdapter420: ['function invoiceIdForOrder(bytes32) view returns(bytes32)', 'function orderPayment(bytes32) view returns(bytes32)', 'function refundReported(bytes32) view returns(bool)', 'function orders() view returns(address)', 'function payments() view returns(address)', 'function invoices() view returns(address)', 'function merchants() view returns(address)', 'function deploymentChainId() view returns(uint256)'],
};
const refundReadABI=['function fundedRefundExecuted(bytes32) view returns(bool)','function refunds(bytes32) view returns(bytes32 paymentId,address settlementAsset,address recipient,uint256 amount,bytes32 reasonHash,uint64 createdAt)'];
const registryABI = ['function component(bytes32) view returns(tuple(bytes32 componentId,address implementation,bytes32 runtimeCodeHash,tuple(uint16 major,uint16 minor,uint16 patch) version,uint8 lifecycle))', 'function isActive(bytes32) view returns(bool)'];
export const payComponents = Object.fromEntries(['Merchant','Payment','Invoice'].map(name => [name+'Registry420',keccak256(toUtf8Bytes('420/APP/420PAY/'+name.toUpperCase()+'_REGISTRY'))]));
payComponents.RefundManager420=keccak256(toUtf8Bytes('420/APP/420PAY/REFUND_MANAGER'));
export const orderStates = ['NONE','CREATED','PAID','FULFILLED','COMPLETED','CANCELLED','DISPUTED','REFUNDED'];
const record = result => Object.fromEntries(Object.keys(result.toObject()).map(key => [key, typeof result[key] === 'bigint' ? result[key].toString() : result[key]]));

// Inputs are an operator-approved, SHA-pinned deployment manifest, never API
// request addresses. Every sensitive operation revalidates finalized Registry,
// code, version, chain and immutable wiring. No fallback to latest or projections.
export class RpcAuthority {
  constructor(config, { rpc, now = Date.now } = {}) {
    requireThat(config && /^[1-9][0-9]*$/.test(config.chainId), 'invalid_chain');
    requireThat(new URL(config.rpcUrl).protocol === 'https:' || (config.environment === 'local' && new URL(config.rpcUrl).hostname === '127.0.0.1'), 'insecure_rpc');
    this.config = structuredClone(config); this.now = now;
    const request = new FetchRequest(config.rpcUrl); request.timeout=5000;
    this.rpc = rpc ?? new JsonRpcProvider(request, undefined, { batchMaxCount: 1 });
    wallet(config.registry.address); bytes32(config.registry.codeHash);
    if(config.arbitration)validateArbitrationBinding(config.arbitration,config.chainId);
    if(config.identityNames)validateDisplayBindings(config.identityNames,config.chainId);
    for (const name of [...Object.keys(ABIS),...(config.contracts.RefundManager420?['RefundManager420']:[])]) {
      const binding = config.contracts[name];
      requireThat(binding && binding.verified === true, 'missing_verified_binding');
      wallet(binding.address); bytes32(binding.codeHash);
      if (payComponents[name]) requireThat(binding.componentId===payComponents[name], 'pay_registry_binding_required');
      requireThat(typeof binding.versionResult === 'string' && /^0x[0-9a-f]+$/.test(binding.versionResult), 'missing_version');
      if (binding.componentId) { bytes32(binding.componentId); requireThat(Array.isArray(binding.registryVersion) && binding.registryVersion.length === 3, 'missing_registry_version'); }
    }
  }
  async verifyBlocks(headers) {
    await this.snapshot();
    const finalized = await this.rpc.send('eth_getBlockByNumber',['finalized',false]);
    for(const h of headers) {
      const block = await this.rpc.send('eth_getBlockByNumber',['0x'+h.height.toString(16),false]);
      if(!block || block.hash!==h.hash || block.parentHash!==h.parentHash || h.finalized && BigInt(block.number)>BigInt(finalized.number)) return false;
    }
    return true;
  }
  async verifyContractSignature(address,message,signature) {
    const source=await this.snapshot(),tag={blockHash:source.blockHash,requireCanonical:true};
    const code=await this.rpc.send('eth_getCode',[address,tag]); if(code==='0x')return false;
    requireThat(this.now()<source.expiresAt,'authority_deadline',503);
    const iface=new Interface(['function isValidSignature(bytes32,bytes) view returns(bytes4)']);
    try {
      const result=await this.rpc.send('eth_call',[{to:address,data:iface.encodeFunctionData('isValidSignature',[hashMessage(message),signature]),gas:'0x186a0'},tag]);
      requireThat(this.now()<source.expiresAt,'authority_deadline',503);
      return iface.decodeFunctionResult('isValidSignature',result)[0]==='0x1626ba7e';
    }catch{return false;}
  }
  async snapshot() {
    try {
      const deadline=this.now()+10000;
      const send=async(method,args)=>{requireThat(this.now()<deadline,'authority_deadline',503);const result=await this.rpc.send(method,args);requireThat(this.now()<deadline,'authority_deadline',503);return result;};
      requireThat(BigInt(await send('eth_chainId', [])) === BigInt(this.config.chainId), 'chain_mismatch', 503);
      const block = await send('eth_getBlockByNumber', ['finalized', false]);
      requireThat(block && /^0x[0-9a-f]{64}$/.test(block.hash), 'finality_unavailable', 503);
      const age = this.now() / 1000 - Number(BigInt(block.timestamp));
      requireThat(age >= -5 && age <= 120, 'stale_authority', 503);
      const tag = { blockHash: block.hash, requireCanonical: true };
      const call = async (address, abi, method, args = []) => {
        const iface = new Interface(abi);
        const result = await send('eth_call', [{ to: address, data: iface.encodeFunctionData(method, args) }, tag]);
        return iface.decodeFunctionResult(method, result);
      };
      const verifyCode = async binding => {
        const code = await send('eth_getCode', [binding.address, tag]);
        requireThat(code !== '0x' && keccak256(code) === binding.codeHash, 'code_mismatch', 503);
      };
      await verifyCode(this.config.registry);
      for (const [name, binding] of Object.entries(this.config.contracts)) {
        requireThat(Object.hasOwn(ABIS, name)||name==='RefundManager420', 'unknown_binding', 503);
        await verifyCode(binding);
        // Compare raw encoded bytes: Pay and Market have different version layouts.
        const versionData = new Interface(['function protocolVersion() view returns(uint32)']).encodeFunctionData('protocolVersion');
        const exactVersion = await send('eth_call', [{ to: binding.address, data: versionData }, tag]);
        requireThat(exactVersion.toLowerCase() === binding.versionResult, 'version_mismatch', 503);
        if (binding.componentId) {
          const ref = (await call(this.config.registry.address, registryABI, 'component', [binding.componentId]))[0];
          requireThat(ref.componentId === binding.componentId && wallet(ref.implementation) === wallet(binding.address) && ref.runtimeCodeHash === binding.codeHash && ref.version.every((v, i) => Number(v) === binding.registryVersion[i]) && (await call(this.config.registry.address, registryABI, 'isActive', [binding.componentId]))[0], 'registry_mismatch', 503);
        }
      }
      const read = async (name, method, args = []) => (await call(this.config.contracts[name].address, name==='RefundManager420'?refundReadABI:ABIS[name], method, args));
      const wiring = [['OrderRegistry420','listingRegistry','ListingRegistry420'],['OrderRegistry420','policyRegistry','MarketPolicyRegistry420'],['OrderRegistry420','inventoryReservation','InventoryReservation420'],['InventoryReservation420','listingRegistry','ListingRegistry420'],['InventoryReservation420','orderRegistry','OrderRegistry420'],['MarketPaySettlementAdapter420','orders','OrderRegistry420'],['MarketPaySettlementAdapter420','payments','PaymentRegistry420'],['MarketPaySettlementAdapter420','invoices','InvoiceRegistry420'],['MarketPaySettlementAdapter420','merchants','MerchantRegistry420']];
      for (const [name, getter, target] of wiring) requireThat(wallet((await read(name, getter))[0]) === wallet(this.config.contracts[target].address), 'dependency_mismatch', 503);
      requireThat((await read('MarketPaySettlementAdapter420','deploymentChainId'))[0] === BigInt(this.config.chainId), 'adapter_chain_mismatch', 503);
      const arbitration=await finalizedArbitrationBinding(this.config,{send,tag,deadline,now:this.now});
      return {
        chainId: this.config.chainId, blockHash: block.hash, blockNumber: Number(BigInt(block.number)), blockTimestamp: Number(BigInt(block.timestamp)), finalized: true, expiresAt:deadline, arbitration,
        merchant: async merchantId => record(await read('MerchantRegistry420','merchants',[bytes32(merchantId)])),
        merchantDisplay: async merchant => optionalMerchantDisplay(this.config.identityNames,{send,tag,deadline,now:this.now,blockTimestamp:Number(BigInt(block.timestamp))},merchant),
        listing: async listingId => {
          const listing = record((await read('ListingRegistry420','getListing',[bytes32(listingId)]))[0]);
          listing.available = (await read('InventoryReservation420','available',[listingId]))[0].toString();
          listing.inventory = record(await read('InventoryReservation420','inventory',[listingId]));
          listing.policyActive = (await read('MarketPolicyRegistry420','policyActive',[listing.policyId]))[0];
          listing.adapterActive = (await read('MarketPolicyRegistry420','settlementAdapterActive',[listing.settlementAdapterId]))[0];
          listing.reporterActive = (await read('MarketPolicyRegistry420','isSettlementReporter',[listing.settlementAdapterId,this.config.contracts.MarketPaySettlementAdapter420.address]))[0];
          return listing;
        },
        policy: async (policyId, adapterId) => ({policyActive:(await read('MarketPolicyRegistry420','policyActive',[bytes32(policyId)]))[0],adapterActive:(await read('MarketPolicyRegistry420','settlementAdapterActive',[bytes32(adapterId)]))[0]}),
        transaction: (contract,method,args) => ({chainId:this.config.chainId,target:this.config.contracts[contract].address,contract,method,args,data:new Interface(ABIS[contract]).encodeFunctionData(method,args),requiresWalletAuthorization:true,canonicalAuthority:false}),
        order: async orderId => record((await read('OrderRegistry420','getOrder',[bytes32(orderId)]))[0]),
        payment: async paymentId => record((await read('PaymentRegistry420','getPayment',[bytes32(paymentId)]))[0]),
        fundedRefund: this.config.contracts.RefundManager420 ? async refundId => ({executed:(await read('RefundManager420','fundedRefundExecuted',[bytes32(refundId)]))[0],record:record(await read('RefundManager420','refunds',[bytes32(refundId)]))}) : null,
        invoice: async invoiceId => record((await read('InvoiceRegistry420','getInvoice',[bytes32(invoiceId)]))[0]),
        invoiceId: async orderId => (await read('MarketPaySettlementAdapter420','invoiceIdForOrder',[bytes32(orderId)]))[0],
        boundPayment: async orderId => (await read('MarketPaySettlementAdapter420','orderPayment',[bytes32(orderId)]))[0],
        marketRefundReported: async orderId => (await read('MarketPaySettlementAdapter420','refundReported',[bytes32(orderId)]))[0],
        invoicePaid: async invoiceId => ({ amount: (await read('InvoiceRegistry420','paidAmount',[invoiceId]))[0].toString(), closed: (await read('InvoiceRegistry420','isClosed',[invoiceId]))[0] }),
        intent: (method, args) => ({ chainId: this.config.chainId, target: this.config.contracts.OrderRegistry420.address, method, args, requiresWalletAuthorization: true, canonicalAuthority: false }),
      };
    } catch (error) { if (error instanceof Fault) throw error; throw new Fault('authority_unavailable', 503); }
  }
}
export const fixedPrice = keccak256(toUtf8Bytes('420/MARKET/SALE/FIXED_PRICE/V1'));
