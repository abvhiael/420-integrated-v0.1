import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=(path)=>fs.readFileSync(new URL(path,root),'utf8');
const core=read('core/governance-management.js');
const ui=read('governance-management-ui.js');
const html=read('index.html');
const css=read('styles.css');
const tests=read('test/governance-management.test.js')+'\n'+read('test/governance-management-ui.test.js');
const errors=[];
const requireTokens=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))errors.push(label+' missing '+token);};

requireTokens(core,[
  "source !== 'protocol-registry'","420/service/governance/v1",'eth_getCode','systemName()','protocolVersion()',
  'CivicConstitution420','CivicProposalRegistry420','CivicElectorateRegistry420','CivicVoting420','CivicGovernor420',
  'listProposalIds','CivicProposalRegistered','frozenRule(bytes32)','proposalSnapshot(bytes32)','tally(bytes32,uint8)',
  'ballot(bytes32,uint8,address)','votingWeight(bytes32,uint8,address,bytes)','castVote(bytes32,uint8,uint8,bytes)',
  'hashActions((address,uint256,bytes)[])','action batch does not match proposal commitment',
  'ABI metadata unavailable; action cannot be decoded safely','eth_call','eth_estimateGas','eth_sendTransaction',
  'eth_getTransactionCount','confirmed','failed','replaced','pending','authoritative: false'
],'Governance core');
requireTokens(ui,[
  'Proposal detail','Community electorate','Validator electorate','Community thresholds','Validator thresholds',
  'Community tally','Validator tally','Verify against committed hash','Check eligibility / weight',
  'FOR','AGAINST','ABSTAIN',"provider.on('accountsChanged'","provider.on('chainChanged'",
  'role="status"','role="alert"','aria-live="polite"','aria-live="assertive"'
],'Governance UI');
requireTokens(html,['data-scroll-target="#governance-management-panel"','./governance-management-ui.js'],'Wallet shell');
requireTokens(css,['.governance-grid','@media (max-width:640px)'],'Governance responsive CSS');
requireTokens(tests,[
  'wrong chain','missing code','account drift','module mismatch','non-authoritative tallies',
  'already-cast','does not match proposal commitment','simulation gas estimation','confirmed failed pending and replaced',
  'safe retry'
],'Governance tests');
for(const forbidden of [
  '0x0000000000000000000000000000000000000429',
  '0x0000000000000000000000000000000000000437',
  'governance-create-proposal','governance-queue','governance-execute'
]){
  if(core.includes(forbidden)||ui.includes(forbidden))errors.push('forbidden Governance Wallet authority/address token '+forbidden);
}
console.log(JSON.stringify({pass:errors.length===0,errors,step:'GOV-AUDIT-5'},null,2));
if(errors.length)process.exit(2);
