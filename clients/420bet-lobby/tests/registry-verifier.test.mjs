import test from 'node:test';
import assert from 'node:assert/strict';
import {keccak256,verifyMessage} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {createBetRegistryVerifier,validateBetRegistryManifest,registryManifestDigest,assertIndexerRegistryBinding,assertHistoryRegistryBinding} from '../server/registry-verifier.mjs';
const H=n=>'0x'+n.toString(16).padStart(64,'0'),A=n=>'0x'+n.toString(16).padStart(40,'0');
const CODE='0x6001600055',RUNTIME=keccak256(CODE),chain='420';
function fixture(){
 const contracts=Object.fromEntries([
  'gameRegistry','moduleRegistry','profileRegistry','operatorRegistry',
  'authorization','capabilityRegistry','wagerRegistry','protocolRegistry'
 ].map((name,i)=>[name,{address:A(i+1),runtimeHash:RUNTIME}]));
 const profiles=Object.fromEntries(['randomness','risk','settlement','access'].map((name,i)=>[
  name,{id:H(100+i),type:H(110+i),manifestHash:H(120+i),artifactHash:H(130+i)}]));
 const game={id:'casino-dice',vertical:'casino',gameId:H(31),gameVersionId:H(32),
  moduleId:H(33),moduleVersionId:H(34),rulesetId:H(35),manifestHash:H(36),
  moduleManifestHash:H(37),implementation:A(50),implementationCodeHash:RUNTIME,
  settlement:{address:A(71),runtimeHash:RUNTIME},operatorId:H(38),operatorAccount:A(52),
  operatorManifestHash:H(39),gameMode:1,profiles,
  authorizedRoles:[{action:'game-activate',scope:'game',principal:A(53)},
   {action:'wager-record',scope:'vault',scopeId:H(55),principal:A(54)}]};
 const sources=['casino-router','casino-settlement','poker-ledger','fantasy-contest','sports-tickets']
  .map((role,i)=>({id:'engine-'+(i+1),role,address:A(70+i),runtimeHash:RUNTIME,fromBlock:'1'}));
 const manifest={schema:'bet-registry-manifest-v1',chainId:chain,genesisHash:H(400),
  revision:'1',approved:true,approvalAuthority:A(90),
  approvalDigest:H(401),approvalSignature:'0x'+'c'.repeat(130),contracts,sources,games:[game]};
 const states={
  getGame:{...Object.fromEntries(['gameId','gameVersionId','moduleVersionId','rulesetId','manifestHash'].map(k=>[k,game[k]])),
   randomnessProfileId:profiles.randomness.id,riskProfileId:profiles.risk.id,
   settlementProfileId:profiles.settlement.id,accessPolicyId:profiles.access.id,
   productClass:1,gameMode:1,status:2,exists:true},
  getModule:{moduleId:game.moduleId,moduleVersionId:game.moduleVersionId,
   implementation:game.implementation,manifestHash:game.moduleManifestHash,
   codeHash:game.implementationCodeHash,status:2,exists:true},
  getOperator:{operatorId:game.operatorId,operatorAccount:game.operatorAccount,
   manifestHash:game.operatorManifestHash,status:2,exists:true}
 };
 const calls=[],mutation={reorg:false,chain:420,code:{},signature:true};
 manifest.approvalDigest=registryManifestDigest(validateBetRegistryManifest(manifest));
 const client={
  getChainId:async()=>mutation.chain,
  verifyMessage:async({address,message,signature})=>address===A(90)&&
   message==='420Bet registry manifest v1\\n'+manifest.approvalDigest&&
   signature===manifest.approvalSignature&&mutation.signature,
  getBlock:async({blockNumber,blockTag})=>{
   if(blockNumber===0n)return {number:0n,hash:manifest.genesisHash};
   if(blockTag==='finalized')return {number:500n,hash:H(501)};
   if(blockNumber===500n)return {number:500n,hash:mutation.reorg?H(999):H(501)};
   throw Error('unapproved block');
  },
  getCode:async({address,blockNumber})=>{
   assert.equal(blockNumber,500n);return mutation.code[address.toLowerCase()]??CODE;
  },
  readContract:async({address,functionName,args,blockNumber})=>{
   assert.equal(blockNumber,500n);calls.push({address,functionName,args});
   if(functionName==='modules')return contracts.moduleRegistry.address;
   if(functionName==='profiles')return contracts.profileRegistry.address;
   if(functionName==='authorization')return contracts.authorization.address;
   if(functionName==='capabilityRegistry')return contracts.capabilityRegistry.address;
   if(functionName==='games')return contracts.gameRegistry.address;
   if(functionName==='operators')return contracts.operatorRegistry.address;
   if(functionName==='betRegistry'||functionName==='registry')return contracts.wagerRegistry.address;
   if(functionName==='getGame')return states.getGame;
   if(functionName==='getModule')return states.getModule;
   if(functionName==='getOperator')return states.getOperator;
   if(functionName==='getProfile'){
    const p=Object.values(profiles).find(x=>x.id===args[0]);
    return {profileId:p.id,profileType:p.type,manifestHash:p.manifestHash,
     artifactHash:p.artifactHash,active:true,exists:true};
   }
   if(functionName.startsWith('scopeFor'))return H(1000);
   if(functionName==='isAuthorized')return true;
   if(functionName==='getService')return {active:true,version:1,
    implementation:game.implementation,codeHash:game.implementationCodeHash};
   if(functionName==='getRegistrationProfile')return {manifestHash:H(61)};
   throw Error('unknown function: '+functionName);
  }
 };
 return {manifest,contracts,game,profiles,states,mutation,calls,client,
  verified:()=>createBetRegistryVerifier({manifest,client,trustedApprover:A(90),requiredVerticals:['casino']})};
}
test('canonical on-chain betting registries validate approved game, module, ruleset, settlement and roles',async()=>{
 const f=fixture();
 const out=await f.verified().verify();
 assert.equal(out.qualified,true);assert.equal(out.readOnly,true);
 assert.equal(out.registryBlock,'500');assert.equal(out.games[0].id,f.game.id);
 assert.equal(out.games[0].settlement,f.game.settlement.address);
 assert.equal(f.calls.filter(x=>x.functionName==='getProfile').length,4);
 assert.equal(f.calls.filter(x=>x.functionName==='isAuthorized').length,2);
 assert(f.calls.every(x=>x.args.length===0||x.blockNumber===undefined));
});
test('invalid manifest and conflicting addresses/labels are denied before RPC',()=>{
 const f=fixture();
 assert.throws(()=>validateBetRegistryManifest({...f.manifest,approved:false}),/approval/);
 assert.throws(()=>validateBetRegistryManifest({...f.manifest,chainId:'0'}),/chain/);
 assert.throws(()=>validateBetRegistryManifest({...f.manifest,genesisHash:H(0)}),/genesis/);
 assert.throws(()=>validateBetRegistryManifest({...f.manifest,contracts:{
  ...f.contracts,operatorRegistry:{...f.contracts.operatorRegistry,address:f.contracts.gameRegistry.address}
 }}),/alias/);
 assert.throws(()=>validateBetRegistryManifest({...f.manifest,games:[f.game,{...f.game,id:'other'}]}),/duplicate game version/);
 assert.throws(()=>validateBetRegistryManifest({...f.manifest,games:[{...f.game,authorizedRoles:[]}]}),/roles/);
 assert.throws(()=>validateBetRegistryManifest({...f.manifest,games:[{...f.game,rulesetId:H(0)}]}),/ruleset/);
});
test('wrong chain, forged genesis and reorged finalized block all fail closed',async()=>{
 const f=fixture();
 f.mutation.chain=421;
 await assert.rejects(f.verified().verify(),/wrong chain/);
 f.mutation.chain=420;f.manifest.genesisHash=H(402);
 f.manifest.approvalDigest=registryManifestDigest(validateBetRegistryManifest(f.manifest));
 await assert.rejects(f.verified().verify(),/wrong genesis/);
 f.manifest.genesisHash=H(400);f.manifest.approvalDigest=registryManifestDigest(validateBetRegistryManifest(f.manifest));f.mutation.reorg=true;
 await assert.rejects(f.verified().verify(),/reorg/);
});
test('missing on-chain game, wrong ruleset, wrong module code or unauthorized role denies',async()=>{
 const f=fixture();
 f.states.getGame.status=3;
 await assert.rejects(f.verified().verify(),/paused/);
 f.states.getGame.status=2;f.states.getGame.rulesetId=H(800);
 await assert.rejects(f.verified().verify(),/ruleset/);
 f.states.getGame.rulesetId=f.game.rulesetId;f.mutation.code[f.game.implementation]='0x6002';
 await assert.rejects(f.verified().verify(),/runtime code hash/);
 delete f.mutation.code[f.game.implementation];
 const orig=f.client.readContract;
 f.client.readContract=async args=>args.functionName==='isAuthorized'?false:orig(args);
 await assert.rejects(f.verified().verify(),/authorized role/);
});
test('inactive module, invalid settlement implementation and inactive operator fail closed',async()=>{
 const f=fixture();
 f.states.getModule.status=3;
 await assert.rejects(f.verified().verify(),/module not approved/);
 f.states.getModule.status=2;f.mutation.code[f.game.settlement.address]='0x';
 await assert.rejects(f.verified().verify(),/code absent/);
 delete f.mutation.code[f.game.settlement.address];f.states.getOperator.status=4;
 await assert.rejects(f.verified().verify(),/operator inactive/);
});
test('optional canonical ProtocolRegistry service binding checked against actual implementation',async()=>{
 const f=fixture();
 f.game.protocolService={serviceId:H(60),version:1,manifestHash:H(61)};
 f.manifest.approvalDigest=registryManifestDigest(validateBetRegistryManifest(f.manifest));
 const out=await f.verified().verify();
 assert(out.games.length===1);
 const original=f.client.readContract;
 f.client.readContract=async args=>args.functionName==='getService'?{
  active:true,version:2,implementation:f.game.implementation,codeHash:RUNTIME
 }:original(args);
 await assert.rejects(f.verified().verify(),/ProtocolRegistry service mismatch/);
});
export {fixture};

