// Fail-closed bridge between R04.1 authoritative inventory and the R04.8 ordinary market.
// Production MUST supply independent authenticated inventory/escrow and identity clients.
// No plain log, client JSON, or signature-alone proof is sufficient to mint local inventory.
import {SettlementError} from './buds-ledger.js';
const valid = x => typeof x==='string'&&/^[a-zA-Z0-9:_-]{1,128}$/.test(x);
export class InventoryEscrowAuthority {
 constructor({identity,inventory,issuer,chainId,registry,confirmations=1}) {
  if(typeof identity?.registeredPrincipal!=='function'||
     typeof identity?.requireAssetIssuer!=='function'||
     typeof inventory?.lockedEscrowReceipt!=='function'||
     !valid(issuer)||!valid(registry)||
     !Number.isSafeInteger(chainId)||chainId<=0||
     !Number.isSafeInteger(confirmations)||confirmations<1)
    throw new SettlementError('unconfigured trusted escrow authority');
  Object.assign(this,{identity,inventory,issuer,chainId,registry,confirmations});
 }
 registeredPrincipal(session){return this.identity.registeredPrincipal(session);}
 requireAssetIssuer(session){return this.identity.requireAssetIssuer(session);}
 async verifyAssetReceipt(receipt) {
  if(!receipt||!valid(receipt.receiptId)||!valid(receipt.owner)||
     !valid(receipt.asset)||!Number.isSafeInteger(receipt.quantity)||receipt.quantity<=0||
     receipt.chainId!==this.chainId||receipt.registry!==this.registry||
     receipt.issuer!==this.issuer)return false;
  // Inventory adapter must read authoritative lock state, not merely trust submitted payload.
  const lock=await this.inventory.lockedEscrowReceipt(receipt.receiptId,this.confirmations);
  return !!lock && lock.finalized===true && lock.locked===true &&
   lock.receiptId===receipt.receiptId&&lock.chainId===receipt.chainId&&lock.registry===receipt.registry&&
   lock.issuer===receipt.issuer&&lock.owner===receipt.owner&&
   lock.asset===receipt.asset&&lock.quantity===receipt.quantity &&
   lock.consumed!==true;
 }
}
