// Only expose this facade through authenticated registered-state service routes.
// A browser must never supply a spendable owner ID as an authority assertion.
import {SettlementError} from './buds-ledger.js';
const principal = value => {
 if(typeof value!=='string'||!/^[a-zA-Z0-9:_-]{1,128}$/.test(value))throw new SettlementError('invalid authenticated player');
 return value;
};
export class AuthenticatedEconomyService {
 constructor(ledger,authority) {
  if(!ledger||typeof authority?.registeredPrincipal!=='function'
     ||typeof authority?.requireTrustedIssuer!=='function'
     ||typeof authority?.requireMarketOperator!=='function')
    throw new SettlementError('registered authority required');
  this.ledger=ledger;this.authority=authority;
 }
 async earn(session,op,owner,source,proof,amount) {
  await this.authority.requireTrustedIssuer(session,source);
  return this.ledger.earn(op,principal(owner),source,proof,amount);
 }
 async reserve(session,op,amount) {
  return this.ledger.reserve(op,principal(await this.authority.registeredPrincipal(session)),amount);
 }
 async release(session,op,amount) {
  return this.ledger.release(op,principal(await this.authority.registeredPrincipal(session)),amount);
 }
 async spend(session,op,amount,sink) {
  return this.ledger.spend(op,principal(await this.authority.registeredPrincipal(session)),amount,sink);
 }
 // Requires separate R04.8 asset-ledger atomic acceptance before service route activation.
 async settleMarket(serviceCredential,op,buyer,seller,amount) {
  await this.authority.requireMarketOperator(serviceCredential);
  return this.ledger.settle(op,principal(buyer),principal(seller),amount,0);
 }
}