test('missing external trust anchor, forged approval or changed module hash fail closed',async()=>{
 const f=fixture();
 assert.throws(()=>createBetRegistryVerifier({manifest:f.manifest,client:f.client,requiredVerticals:['casino']}),/trusted approver/);
 assert.throws(()=>createBetRegistryVerifier({manifest:f.manifest,client:f.client,trustedApprover:A(91),requiredVerticals:['casino']}),/wrong authority/);
 f.mutation.signature=false;
 await assert.rejects(f.verified().verify(),/signature not verified/);
 f.mutation.signature=true;f.game.implementationCodeHash=H(901);
 assert.throws(()=>f.verified(),/approval digest/);
});

test('Indexer event source bindings require exact role/address/deployment height from signed Registry manifest',()=>{
 const f=fixture();
 const indexer={chainId:'420',contracts:f.manifest.sources.map(({id,role,address,fromBlock})=>({id,role,address,fromBlock}))};
 assert.equal(assertIndexerRegistryBinding(indexer,validateBetRegistryManifest(f.manifest)),true);
 assert.throws(()=>assertIndexerRegistryBinding({...indexer,chainId:'421'},
  validateBetRegistryManifest(f.manifest)),/chain mismatch/);
 assert.throws(()=>assertIndexerRegistryBinding({...indexer,contracts:indexer.contracts.map((x,i)=>
  i===3?{...x,address:A(900)}:x)},validateBetRegistryManifest(f.manifest)),/not in approved/);
 assert.throws(()=>createBetRegistryVerifier({manifest:f.manifest,client:f.client,trustedApprover:A(90)}),/missing required game vertical/);
});

