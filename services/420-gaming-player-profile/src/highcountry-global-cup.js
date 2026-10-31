// HC-NEXT-7.4 — read-only finalized Global420Cup projection.
// No client result, account identifier, trophy or prestige claim is authoritative.
const fail = code => { throw Object.assign(new Error(code), {code}); };
const id = x => typeof x === 'string' && /^0x[0-9a-f]{64}$/.test(x);
const address = x => typeof x === 'string' && /^0x[0-9a-f]{40}$/.test(x) && x !== '0x'+'0'.repeat(40);
const score = x => Number.isSafeInteger(x) && x >= 0 && x <= 10000;
const same = (a,b) => a.toLowerCase() === b.toLowerCase();

/**
 * The trusted source must independently attest finalized block identity, the expected
 * deployed Cup codehash, and canonical CompetitionEngine results at that same block.
 * A process-local fixture is NOT deployed acceptance.
 */
export function createGlobalCupProjection420({source,chainId,cupAddress,codeHash}={}) {
 if (typeof source?.readFinalizedCup !== 'function' ||
     !Number.isSafeInteger(chainId) || chainId <= 0 ||
     !address(cupAddress) || !id(codeHash)) fail('cup-config-invalid');
 return Object.freeze({
  async standings({cupId}) {
   if (!id(cupId)) fail('cup-id-invalid');
   const record = await source.readFinalizedCup({cupId,chainId,cupAddress,codeHash});
   if (!record || record.chainId !== chainId || !same(record.cupAddress,cupAddress) ||
       !same(record.codeHash,codeHash) || !id(record.blockHash) ||
       record.finalizedBlock !== true || record.canonical !== true ||
       record.resultsCurrent !== true || !id(record.resultCommitment) ||
       record.resultCommitment === '0x'+'0'.repeat(64) ||
       !id(record.rulesHash) || !id(record.prizeRulesHash) || !id(record.scope) ||
       !Array.isArray(record.rounds) || record.rounds.length !== 3 ||
       !record.cupFinalized || !address(record.champion)) fail('cup-not-finalized');
   const [semiA,semiB,final] = record.rounds;
   if (![semiA,semiB,final].every(r => id(r?.eventId) && r.finalized === true &&
       r.current === true && address(r.winner) && score(r.winnerScore) &&
       Array.isArray(r.entrants) && r.entrants.every(address))) fail('cup-round-invalid');
   if (new Set(record.rounds.map(x=>x.eventId)).size !== 3 ||
       semiA.entrants.length !== 2 || semiB.entrants.length !== 2 ||
       final.entrants.length !== 2 ||
       !semiA.entrants.some(a=>same(a,semiA.winner)) ||
       !semiB.entrants.some(a=>same(a,semiB.winner)) ||
       same(semiA.winner,semiB.winner) ||
       !same(final.entrants[0],semiA.winner) && !same(final.entrants[0],semiB.winner) ||
       !same(final.entrants[1],semiA.winner) && !same(final.entrants[1],semiB.winner) ||
       same(final.entrants[0],final.entrants[1]) ||
       !same(final.winner,record.champion)) fail('cup-bracket-invalid');
   // A trophy is display-only, derived from the finalized canonical commitment.
   // Prestige is shown ONLY if the exact on-chain scoped issuance is current.
   const prestige = record.prestigeIssued === true && record.issuanceCurrent === true;
   return Object.freeze({
    cupId, chainId, cupAddress, blockHash:record.blockHash,
    rulesHash:record.rulesHash, prizeRulesHash:record.prizeRulesHash,
    resultCommitment:record.resultCommitment, scope:record.scope,
    rounds:record.rounds.map((r,i)=>Object.freeze({
     round:i===2?'final':'semifinal',eventId:r.eventId,
     entrants:Object.freeze([...r.entrants]),winner:r.winner,winnerScore:r.winnerScore
    })),
    champion:record.champion,
    trophy:Object.freeze({kind:'global-420-cup-champion',cupId,
      holder:record.champion,provenance:record.resultCommitment,transferable:false,financial:false}),
    achievement:prestige?Object.freeze({kind:'global-420-cup-prestige',cupId,
      holder:record.champion,scope:record.scope,provenance:record.resultCommitment}):null,
    prizesFunded:false
   });
  }
 });
}
