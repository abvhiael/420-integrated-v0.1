// TN-BOOK-00 — deterministic, non-public sportsbook accounting and market engine.
// This is a LOCAL qualification model: no live wallets, deposits, RPC settlement,
// operator-issued capabilities or betting activation are provided here.
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';

const MAX=2n**256n-1n,INTEGER=/^(0|[1-9][0-9]*)$/,SINT=/^-?(0|[1-9][0-9]*)$/;
const ID=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const HASH=/^[a-f0-9]{64}$/;
const errors=(message)=>{throw Error('420Bet sportsbook: '+message);};
const requireTrue=(v,message)=>{if(!v)errors(message);};
function uint(value,name='amount'){
 requireTrue(typeof value==='string'&&INTEGER.test(value),'noncanonical '+name);
 const n=BigInt(value);requireTrue(n<=MAX,'uint256 overflow');return n;
}
const positive=(value,name)=>{const n=uint(value,name);requireTrue(n>0n,'zero '+name);return n;};
function signed(value){
 requireTrue(typeof value==='string'&&SINT.test(value),'noncanonical signed line');
 const n=BigInt(value);requireTrue(n>=-(2n**63n)&&n<2n**63n,'line overflow');return n;
}
const valueId=(value,name)=>{requireTrue(typeof value==='string'&&ID.test(value),'invalid '+name);return value;};
const digest=(v)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const clone=o=>structuredClone(o);
const key=(...v)=>v.join('|');
const types=new Set(['moneyline2','moneyline3','spread','total']);
const validStates=new Set(['DRAFT','APPROVED','OPEN','SUSPENDED','CLOSED']);
const ticketOutcomes=new Set(['WIN','LOSS','PUSH','VOID']);
const fmt=n=>n.toString();