test('wrong casino settlement source, incorrect wager ledger dependencies fail closed',async()=>{
 const f=fixture();
 const old=f.client.readContract;
 f.client.readContract=async arg=>arg.functionName==='registry'?A(900):old(arg);
 await assert.rejects(f.verified().verify(),/settlement wager Registry mismatch/);
 f.client.readContract=old;
 f.game.settlement.address=A(200);
 assert.throws(()=>f.verified(),/approval digest/);
});

test('independent manifest approval checks genuine EIP-191 signature of immutable config digest',async()=>{
 const f=fixture(),signer=privateKeyToAccount('0x'+'1'.repeat(64));
 f.manifest.approvalAuthority=signer.address;
 f.manifest.approvalSignature=await signer.signMessage({
  message:'420Bet registry manifest v1\\n'+f.manifest.approvalDigest
 });
 f.client.verifyMessage=verifyMessage;
 const valid=createBetRegistryVerifier({manifest:f.manifest,client:f.client,
  trustedApprover:signer.address,requiredVerticals:['casino']});
 assert.equal((await valid.verify()).qualified,true);
 f.manifest.approvalSignature=await privateKeyToAccount('0x'+'2'.repeat(64)).signMessage({
  message:'420Bet registry manifest v1\\n'+f.manifest.approvalDigest
 });
 await assert.rejects(createBetRegistryVerifier({manifest:f.manifest,client:f.client,
  trustedApprover:signer.address,requiredVerticals:['casino']}).verify(),/signature not verified/);
});

