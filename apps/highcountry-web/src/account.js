// R06.3 account panel: operator supplies an issuer-backed authenticator, never a wallet or guest account string.
import {createCloudClient} from './cloud.js';
import {createHighCountryTransactionLifecycle420} from './transaction.js';
import {createHighCountryMarketConsumer420} from './market.js';
import {createOptionalWallet420} from './wallet.js';
import {loadGuest} from './guest.js';
export function mountAccountPanel({document,main,runtime,authenticate,storage=globalThis.localStorage,fetchImpl=fetch,localAuth=null,walletProvider=null}){
 const paragraph=(t)=>{const p=document.createElement('p');p.textContent=t;main.append(p);return p;};
 const field=(caption,value='')=>{const label=document.createElement('label');label.textContent=caption+' ';
  const input=document.createElement('input');input.value=value;label.append(input);main.append(label);return input;};
 const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.type='button';b.addEventListener('click',fn);main.append(b);return b;};
 const status=paragraph('Cloud is optional; guest progress stays on this device.');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 if(runtime.mode!=='connected'||typeof authenticate!=='function'){
  paragraph('Account sign-in unavailable until a verified identity issuer and connected service are configured.');
  return;
 }
 if(localAuth){
  const username=field('Local development username'),password=field('Local development password');
  password.type='password';password.autocomplete='current-password';
  button('Create local test account',async()=>{try{await localAuth.register({username:username.value,password:password.value});
   password.value='';status.textContent='Local test account provisioned; sign in to continue.';}catch(e){report(e);}});
  button('Sign in locally',async()=>{try{await localAuth.login({username:username.value,password:password.value});
   password.value='';await sessionAction();}catch(e){report(e);}});
  button('Sign out',async()=>{try{await localAuth.logout();session=null;cloudRevision=null;
   status.textContent='Signed out; local guest game remains available.';}catch(e){report(e);}});
 }
 const client=createCloudClient({apiUrl:runtime.apiUrl,gameId:runtime.gameId,authenticate,fetchImpl});
 let session=null,cloudRevision=null;
 const report=e=>{status.textContent=e?.message||String(e);};
 const sessionAction=async()=>{session=await client.session();cloudRevision=session.revision;
  status.textContent=session.registered?'Registered profile available. Cloud revision '+cloudRevision:'Authenticated issuer account; register a game profile to activate cloud save.';};
 button('Check secure sign-in',()=>sessionAction().catch(report));
 const profileId=field('New game profile ID (not an account credential)');
 const rulesetId=field('Approved game ruleset ID');
 button('Register optional game profile',async()=>{try{const v=await client.register({profileId:profileId.value,rulesetId:rulesetId.value});status.textContent='Game profile registered: '+v.profileId;await sessionAction();}catch(e){report(e);}});
 button('Read cloud save',async()=>{try{const v=await client.read();cloudRevision=v.revision;
  status.textContent=v.save?'Cloud snapshot verified; revision '+v.revision+'. Local guest save was not overwritten.':'No cloud save exists yet.';}catch(e){report(e);}});
 const policy=field('Approved consent policy hash');
 const check=document.createElement('label');const checkbox=document.createElement('input');checkbox.type='checkbox';
 check.append(checkbox,document.createTextNode(' I consent to store this local guest preview in my account cloud save'));main.append(check);
 button('Back up guest preview to cloud',async()=>{
  try{if(!checkbox.checked)throw Error('cloud-consent-required');if(!session?.registered||!session.rulesetId)throw Error('registered-session-required');
   const local=loadGuest(storage);if(!local)throw Error('guest-save-not-found');
   const grant=await client.consent({policyHash:policy.value,accepted:true});
   const result=await client.publish({expectedRevision:cloudRevision??session.revision,consentId:grant.consentId,
    schemaLabel:'highcountry-guest-preview-v1',save:{schemaVersion:1,rulesetId:session.rulesetId,
     state:{kind:'untrusted-guest-preview',local}}});
   cloudRevision=result.revision;
   status.textContent='Guest preview backed up. Cloud revision '+result.revision+'. No achievements/assets promoted.';
  }catch(e){report(e);}
 });
 const prior=field('Cloud revision to restore');
 button('Restore prior cloud revision as new head',async()=>{
  try{if(!checkbox.checked)throw Error('cloud-consent-required');if(!session?.registered)throw Error('registered-session-required');
   const grant=await client.consent({policyHash:policy.value,accepted:true});
   const result=await client.restore({backupRevision:prior.value,expectedHead:cloudRevision??session.revision,
    consentId:grant.consentId,schemaLabel:'highcountry-guest-preview-v1'});
   cloudRevision=result.revision;
   status.textContent='Cloud revision restored as new revision '+result.revision+'. Device guest save remains unchanged.';
  }catch(e){report(e);}
 });
 // Wallet is always optional; never request accounts until the player presses Connect.
 if(walletProvider&&runtime.mode==='connected'){
  const walletStatus=paragraph('Wallet disconnected. Core guest play remains available.');
  walletStatus.setAttribute('role','status');walletStatus.setAttribute('aria-live','polite');
  let optional;
  try{optional=createOptionalWallet420({provider:walletProvider,authenticate,apiUrl:runtime.apiUrl,
   gameId:runtime.gameId,chainId:runtime.chainId,fetchImpl});}
  catch(e){walletStatus.textContent='Wallet unavailable: '+e.message;}
  if(optional){
   const consentId=field('Wallet link consent ID'),policyHash=field('Approved wallet-link policy hash');
   const label=document.createElement('label'),allowed=document.createElement('input');allowed.type='checkbox';
   label.append(allowed,document.createTextNode(' I deliberately authorize linking this wallet to my game profile'));main.append(label);
   button('Connect wallet voluntarily',async()=>{try{const addr=await optional.connect();walletStatus.textContent='Selected wallet: '+addr+'. Not linked.';}catch(e){walletStatus.textContent=e.message;}});
   button('Sign and link wallet',async()=>{try{if(!allowed.checked)throw Error('wallet-consent-required');
    await optional.link({consentId:consentId.value,policyHash:policyHash.value,consentAccepted:true});
    walletStatus.textContent='Link accepted by authenticated wallet service.';}catch(e){walletStatus.textContent=e.message;}});
   button('Check scoped wallet link',async()=>{try{const result=await optional.session();
    walletStatus.textContent=result.wallet?'Linked wallet verified for this game profile.':'No linked wallet.';}catch(e){walletStatus.textContent=e.message;}});
   let activityBusy=false;
   button('Read my scoped game activity',async()=>{if(activityBusy)return;activityBusy=true;
    walletStatus.textContent='Indexer: loading authenticated scoped activity…';
    try{const records=await optional.scopedActivity({limit:25});walletStatus.textContent=records.length?
      'Indexer: '+records.length+' scoped activity entries. These are projections, not final settlement.':
      'Indexer: empty. No scoped events were returned; this is not proof that no transaction exists.';
    }catch(e){walletStatus.textContent='Indexer: unavailable or denied ('+e.message+'). No ownership/finality assertion made.';}
    finally{activityBusy=false;}});
   const proofProfile=field('Canonical on-chain profile ID (bytes32)');
   const proofId=field('Entitlement, attestation, mission or progression ID (bytes32)');
   const proofType=field('Entitlement type (bytes32)');
   const proofContent=field('Entitlement content ID (bytes32)');
   const proofAmount=field('Expected reward amount (integer; read-only verification)');
   const proofs=[
    ['ownership','Verify finalized ownership',()=>({profileId:proofProfile.value})],
    ['entitlement','Verify finalized entitlement',()=>({profileId:proofProfile.value,entitlementId:proofId.value,
      entitlementType:proofType.value,contentId:proofContent.value})],
    ['cross-game','Verify finalized cross-game attestation',()=>({profileId:proofProfile.value,attestationId:proofId.value})],
    ['mission-reward','Verify finalized mission reward evidence',()=>({profileId:proofProfile.value,missionId:proofId.value,amount:proofAmount.value})],
    ['progression-reward','Verify finalized progression reward evidence',()=>({profileId:proofProfile.value,trackId:proofId.value,amount:proofAmount.value})]
   ];
   for(const [kind,label,args] of proofs)button(label,async()=>{
    try{const verified=await optional.canonicalProof(kind,args());
     walletStatus.textContent='Independent finalized '+kind+' proof verified at block '+verified.blockHash+'. No payment or claim submitted.';
    }catch(e){walletStatus.textContent=e.message;}
   });
   paragraph('Canonical proof checks require the approved deployed R05.7 verifier, official code-hash manifests, and independent finalized RPC witness. Market listing/trading remains disabled until its separately authorized R04 settlement API is integrated; no local guest achievements can be promoted.');
   // R04 operator-owned canonical settlement; these are user-authorized intents only.
   const marketConsumer=createHighCountryMarketConsumer420({
    apiUrl:runtime.apiUrl,authenticate,assertWalletNetwork:async()=>{if(!optional.getSelected())throw Error('wallet-not-connected');
      const chain=await walletProvider.request({method:'eth_chainId'});
      if(typeof chain!=='string'||BigInt(chain)!==BigInt(runtime.chainId))throw Error('wallet-wrong-network');},fetchImpl});
   const op=field('Unique market operation ID'),listing=field('Approved canonical listing ID');
   const asset=field('Canonical escrow asset ID'),qty=field('Quantity'),price=field('Price in BUDS');
   const expiry=field('Listing expiry (epoch milliseconds)'),transfer=field('Exact canonical transfer operation ID');
   const source=field('Approved reward source'),payload=field('Signed reward payload (base64url)'),signature=field('Signed reward signature (base64url)');
   const marketResult=paragraph('Market intents require independently admitted canonical inventory and operator settlement. Pending is not finalized.');
   marketResult.setAttribute('aria-live','polite');
   let marketBusy=false;
   const action=fn=>async()=>{if(marketBusy){marketResult.textContent='An action is already in progress.';return;}
    marketBusy=true;try{marketResult.textContent='Submitting authenticated intent…';
     const result=await fn();marketResult.textContent='Service accepted intent: '+(result?.status??'received')+
      '. Do not assume finalized transfer or payout.';}catch(e){marketResult.textContent='Denied: '+e.message;}finally{marketBusy=false;}};
   button('Create canonical escrow-backed listing',action(()=>marketConsumer.list({
    operation:op.value,listing:listing.value,asset:asset.value,quantity:Number(qty.value),
    price:Number(price.value),expiresAt:Number(expiry.value)})));
   button('Prepare buyer settlement intent (reserves BUDS)',action(()=>marketConsumer.prepare({
    operation:op.value,listing:listing.value,transferOperation:transfer.value})));
   button('Submit independently signed reward proof',action(()=>marketConsumer.claimReward({
    source:source.value,proof:{payload:payload.value,signature:signature.value}})));
   paragraph('No instant market purchase, transfer submission, escrow finalize/refund or owner-supplied payout is available in this browser. Canonical operator worker and finalized receipts control settlement.');
   // R06.5 observational tracking only. A transaction hash is not proof of a successful trade.
   const txOperation=field('Transaction tracking operation ID');
   const txHash=field('Submitted transaction hash (0x + 64 hexadecimal characters)');
   const txStatus=paragraph('Transaction: empty. No transaction has been submitted by this tracking view.');
   txStatus.setAttribute('aria-live','polite');
   let txTracker;
   try{txTracker=createHighCountryTransactionLifecycle420({rpcUrl:runtime.rpcUrl,
    chainId:runtime.chainId,fetchImpl,storage,witness:globalThis.highCountryIndependentFinalityWitness});}
   catch(e){txStatus.textContent='Transaction tracking unavailable: '+e.message;}
   if(txTracker){
    const past=txTracker.recoveredOperations();
    if(past.length)txStatus.textContent='Recovered '+past.length+
      ' transaction hash(es) as unverified; select an operation and refresh before trusting status.';
    const explain=x=>{txStatus.textContent='Transaction '+x.operation+': '+x.state+
     (x.reason?' ('+x.reason+')':'')+
     (x.blockHash?' at block '+x.blockHash:'')+
     '. Inclusion alone does not confirm market settlement or asset delivery.';};
    const approvedTx=globalThis.highCountryReviewedTransaction;
    if(typeof approvedTx?.submit==='function'){
     button('Request reviewed transaction signature',async()=>{
      try{
       const operation=txOperation.value;
       if(txTracker.status(operation).state==='empty')txTracker.begin(operation);
       if(txTracker.status(operation).state!=='awaiting-signature')throw Error('tx-operation-already-used');
       txStatus.textContent='Transaction '+operation+': awaiting-signature. A user approval is required.';
       const result=await txTracker.submit(operation,{requestSignature:()=>approvedTx.submit({operation,
        gameId:runtime.gameId,chainId:runtime.chainId})});
       txStatus.textContent='Transaction '+operation+': '+result.state+
        (result.txHash?' '+result.txHash:'')+'. Not yet finalized or settled.';
      }catch(e){txStatus.textContent='Transaction signing denied or unknown: '+e.message+
       '. Never automatically resend an ambiguous transaction; inspect a trusted hash first.';}
     });
    }
    button('Track submitted transaction (read only)',()=>{try{explain(txTracker.observe(txOperation.value,txHash.value));}
     catch(e){txStatus.textContent='Tracking denied: '+e.message;}});
    button('Refresh transaction state',async()=>{try{txStatus.textContent='Transaction: loading RPC and independent finality…';
      explain(await txTracker.refresh(txOperation.value));}
     catch(e){txStatus.textContent='Transaction check unavailable: '+e.message;}});
   }
   paragraph('Transaction checks require independent finality to confirm inclusion. Unknown, reverted and reorged states cannot authorize payouts; operator reconciliation remains separately protected.');
   button('Unlink wallet',async()=>{try{await optional.unlink();walletStatus.textContent='Unlinked. Guest play preserved.';}catch(e){walletStatus.textContent=e.message;}});
   button('Disconnect wallet locally',()=>{optional.disconnect();walletStatus.textContent='Disconnected. Guest play preserved.';});
   paragraph('Entitlements, holdings, market, rewards and cross-game records require separately authenticated and finalized authoritative services; unavailable features are disabled, never simulated.');
  }
 }
 paragraph('Cloud backups are historical untrusted previews, never canonical harvests, inventory, BUDS, claims, or wallet entitlement.');
}
