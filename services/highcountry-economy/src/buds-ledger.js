// High Country R04.5 registered-state BUDS settlement core.
// External, durable serializable transactions are mandatory for production.
// BUDS are integer, zero-decimal game units, never ERC20, $420, or redeemable.
export class SettlementError extends Error {}
const requireId = x => { if (typeof x !== 'string' || !/^[a-zA-Z0-9:_-]{1,128}$/.test(x)) throw new SettlementError('invalid id'); };
const units = x => { if (!Number.isSafeInteger(x) || x < 0) throw new SettlementError('unsafe integer units'); return x; };
const add = (a,b) => { const n=a+b; return units(n); };
const balance = () => ({ available: 0, reserved: 0 });
const total = s => [...s.balances.values()].reduce((n,b)=>add(add(n,b.available),b.reserved),0);
export class BudsLedger {
  constructor(store, catalog) {
    if (!store || typeof store.transact !== 'function') throw new SettlementError('durable transaction adapter required');
    this.store=store;
    this.catalog=catalog;
  }
  async operate(op, fn) {
    requireId(op);
    return this.store.transact(s => {
      if (s.operations.has(op)) throw new SettlementError('replayed operation');
      const before=total(s);
      const issued=s.issued, burned=s.burned;
      const result=fn(s);
      if (total(s)!==add(before,s.issued-issued-(s.burned-burned))) throw new SettlementError('conservation');
      s.operations.add(op);
      return result;
    });
  }
  get(s,id) { requireId(id); if (!s.balances.has(id)) s.balances.set(id,balance()); return s.balances.get(id); }
  async earn(op,owner,source,proof,amount) {
    return this.operate(op,s=>{
      requireId(owner);requireId(source);requireId(proof);
      const proofKey=JSON.stringify([source,proof]);
      if(s.claims.has(proofKey))throw new SettlementError('replayed earning proof');
      if(!this.catalog || this.catalog.authorize(source,proof,owner,amount)!==true) throw new SettlementError('unapproved reward');
      units(amount); if(amount===0)throw new SettlementError('zero award');
      const limit=this.catalog.sourceLimit?.(source);
      if(!Number.isSafeInteger(limit)||limit<=0)throw new SettlementError('unbounded source');
      const previous=s.sourceIssued.get(source)||0;
      if(amount>limit-previous)throw new SettlementError('source issuance cap');
      s.sourceIssued.set(source,add(previous,amount));
      const b=this.get(s,owner);b.available=add(b.available,amount);s.issued=add(s.issued,amount);
      s.claims.add(proofKey);
    });
  }
  async reserve(op,owner,amount) { return this.operate(op,s=>{
    units(amount);if(!amount)throw new SettlementError('zero reserve');
    const b=this.get(s,owner);if(b.available<amount)throw new SettlementError('insufficient');
    b.available-=amount;b.reserved=add(b.reserved,amount);
  });}
  async release(op,owner,amount) {return this.operate(op,s=>{
    units(amount);if(!amount)throw new SettlementError('zero release');
    const b=this.get(s,owner);if(b.reserved<amount)throw new SettlementError('insufficient reserve');
    b.reserved-=amount;b.available=add(b.available,amount);
  });}
  async settle(op,buyer,seller,amount,feeBps=0) {return this.operate(op,s=>{
    requireId(buyer);requireId(seller);if(buyer===seller)throw new SettlementError('self trade');
    units(amount);if(!amount||feeBps!==0)throw new SettlementError('zero fee full-fill only');
    const a=this.get(s,buyer),b=this.get(s,seller);
    if(a.reserved<amount)throw new SettlementError('unfunded settlement');
    a.reserved-=amount;b.available=add(b.available,amount);
  });}
  async spend(op,owner,amount,sink) {return this.operate(op,s=>{
    requireId(sink);if(!this.catalog || this.catalog.authorizeSink?.(sink,owner,amount)!==true)throw new SettlementError('unapproved sink');units(amount);if(!amount)throw new SettlementError('zero sink');
    const b=this.get(s,owner);if(b.available<amount)throw new SettlementError('insufficient');
    b.available-=amount;s.burned=add(s.burned,amount);
  });}
}
// Test-only copy-on-write serial transaction fixture. Never wire it to production accounts.
export class MemoryTransactionFixture {
  constructor(){this.state={balances:new Map(),operations:new Set(),claims:new Set(),sourceIssued:new Map(),assets:new Map(),assetSources:new Map(),listings:new Map(),transferIntents:new Map(),settlementJobs:new Map(),importedAssets:new Set(),issued:0,burned:0};}
  async transact(fn){
    const s=structuredClone(this.state);
    const r=fn(s);this.state=s;return r;
  }
}