test('all four product classes require their own actual registered version/ruleset/module',async()=>{
 const f=fixture(),more=[
  ['poker','poker-nlhe',4,2],['fantasy','fantasy-contest',3,3],['sportsbook','sports-tickets',2,4]
 ].map(([vertical,id,productClass,i])=>({
  ...f.game,id,vertical,gameId:H(200+i),gameVersionId:H(210+i),
  moduleId:H(220+i),moduleVersionId:H(230+i),rulesetId:H(240+i),
  manifestHash:H(250+i),moduleManifestHash:H(260+i),
  gameMode:vertical==='poker'?2:vertical==='fantasy'?3:4,
  productClass
 }));
 f.manifest.games.push(...more);
 f.manifest.approvalDigest=registryManifestDigest(validateBetRegistryManifest(f.manifest));
 const original=f.client.readContract;
 f.client.readContract=async p=>{
  if(p.functionName==='getGame'){
   const game=more.find(g=>g.gameVersionId===p.args[0]);
   if(game)return {...f.states.getGame,gameId:game.gameId,gameVersionId:game.gameVersionId,
    moduleVersionId:game.moduleVersionId,rulesetId:game.rulesetId,manifestHash:game.manifestHash,
    productClass:game.productClass,gameMode:game.gameMode};
  }
  if(p.functionName==='getModule'){
   const game=more.find(g=>g.moduleVersionId===p.args[0]);
   if(game)return {...f.states.getModule,moduleId:game.moduleId,moduleVersionId:game.moduleVersionId,
    manifestHash:game.moduleManifestHash};
  }
  return original(p);
 };
 const result=await createBetRegistryVerifier({manifest:f.manifest,client:f.client,
  trustedApprover:A(90)}).verify();
 assert.equal(result.games.length,4);
 assert.deepEqual(new Set(result.games.map(x=>x.vertical)),new Set(['casino','poker','fantasy','sportsbook']));
 const withFour=f.client.readContract;
 f.client.readContract=async p=>{
  if(p.functionName==='getGame'&&p.args[0]===more[2].gameVersionId)
   return {...f.states.getGame,gameId:more[2].gameId,
    gameVersionId:more[2].gameVersionId,moduleVersionId:more[2].moduleVersionId,
    rulesetId:more[2].rulesetId,manifestHash:more[2].manifestHash,
    gameMode:more[2].gameMode,productClass:3,status:2,exists:true};
  return withFour(p);
 };
 await assert.rejects(createBetRegistryVerifier({manifest:f.manifest,client:f.client,
  trustedApprover:A(90)}).verify(),/vertical\/mode mismatch/);
});

test('history service binds to approved versioned game implementation, never unapproved router or alias',()=>{
 const f=fixture(),config=validateBetRegistryManifest(f.manifest);
 assert.equal(assertHistoryRegistryBinding({chainId:420,
  gameContracts:{'casino-dice':[f.game.implementation]}},config),true);
 assert.throws(()=>assertHistoryRegistryBinding({chainId:421,
  gameContracts:{'casino-dice':[f.game.implementation]}},config),/chain mismatch/);
 assert.throws(()=>assertHistoryRegistryBinding({chainId:420,
  gameContracts:{'casino-dice':[f.manifest.sources[0].address]}},config),/unapproved/);
 assert.throws(()=>assertHistoryRegistryBinding({chainId:420,
  gameContracts:{'unknown':[f.game.implementation]}},config),/unapproved/);
});
