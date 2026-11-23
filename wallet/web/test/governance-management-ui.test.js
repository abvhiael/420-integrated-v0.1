import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../governance-management-ui.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('Governance UI exposes proposal list detail action review eligibility and three-way voting',()=>{
  for(const token of [
    '420 Governance','Proposals','Proposal detail','Actions hash','Required houses',
    'Community electorate','Validator electorate','Community thresholds','Validator thresholds',
    'Candidate actions JSON','Check eligibility / weight','data-governance-support="1"',
    'data-governance-support="0"','data-governance-support="2"','role="status"','role="alert"',
    'aria-live="polite"','aria-live="assertive"'
  ]) assert.equal(source.includes(token),true,token);
});

test('Governance UI uses qualified runtime discovery and never embeds canonical module addresses',()=>{
  assert.equal(source.includes("config?.governance?.discovery?.source!=='protocol-registry'"),true);
  assert.equal(source.includes('createGovernance420Client'),true);
  assert.equal(source.includes('createGovernanceIndexer420'),true);
  for(const forbidden of [
    '0x0000000000000000000000000000000000000429',
    '0x0000000000000000000000000000000000000437',
    'privateKey','mnemonic','seedPhrase'
  ]) assert.equal(source.includes(forbidden),false,forbidden);
});

test('Governance UI invalidates account/network context and gives explicit failed/replaced/pending recovery states',()=>{
  for(const token of [
    "provider.on('accountsChanged'","provider.on('chainChanged'","setAppState('Failed'",
    "setAppState('Replaced'","setAppState('Pending'","never auto-resubmitted",
    'Reload chain state before retrying','.focus()'
  ]) assert.equal(source.includes(token),true,token);
});

test('Wallet shell binds Governance navigation/script and responsive Governance layout',()=>{
  assert.equal(html.includes('data-scroll-target="#governance-management-panel"'),true);
  assert.equal(html.includes('./governance-management-ui.js'),true);
  assert.equal(css.includes('.governance-grid'),true);
  assert.equal(css.includes('@media (max-width:640px)'),true);
});

test('ordinary Wallet Governance UI does not expose proposal creation queue or execution authority controls',()=>{
  for(const forbidden of ['governance-create-proposal','governance-queue','governance-execute']) {
    assert.equal(source.includes(forbidden),false,forbidden);
    assert.equal(html.includes(forbidden),false,forbidden);
  }
});

test('GOV-REC-5 verified eligibility gates ballot buttons after busy transitions',()=>{
  assert.match(source,/eligibleVote\.proposalId!==selected\.proposalId/);
  assert.match(source,/eligibleVote\.house!==Number/);
  assert.match(source,/eligibleVote\.proofData!==/);
  assert.match(source,/eligibleVote\.epoch!==sessionEpoch/);
  assert.match(source,/if\(result\.eligible\)eligibleVote=/);
});

test('GOV-REC-5 in-flight account/network changes invalidate asynchronous proposal and eligibility views',()=>{
  for(const marker of [
    'sessionEpoch+=1', 'account changed during proposal refresh',
    'account changed during proposal read', 'account changed during connection',
    'ballot selection changed during eligibility check', 'eligibleVote=null'
  ])assert.ok(source.includes(marker),marker);
});


test('browser Civic approval is tied to immutable Wallet/420ID identity across every asynchronous stage',()=>{
  for(const token of [
    'function requireLive(captured,epoch,identityGeneration)',
    'context!==captured',
    'identityGeneration!==wallet420IDSessionState().generation',
    'requireLive(captured,epoch,identityGeneration)',
    'const captured=context,epoch=sessionEpoch,proposal=selected',
    "if(originalEpoch!==sessionEpoch)return",
    "window.addEventListener('focus'",
    "document.addEventListener('visibilitychange'",
  ]) assert.ok(source.includes(token),'missing account/session invalidation barrier: '+token);
});

test('browser Civic invalidation discards prior account/contract data and retains uncertain native vote hash for manual recovery',()=>{
  for(const token of [
    "let pendingVoteHash=null",
    "'#governance-account'",
    "'#governance-governor'",
    "'#governance-network'",
    "'#governance-proposal-list'",
    "pendingVoteHash=submitted.txHash",
    "Inspect its canonical receipt and current ballot before any retry",
    "never resubmit automatically",
  ]) assert.ok(source.includes(token),'missing revocation or uncertain receipt guard: '+token);
});
