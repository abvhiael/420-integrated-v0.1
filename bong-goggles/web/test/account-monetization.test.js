import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountMonetizationController,parseMonetization,renderAccountMonetization} from '../core/account-monetization.js';
import {resolveRoute,routeAccess} from '../core/routes.js';
import {validateRuntimeConfig} from '../core/runtime-config.js';
import {renderApplicationShell} from '../core/app-shell.js';

const subject='12345678-1234-4123-8123-123456789abc';
const status={app:'bong-goggles',policyVersion:1,version:1,rewardOptIn:true,creatorOptIn:true,
 walletLinked:false,rewardStage:'wallet_required',creatorStage:'operator_programme_required',
 canClaim:false,paid:false,paymentAuthorized:false,financialAuthority:false,source:'420id-consent-v1'};
const ok=(value,code=200)=>({status:code,ok:code>=200&&code<300,headers:{get:()=> 'application/json'},json:async()=>value});
const config={environment:'testnet',appOrigin:'https://bonggoggles.420integrated.org',
 chainId:420420,rpcUrl:'https://rpc.testnet.420integrated.org',
 indexerUrl:'https://api.bonggoggles.testnet.420integrated.org',
 mediaUrl:'https://media.testnet.420integrated.org',messengerUrl:'https://messenger.testnet.420integrated.org',
 notificationsUrl:'https://notifications.testnet.420integrated.org',
 walletUrl:'https://wallet.testnet.420integrated.org',
 explorerUrl:'https://explorer.testnet.420integrated.org'};
test('AUTH-11 is wallet-free and opt-in off by default',()=>{
 const route=resolveRoute('/account/monetization');
 assert.equal(route.requiresSession,false);
 assert.equal(routeAccess(route,{connected:false,supportedNetwork:false}).allowed,true);
 assert.equal(validateRuntimeConfig({...config,features:{accountMonetization:true}}).features.accountMonetization,false);
 assert.equal(validateRuntimeConfig({...config,features:{accountSocial:true,accountMonetization:true}}).features.accountMonetization,true);
 const html=renderApplicationShell({pathname:'/account/monetization',walletView:null});
 assert.match(html,/not active/);
 assert.doesNotMatch(html,/canonical_verification_required/);
});
test('AUTH-11 only displays consent and canonical readiness, never a token payout',()=>{
 assert.ok(parseMonetization(status));
 const html=renderAccountMonetization({status:'ready',programme:status},{enabled:true});
 assert.match(html,/wallet is not required|without a wallet/i);
 assert.match(html,/Nothing claimable or paid|Claimable or paid here/);
 assert.match(html,/Optional verified wallet required/);
 assert.doesNotMatch(html,/eth_sendTransaction|data-wallet-sign|claim\(/);
 assert.match(renderAccountMonetization({status:'guest'},{enabled:true}),/Sign in with 420ID/);
 assert.match(renderAccountMonetization({status:'error'},{enabled:true}),/No stale rewards/);
});
test('AUTH-11 refuses false payments, inconsistent stages or spoofed programme',()=>{
 const bad=[
  {...status,canClaim:true},{...status,paid:true},{...status,paymentAuthorized:true},
  {...status,financialAuthority:true},{...status,app:'doobtube'},
  {...status,source:'browser'},{...status,version:-1},{...status,policyVersion:99},
  {...status,rewardStage:'PAID'},{...status,walletLinked:true},
  {...status,creatorStage:'claimable'},{...status,creatorOptIn:false},
  {...status,rewardOptIn:false},
 ];
 for(const value of bad)assert.equal(parseMonetization(value),null);
});
test('AUTH-11 checks 420ID subject before private response and forgets on failure',async()=>{
 let authenticated=true,valid=true;
 const calls=[];
 const client=new AccountMonetizationController({enabled:true,fetchImpl:async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/v1/me'))return authenticated?ok({walletRequired:false,profile:{subject}}):ok({},401);
  if(url.endsWith('/v1/monetization'))return ok(valid?status:{...status,paid:true});
  throw Error('unexpected URL');
 }});
 await client.refresh();assert.equal(client.state.status,'ready');
 assert.equal(client.state.programme.canClaim,false);
 assert.deepEqual(calls.map(v=>v.url),['/social-api/v1/me','/social-api/v1/monetization']);
 assert.ok(calls.every(v=>v.options.credentials==='same-origin'&&v.options.cache==='no-store'&&v.options.redirect==='error'));
 valid=false;await client.refresh();assert.equal(client.state.status,'error');assert.equal(client.state.programme,undefined);
 authenticated=false;await client.refresh();assert.equal(client.state.status,'guest');assert.equal(client.state.programme,undefined);
});
test('AUTH-11 rejects spoofed user subject and no-wallet financial authority',async()=>{
 const invalidMe=[{walletRequired:false,profile:{subject:'other'}},{walletRequired:true,profile:{subject}},{profile:{subject}}];
 for(const me of invalidMe){
  const client=new AccountMonetizationController({enabled:true,fetchImpl:async url=>
   url.endsWith('/v1/me')?ok(me):ok(status)});
  await client.refresh();assert.equal(client.state.status,'error');
 }
 const unchanged=renderAccountMonetization({status:'ready',programme:{...status,canClaim:true}},{enabled:true});
 assert.doesNotMatch(unchanged,/Optional verified wallet required/);
 assert.match(unchanged,/verification unavailable/i);
});