function marketCheck(m){
 valueId(m.id,'market id');valueId(m.eventId,'event id');
 valueId(m.operatorId,'operator');valueId(m.assetId,'asset');valueId(m.vaultId,'vault');
 valueId(m.rulesVersion,'rules version');valueId(m.competitionId,'competition');
 valueId(m.correlationGroup,'correlation group');
 requireTrue(types.has(m.type),'unsupported market type');
 requireTrue(m.correlationGroup===m.eventId,
  'V1 correlated event markets must share one risk group');
 requireTrue(m.period==='REGULATION'||m.period==='FULL_GAME','unsupported period');
 requireTrue(['INCLUDE','EXCLUDE'].includes(m.overtime),'overtime policy required');
 requireTrue(['PUSH','VOID'].includes(m.tiePolicy),'two-way tie policy required');
 requireTrue(Number.isSafeInteger(m.startsAt)&&m.startsAt>0&&
  Number.isSafeInteger(m.cutoffAt)&&m.cutoffAt>0&&m.cutoffAt<m.startsAt,
  'start and cutoff required');
 requireTrue(Number.isSafeInteger(m.finalDeadlineAt)&&
  m.finalDeadlineAt>m.startsAt&&m.finalDeadlineAt<=m.startsAt+30*86400000,
  'frozen bounded no-action refund deadline required');
 requireTrue(typeof m.scheduleRevision==='string'&&INTEGER.test(m.scheduleRevision),
  'frozen schedule revision required');
 requireTrue(Array.isArray(m.selections)&&m.selections.length===(m.type==='moneyline3'?3:2)&&
  new Set(m.selections).size===m.selections.length&&
  m.selections.every(s=>['home','away','draw','over','under'].includes(s)),
  'invalid market selections');
 if(m.type==='moneyline3')
  requireTrue(JSON.stringify(m.selections.slice().sort())===
   JSON.stringify(['away','draw','home']),'3-way outcomes must include draw');
 if(m.type==='moneyline2'||m.type==='spread')
  requireTrue(JSON.stringify(m.selections.slice().sort())===
   JSON.stringify(['away','home']),'side outcomes required');
 if(m.type==='total')requireTrue(JSON.stringify(m.selections.slice().sort())===
  JSON.stringify(['over','under']),'total outcomes required');
 if(['spread','total'].includes(m.type))signed(m.line2);
 else requireTrue(m.line2===null,'unexpected line');
 requireTrue(m.state==='DRAFT','market must start DRAFT');
 return m;
}
export function grossPayout(stake,numerator,denominator){
 const s=positive(stake,'stake'),n=positive(numerator,'numerator'),d=positive(denominator,'denominator');
 requireTrue(n>d,'odds must exceed 1');requireTrue(n<=1000000n&&d<=1000000n,
  'odds outside approved arithmetic envelope');
 const result=s*n/d;requireTrue(result>0n&&result<=MAX,'gross payout overflow');
 return fmt(result);
}
function resultFor(m,t,facts){
 if(facts.status==='CANCELLED'||facts.status==='ABANDONED'||facts.status==='NO_CONTEST')
  return 'VOID';
 requireTrue(facts.status==='FINAL','incomplete outcome facts');
 requireTrue(facts.period===m.period&&facts.overtime===m.overtime,
  'outcome facts conflict with frozen period');
 const home=uint(facts.home2,'home score'),away=uint(facts.away2,'away score');
 requireTrue(home<=1000000n&&away<=1000000n,'impossible score envelope');
 const d=home-away,selection=t.selection;
 if(m.type==='moneyline2'){
  if(d===0n)return m.tiePolicy;
  return (d>0n?'home':'away')===selection?'WIN':'LOSS';
 }
 if(m.type==='moneyline3'){
  const winner=d===0n?'draw':d>0n?'home':'away';
  return winner===selection?'WIN':'LOSS';
 }
 if(m.type==='spread'){
  const adjusted=d+(selection==='home'?signed(m.line2):-signed(m.line2));
  return adjusted===0n?'PUSH':(selection==='home'?adjusted>0n:adjusted<0n)?'WIN':'LOSS';
 }
 const comparison=home+away-signed(m.line2);
 return comparison===0n?'PUSH':(comparison>0n?'over':'under')===selection?'WIN':'LOSS';
}
function limitsCheck(policy){
 for(const k of ['ticketStakeMax','ticketGrossMax','playerGrossMax','marketGrossMax',
  'eventGrossMax','correlationGrossMax','competitionGrossMax','operatorGrossMax','vaultGrossMax',
  'playerDailyStakeMax','playerDailyLossMax','capitalSafetyReserve']){
  uint(policy[k],k);
 }
 requireTrue(positive(policy.ticketStakeMax)>0n&&positive(policy.ticketGrossMax)>0n,
  'risk caps must be positive');
 requireTrue(Number.isSafeInteger(policy.challengeWindowMs)&&
  policy.challengeWindowMs>=3600000&&policy.challengeWindowMs<=30*86400000,
  'approved nonzero challenge window required');
 return policy;
}
function initial({chainId,assetId,vaultId,operatorId,capital,policy}){
 for(const [n,v] of Object.entries({chainId,assetId,vaultId,operatorId}))
  valueId(v,n);
 limitsCheck(policy);
 return {schema:'420bet-sportsbook-local-v1',chainId,assetId,vaultId,operatorId,
  capital:fmt(uint(capital)),freeCapital:fmt(uint(capital)),operatorReserved:'0',
  playerEscrow:'0',playerPaid:'0',operatorPL:'0',markets:{},tickets:{},
  quotes:{},nonces:{},receipts:{},results:{},playerDays:{},
  policy:clone(policy),audit:[],sequence:0};
}
const liabilities=(s,field,predicate=()=>true)=>Object.values(s.tickets)
 .filter(t=>t.state==='ACCEPTED'&&predicate(t))
 .reduce((v,t)=>v+BigInt(t[field]),0n);
