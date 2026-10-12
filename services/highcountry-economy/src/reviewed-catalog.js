// Reviewed service configuration only. Values are injected from signed/approved
// economy catalogues; no bootstrap rewards, premium multipliers or exchange rates.
import {SettlementError} from './buds-ledger.js';
const positive = n => Number.isSafeInteger(n) && n > 0;
export class ReviewedEconomyCatalog {
  constructor({sources,sinks,verifyEvidence}) {
    if (!Array.isArray(sources)||!Array.isArray(sinks)||typeof verifyEvidence!=='function')
      throw new SettlementError('missing reviewed catalogue');
    this.sources=new Map();this.sinks=new Set(sinks);
    for (const s of sources) {
      if(typeof s.id!=='string'||!positive(s.totalCap)||!positive(s.maxAward)||s.maxAward>s.totalCap
         ||this.sources.has(s.id))throw new SettlementError('invalid source limits');
      this.sources.set(s.id,Object.freeze({totalCap:s.totalCap,maxAward:s.maxAward}));
    }
    this.verifyEvidence=verifyEvidence;
  }
  sourceLimit(source) {return this.sources.get(source)?.totalCap ?? 0;}
  authorize(source,proof,owner,amount) {
    const p=this.sources.get(source);
    return !!p && positive(amount) && amount<=p.maxAward
      && this.verifyEvidence(source,proof,owner,amount)===true;
  }
  authorizeSink(sink) {return this.sinks.has(sink);}
}
