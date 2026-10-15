import {randomBytes,createPublicKey} from 'node:crypto';
import {AuthError,record,createAuthorityVerifier} from './auth.mjs';
import {digest,validateIntent,address,bytes32,uint} from './payment-protocol.mjs';
import {money} from './fare.mjs';
const fail=(code,status=403)=>{throw new AuthError(code,status);};
const methods={prepare:['intent'],wallet:['approved','payer','controller','authorizationEpoch'],event:['event'],operation:['operation'],meter:['meter'],rules:['rules'],funding:['funding'],beneficiary:['controller','active']};
const purposes={prepare:'liftd_pay_intent',wallet:'liftd_wallet_consent',event:'liftd_pay_event',operation:'liftd_pay_operation',meter:'liftd_trip_meter',rules:'liftd_compensation_rules',funding:'liftd_settlement_funding',beneficiary:'liftd_payout_binding'};
export function createPayAuthority({config,authorities,resolvers,clock=()=>Math.floor(Date.now()/1000)}) {
  if(!config||!Number.isSafeInteger(config.chainId)||config.chainId<1)fail('PAY_CONFIGURATION_REQUIRED',503);
  for(const k of ['merchant','asset','payRouter','paymentRegistry','refundManager','settlementRouter','developmentVault','platformController','passThroughController','disbursementRegistry'])address(config[k]);
  const pinned=Object.freeze({...config});const verifiers={};
  for(const [method,fields]of Object.entries(methods)){
    if(typeof resolvers?.[method]!=='function')fail('PAY_CONFIGURATION_REQUIRED',503);
    verifiers[method]=createAuthorityVerifier(authorities?.[method],{purpose:purposes[method],fields:['nonce','binding',...fields]});
  }
  const keys=a=>Object.values(a.keys).map(k=>createPublicKey(k).export({type:'spki',format:'der'}));
  if(keys(authorities.wallet).some(a=>keys(authorities.prepare).some(b=>a.equals(b))))fail('SEPARATE_WALLET_AUTHORITY_REQUIRED',503);
  const invoke=async(method,subject,binding)=>{
    const nonce=randomBytes(24).toString('base64url'),before=clock();let signed;
    try{signed=await resolvers[method]({nonce,subject,binding});}catch{fail('PAY_AUTHORITY_UNAVAILABLE',503);}
    const now=clock();if(!Number.isSafeInteger(now)||now<before)fail('PAY_AUTHORITY_UNAVAILABLE',503);
    const p=verifiers[method](signed,now);if(p.sub!==subject||p.nonce!==nonce||p.binding!==digest(binding))fail('PAY_PROJECTION_BINDING_MISMATCH');return p;
  };
  return Object.freeze({config:pinned,
    async prepare(subject,binding){const p=await invoke('prepare',subject,binding);const i=p.intent;
      record(i,['invoiceId','paymentId','payQuoteId','payerNonce','payer','controller','merchant','asset','amountUnits','tipUnits','target','calldata','value','chainId','currency','totalCents','expiresAt']);
      validateIntent(i,pinned);if(i.currency!=='CAD'||i.totalCents!==binding.totalCents||!Number.isSafeInteger(i.expiresAt)||i.expiresAt<=clock()||i.expiresAt>p.exp)fail('INVALID_PAY_INTENT');
      if((binding.tipCents===0&&uint(i.tipUnits)!==0n)||(binding.tipCents>0&&uint(i.tipUnits)===0n))fail('INVALID_TIP_BINDING');return i;},
    async wallet(subject,binding){const p=await invoke('wallet',subject,binding);if(p.approved!==true||p.payer!==binding.intent.payer||p.controller!==binding.intent.controller||!Number.isSafeInteger(p.authorizationEpoch)||p.authorizationEpoch<0)fail('WALLET_CONSENT_REQUIRED');return {expiresAt:p.exp,payer:p.payer,authorizationEpoch:p.authorizationEpoch};},
    async event(subject,binding){const p=await invoke('event',subject,binding);return p.event;},
    async operation(subject,binding){const p=await invoke('operation',subject,binding);return p.operation;},
    async meter(subject,binding){const p=await invoke('meter',subject,binding);return p.meter;},
    async rules(subject,binding){const p=await invoke('rules',subject,binding);record(p.rules,['minimumDriverCentsPerHour','minimumAllowanceCentsPerKm','rulesRef']);money(p.rules.minimumDriverCentsPerHour);money(p.rules.minimumAllowanceCentsPerKm);return p.rules;},
    async funding(subject,binding){const p=await invoke('funding',subject,binding);const f=p.funding;record(f,['fundingRef','payer','amountCents','amountUnits','reserved','canonical','finality','receiptHash','asset','chainId','recipient']);
      bytes32(f.receiptHash);if(f.canonical!==true||f.finality!=='FINALIZED'||f.asset!==binding.asset||f.chainId!==binding.chainId||f.recipient!==pinned.merchant||f.payer!=='liftd-platform'||f.reserved!==true||money(f.amountCents)<binding.requiredCents||uint(f.amountUnits)<uint(binding.requiredUnits)||typeof f.fundingRef!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(f.fundingRef))fail('PLATFORM_FUNDING_REQUIRED');return f;},
    async beneficiary(subject,binding){const p=await invoke('beneficiary',subject,binding);if(p.active!==true)fail('PAYOUT_BINDING_INACTIVE');return address(p.controller);},
  });
}