function invariant(s){
 let reserved=0n,escrow=0n;
 for(const t of Object.values(s.tickets))if(t.state==='ACCEPTED'){
  reserved+=uint(t.gross);escrow+=uint(t.stake);
 }
 requireTrue(reserved===uint(s.operatorReserved),'gross liability reservation mismatch');
 requireTrue(escrow===uint(s.playerEscrow),'player escrow mismatch');
 requireTrue(uint(s.freeCapital)+reserved===uint(s.capital),
  'operator available capital/reservation conservation violated');
 for(const [id,m] of Object.entries(s.markets)){
  requireTrue(id===m.id&&validStates.has(m.state),'invalid market ledger');
 }
}
function audit(s,operation,id){
 s.sequence++;
 s.audit.push({sequence:s.sequence,operation,id,checksum:digest({
  sequence:s.sequence,operation,id,liability:s.operatorReserved,escrow:s.playerEscrow})});
 requireTrue(s.audit.length<=100000,'audit journal capacity exceeded');
}
export function createLocalSportsbookEngine({
 chainId,assetId,vaultId,operatorId,capital,policy,
 signQuote,verifyQuote,authorizePlayer,checkEligibility,verifyMarketHealth,
 verifyResult,clock=Date.now,preloaded=null,persistState=async()=>{}
}={}){
 for(const [name,fn] of Object.entries({signQuote,verifyQuote,authorizePlayer,
  checkEligibility,verifyMarketHealth,verifyResult,clock,persistState}))requireTrue(typeof fn==='function','missing '+name);
 let state=preloaded?clone(preloaded):initial({chainId,assetId,vaultId,operatorId,capital,policy});
 requireTrue(state.schema==='420bet-sportsbook-local-v1','invalid sportsbook schema');
 requireTrue(state.chainId===chainId&&state.assetId===assetId&&state.vaultId===vaultId&&
  state.operatorId===operatorId,'wrong persisted sportsbook identity');
 invariant(state);
 let mutation=Promise.resolve();
 function change(operation,fn){
  const result=mutation.then(async()=>{
   const next=clone(state),result=await fn(next);
   invariant(next);await persistState(clone(next));state=next;return result;
  });
  mutation=result.catch(()=>{});return result;
 }
 const view=()=>clone(state);
 async function registerMarket(raw,authorization){
  return change('market-register',async s=>{
   requireTrue(authorization?.role==='registrar'&&authorization?.approved===true,
    'separate event registrar approval required');
   const m=marketCheck(clone(raw));
   requireTrue(m.operatorId===s.operatorId&&m.assetId===s.assetId&&m.vaultId===s.vaultId,
    'wrong operator/asset/vault');
   requireTrue(!s.markets[m.id],'market ID reuse');
   m.termsHash=digest(m);m.quoteEpoch=0;m.result=null;
   s.markets[m.id]=m;audit(s,'MARKET_REGISTER',m.id);return clone(m);
  });
 }
 async function transition(marketId,action,approval){
  return change('transition',async s=>{
   const m=s.markets[valueId(marketId,'market ID')];
   requireTrue(m,'unknown market');
   const allowed={approve:['DRAFT','APPROVED'],open:['APPROVED','OPEN'],
    suspend:['OPEN','SUSPENDED'],resume:['SUSPENDED','OPEN'],
    close:['OPEN','CLOSED']};
   requireTrue(allowed[action]?.[0]===m.state,'invalid market transition');
   const role=action==='approve'?'riskApprover':'marketController';
   requireTrue(approval?.role===role&&approval?.approved===true&&
    approval.termsHash===m.termsHash,'unapproved market authority/terms');
   if(action==='open'||action==='resume'){
    requireTrue(clock()<m.cutoffAt&&clock()<m.startsAt,'market cutoff expired');
    requireTrue(approval?.sourceHealthy===true&&approval?.capitalApproved===true,
     'unqualified source/capital approval');
   }
   m.state=allowed[action][1];m.quoteEpoch++;
   audit(s,'MARKET_'+action.toUpperCase(),m.id);return clone(m);
  });
 }
 function quoteTerms({marketId,selection,playerId,stake,nonce,numerator,denominator,
  issuedAt,expiresAt,observedAt}={}){
  const m=state.markets[valueId(marketId,'market ID')];
  requireTrue(m?.state==='OPEN','market unavailable');
  valueId(playerId,'player');valueId(nonce,'nonce');
  requireTrue(m.selections.includes(selection),'invalid selection');
  requireTrue(Number.isSafeInteger(issuedAt)&&Number.isSafeInteger(expiresAt)&&
   Number.isSafeInteger(observedAt)&&observedAt<=issuedAt&&
   issuedAt<=clock()+5000&&issuedAt>=clock()-30000&&
   expiresAt>clock()&&expiresAt<=issuedAt+30000&&expiresAt<=m.cutoffAt,
   'stale, future or expired quote');
  const gross=grossPayout(stake,numerator,denominator);
  return Object.freeze({domain:'420bet-fixed-odds-v1',chainId:state.chainId,
   operatorId:state.operatorId,assetId:state.assetId,vaultId:state.vaultId,
   marketId:m.id,termsHash:m.termsHash,epoch:m.quoteEpoch,selection,playerId,
   stake:fmt(positive(stake)),numerator:fmt(positive(numerator)),
   denominator:fmt(positive(denominator)),gross,nonce,
   issuedAt,expiresAt,observedAt});
 }
 async function issueQuote(params,approval){
  requireTrue(approval?.role==='quoteSigner'&&approval?.approved===true,
   'quote signer authority required');
  const terms=quoteTerms(params);
  return Object.freeze({...terms,signature:await signQuote(terms)});
 }
 async function acceptTicket(quote,auth){
  return change('accept',async s=>{
   requireTrue(quote&&typeof quote==='object','signed quote required');
   const {signature,...raw}=quote;
   const currentMarket=s.markets[raw?.marketId];
   requireTrue(currentMarket?.state==='OPEN'&&currentMarket.quoteEpoch===raw.epoch,
    'market suspended or quote stale');
   const expected=quoteTerms(raw);
   requireTrue(JSON.stringify(expected)===JSON.stringify(raw),
    'quote altered or incomplete');
   requireTrue((await verifyQuote(expected,signature))===true,
    'invalid quote signer signature');
   const m=s.markets[expected.marketId];
   requireTrue(clock()<expected.expiresAt&&clock()<m.cutoffAt&&clock()<m.startsAt&&
    m.state==='OPEN'&&m.quoteEpoch===expected.epoch,'market suspended or quote stale');
   const ticketId=digest({domain:'420bet-ticket-v1',quote:expected,signature});
   requireTrue(!s.tickets[ticketId],'ticket already accepted');
   const nonceId=key(expected.playerId,expected.nonce);
   requireTrue(!s.nonces[nonceId],'player nonce replay');
   requireTrue((await authorizePlayer({playerId:expected.playerId,quote:expected,
    ticketId,authorization:auth}))===true,'player did not authorize exact quote');
   requireTrue((await checkEligibility({playerId:expected.playerId,market:m,quote:expected,
    action:'place'}))===true,'player ineligible or over responsible-play controls');
   const source=await verifyMarketHealth({market:clone(m),quote:expected});
   requireTrue(source?.verified===true&&source?.status==='SCHEDULED'&&
    source.eventId===m.eventId&&source.scheduleRevision===m.scheduleRevision&&
    source.startAt===m.startsAt&&source.startAt>clock()&&
    source.observedAt<=clock()&&clock()-source.observedAt<=30000,
    'unverified, stale or revised event schedule');
   const stake=uint(expected.stake),gross=uint(expected.gross),p=s.policy;
   const cap=(amount,limit,what)=>requireTrue(amount<=uint(p[limit]),what+' exposure cap');
   cap(stake,'ticketStakeMax','ticket');cap(gross,'ticketGrossMax','ticket');
   const active=filter=>liabilities(s,'gross',filter)+gross;
   cap(active(t=>t.playerId===expected.playerId),'playerGrossMax','player');
   cap(active(t=>t.marketId===m.id),'marketGrossMax','market');
   cap(active(t=>t.eventId===m.eventId),'eventGrossMax','event');
   cap(active(t=>t.correlationGroup===m.correlationGroup),'correlationGrossMax','correlation group');
   cap(active(t=>t.competitionId===m.competitionId),'competitionGrossMax','competition');
   cap(active(t=>t.operatorId===m.operatorId),'operatorGrossMax','operator');
   cap(active(t=>t.vaultId===m.vaultId),'vaultGrossMax','vault');
   const day=Math.floor(clock()/86400000),id=key(expected.playerId,day);
   const usage=s.playerDays[id]??{stake:'0',loss:'0'};
   cap(uint(usage.stake)+stake,'playerDailyStakeMax','daily stake');
   cap(uint(usage.loss)+stake,'playerDailyLossMax','daily loss');
   requireTrue(uint(s.freeCapital)>=gross+uint(p.capitalSafetyReserve),
    'insufficient independently reserved operator capital');
   // In one local transaction, escrow player stake and earmark separately
   // sourced GROSS operator liability. No external vault transfer is implied.
   s.freeCapital=fmt(uint(s.freeCapital)-gross);
   s.operatorReserved=fmt(uint(s.operatorReserved)+gross);
   s.playerEscrow=fmt(uint(s.playerEscrow)+stake);
   s.playerDays[id]={stake:fmt(uint(usage.stake)+stake),loss:fmt(uint(usage.loss)+stake)};
   s.nonces[nonceId]=ticketId;
   s.tickets[ticketId]={id:ticketId,marketId:m.id,eventId:m.eventId,
    correlationGroup:m.correlationGroup,competitionId:m.competitionId,
    operatorId:m.operatorId,vaultId:m.vaultId,
    playerId:expected.playerId,selection:expected.selection,stake:expected.stake,
    gross:expected.gross,termsHash:m.termsHash,quoteHash:digest(expected),
    state:'ACCEPTED',acceptedAt:clock(),outcome:null,receiptId:null};
   audit(s,'TICKET_ACCEPT',ticketId);
   return {ticketId,marketId:m.id,playerId:expected.playerId,
    stake:expected.stake,gross:expected.gross,state:'ACCEPTED'};
  });
 }
 async function proposeResult(marketId,facts,authority){
  return change('result-propose',async s=>{
   const m=s.markets[valueId(marketId,'market ID')];
   requireTrue(m?.state==='CLOSED','market must close before result reporting');
   requireTrue(authority?.role==='factReporter'&&authority.approved===true&&
    typeof authority.sourceDigest==='string'&&HASH.test(authority.sourceDigest),
    'independent factual source provenance required');
   requireTrue((await verifyResult({market:clone(m),facts,authority}))===true,
    'unverified outcome facts');
   requireTrue(['FINAL','CANCELLED','ABANDONED','NO_CONTEST'].includes(facts?.status),
    'incomplete event');
   if(facts.status==='FINAL')resultFor(m,{selection:m.selections[0]},facts);
   const previous=m.result;
   requireTrue(!previous||previous.state!=='FINAL',
    'finalized result cannot be revised or redirected');
   if(previous?.state==='DISPUTED')requireTrue(
    authority?.disputeResolutionApproved===true&&
    authority.disputeRole==='independentResolver'&&
    authority.disputeDigest===previous.digest,
    'independent dispute disposition required');
   const sequence=(previous?.sequence??0)+1;
   requireTrue(authority.sequence===sequence,'result sequence mismatch');
   requireTrue(authority.previousDigest===(previous?.digest??null),
    'factual result revision fork');
   const digestValue=digest({marketId,termsHash:m.termsHash,sequence,facts,
    sourceDigest:authority.sourceDigest});
   m.result={state:'PROPOSED',sequence,digest:digestValue,facts:clone(facts),
    challengeEndsAt:clock()+s.policy.challengeWindowMs,sourceDigest:authority.sourceDigest,
    challenged:false};
   audit(s,'RESULT_PROPOSE',m.id);return clone(m.result);
  });
 }
 async function challengeResult(marketId,proof){
  return change('result-challenge',async s=>{
   const m=s.markets[valueId(marketId,'market ID')];
   requireTrue(m?.result?.state==='PROPOSED'&&clock()<m.result.challengeEndsAt,
    'challenge period closed');
   requireTrue(proof?.approved===true&&proof?.role==='disputeClaimant'&&
    proof.resultDigest===m.result.digest,'invalid result challenge authority');
   m.result.state='DISPUTED';m.result.challenged=true;
   audit(s,'RESULT_DISPUTE',marketId);return clone(m.result);
  });
 }
 async function finalizeResult(marketId,approval){
  return change('result-finalize',async s=>{
   const m=s.markets[valueId(marketId,'market ID')];
   requireTrue(m?.result?.state==='PROPOSED'&&clock()>=m.result.challengeEndsAt,
    'result challenge hold active');
   requireTrue(approval?.approved===true&&approval.role==='independentFinalizer'&&
    approval.digest===m.result.digest,'finality authority missing');
   m.result.state='FINAL';audit(s,'RESULT_FINAL',marketId);return clone(m.result);
  });
 }
 async function expireNoAction(marketId){
  return change('timeout-no-action',async s=>{
   const m=s.markets[valueId(marketId,'market ID')];
   requireTrue(m?.state==='CLOSED'&&clock()>=m.finalDeadlineAt,
    'no-action refund deadline has not elapsed');
   requireTrue(m.result?.state!=='FINAL',
    'final sportsbook result cannot be overridden by timeout');
   const digestValue=digest({domain:'420bet-timeout-void-v1',
    marketId:m.id,termsHash:m.termsHash,deadline:m.finalDeadlineAt});
   const sequence=(m.result?.sequence??0)+1;
   m.result={state:'FINAL',sequence,digest:digestValue,
    facts:{status:'NO_CONTEST'},sourceDigest:null,timeout:true,
    challengeEndsAt:m.finalDeadlineAt,challenged:false};
   audit(s,'RESULT_TIMEOUT_VOID',marketId);
   return clone(m.result);
  });
 }
 async function settleTicket(ticketId,approval){
  return change('settlement',async s=>{
   const prior=s.receipts[ticketId];if(prior){
    requireTrue(prior.finalDigest===approval?.finalDigest,'conflicting settlement replay');
    return clone(prior);
   }
   const t=s.tickets[ticketId],m=t&&s.markets[t.marketId];
   requireTrue(t?.state==='ACCEPTED'&&m?.result?.state==='FINAL'&&
    approval?.role==='settlementExecutor'&&approval?.approved===true&&
    approval.finalDigest===m.result.digest,'unauthorized or unfinished settlement');
   requireTrue((await checkEligibility({playerId:t.playerId,market:m,ticket:t,
    action:'settle'}))===true,'settlement beneficiary authority missing');
   const outcome=resultFor(m,t,m.result.facts);
   requireTrue(ticketOutcomes.has(outcome),'invalid derived outcome');
   const payout=outcome==='WIN'?uint(t.gross):
    outcome==='PUSH'||outcome==='VOID'?uint(t.stake):0n;
   const stake=uint(t.stake),gross=uint(t.gross);
   const delta=stake-payout;
   requireTrue(BigInt(s.capital)+delta>=0n&&
    BigInt(s.freeCapital)+gross+delta>=0n,'operator settlement insolvency');
   s.operatorReserved=fmt(uint(s.operatorReserved)-gross);
   s.capital=fmt(BigInt(s.capital)+delta);
   s.freeCapital=fmt(BigInt(s.freeCapital)+gross+delta);
   s.playerEscrow=fmt(uint(s.playerEscrow)-stake);
   s.playerPaid=fmt(uint(s.playerPaid)+payout);
   // Accrual: player stake is already escrowed, so returned escrow less
   // payout is the book's incremental P&L; gross reservation is not an asset.
   s.operatorPL=fmt(BigInt(s.operatorPL)+stake-payout);
   t.state='SETTLED';t.outcome=outcome;
   const receipt={ticketId,playerId:t.playerId,outcome,stake:t.stake,
    gross:t.gross,payout:fmt(payout),fee:'0',finalDigest:m.result.digest,
    receiptId:digest({ticketId,finalDigest:m.result.digest,outcome,payout:fmt(payout)})};
   t.receiptId=receipt.receiptId;s.receipts[ticketId]=receipt;
   audit(s,'TICKET_SETTLE',ticketId);
   return clone(receipt);
  });
 }
 return Object.freeze({view,registerMarket,transition,issueQuote,acceptTicket,
  proposeResult,challengeResult,finalizeResult,expireNoAction,settleTicket});
}
export function makeLocalQuoteSigner(secret){
 requireTrue(typeof secret==='string'&&secret.length>=32,'signer secret required');
 const sign=async terms=>createHmac('sha256',secret).update(JSON.stringify(terms)).digest('hex');
 const verify=async(terms,signature)=>{
  const expected=await sign(terms);
  return typeof signature==='string'&&HASH.test(signature)&&
   timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex'));
 };
 return Object.freeze({sign,verify});
}
