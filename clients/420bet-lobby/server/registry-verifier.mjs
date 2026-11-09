// BET-AUDIT-7 — canonical 420Bet registry verifier.
// Read-only; no game activation, transaction signing, settlement or wallet permissions.
import {keccak256,toHex} from 'viem';
const ADDR=/^0x[0-9a-fA-F]{40}$/;
const HASH=/^0x[0-9a-fA-F]{64}$/;
const UINT=/^[1-9][0-9]*$/;
const ZERO='0x'+'0'.repeat(64);
const ZERO_ADDR='0x'+'0'.repeat(40);
const GAME_STATUSES=['NONE','REGISTERED','ACTIVE','PAUSED','DEPRECATED'];
const MODULE_STATUSES=['NONE','REGISTERED','APPROVED','PAUSED','DEPRECATED'];
const OPERATOR_STATUSES=['NONE','REGISTERED','ACTIVE','PAUSED','REVOKED'];
const PRODUCT_CLASSES={casino:1,sportsbook:2,fantasy:3,poker:4};
const ROLE_ACTIONS={
 'game-register':'BET_GAME_REGISTER','game-activate':'BET_GAME_ACTIVATE',
 'game-pause':'BET_GAME_PAUSE','module-approve':'BET_MODULE_APPROVE',
 'operator-activate':'BET_OPERATOR_ACTIVATE','wager-record':'BET_WAGER_RECORD',
 'wager-settle-record':'BET_WAGER_SETTLE_RECORD'
};
const requireValid=(condition,message)=>{if(!condition)throw Error('420Registry: '+message);};
const normAddress=(v,label='address')=>{requireValid(typeof v==='string'&&ADDR.test(v)&&v.toLowerCase()!==ZERO_ADDR,'invalid '+label);return v.toLowerCase();};
const normHash=(v,label='bytes32')=>{requireValid(typeof v==='string'&&HASH.test(v)&&v.toLowerCase()!==ZERO,'invalid '+label);return v.toLowerCase();};
const uint=(v,label)=>{requireValid(typeof v==='string'&&UINT.test(v),'invalid '+label);return BigInt(v);};
const record=fields=>({type:'tuple',components:fields.map(([name,type])=>({name,type}))});
const GAME_FIELDS=[
 ['gameId','bytes32'],['gameVersionId','bytes32'],['moduleVersionId','bytes32'],
 ['rulesetId','bytes32'],['randomnessProfileId','bytes32'],['riskProfileId','bytes32'],
 ['settlementProfileId','bytes32'],['accessPolicyId','bytes32'],['manifestHash','bytes32'],
 ['productClass','uint8'],['gameMode','uint8'],['registeredAt','uint64'],
 ['status','uint8'],['exists','bool']
];
const MODULE_FIELDS=[
 ['moduleId','bytes32'],['moduleVersionId','bytes32'],['implementation','address'],
 ['manifestHash','bytes32'],['codeHash','bytes32'],['registeredAt','uint64'],
 ['status','uint8'],['exists','bool']
];
const PROFILE_FIELDS=[
 ['profileId','bytes32'],['profileType','bytes32'],['manifestHash','bytes32'],
 ['artifactHash','bytes32'],['registeredAt','uint64'],['active','bool'],['exists','bool']
];
const OPERATOR_FIELDS=[
 ['operatorId','bytes32'],['operatorAccount','address'],['manifestHash','bytes32'],
 ['registeredAt','uint64'],['status','uint8'],['exists','bool']
];
export const BET_REGISTRY_ABI=[
 {type:'function',name:'getGame',stateMutability:'view',inputs:[{name:'gameVersionId',type:'bytes32'}],outputs:[record(GAME_FIELDS)]},
 {type:'function',name:'getModule',stateMutability:'view',inputs:[{name:'moduleVersionId',type:'bytes32'}],outputs:[record(MODULE_FIELDS)]},
 {type:'function',name:'getProfile',stateMutability:'view',inputs:[{name:'profileId',type:'bytes32'}],outputs:[record(PROFILE_FIELDS)]},
 {type:'function',name:'getOperator',stateMutability:'view',inputs:[{name:'operatorId',type:'bytes32'}],outputs:[record(OPERATOR_FIELDS)]},
 {type:'function',name:'getService',stateMutability:'view',inputs:[{name:'serviceId',type:'bytes32'}],outputs:[record([
  ['implementation','address'],['codeHash','bytes32'],['metadataHash','bytes32'],
  ['version','uint32'],['activatedAt','uint64'],['active','bool']
 ])]},
 {type:'function',name:'getRegistrationProfile',stateMutability:'view',
  inputs:[{name:'serviceId',type:'bytes32'},{name:'version',type:'uint32'}],
  outputs:[record([['componentType','uint8'],['manifestHash','bytes32'],
   ['dependencyRoot','bytes32'],['interfaceHash','bytes32']])]},
 {type:'function',name:'authorization',stateMutability:'view',inputs:[],outputs:[{type:'address'}]},
 {type:'function',name:'modules',stateMutability:'view',inputs:[],outputs:[{type:'address'}]},
 {type:'function',name:'profiles',stateMutability:'view',inputs:[],outputs:[{type:'address'}]},
 {type:'function',name:'capabilityRegistry',stateMutability:'view',inputs:[],outputs:[{type:'address'}]},
 {type:'function',name:'isAuthorized',stateMutability:'view',
  inputs:[{name:'principal',type:'address'},{name:'actionId',type:'bytes32'},
   {name:'scopeHash',type:'bytes32'},{name:'amount',type:'uint256'}],
  outputs:[{type:'bool'}]},
 {type:'function',name:'scopeForGame',stateMutability:'pure',
  inputs:[{type:'bytes32'},{type:'bytes32'}],outputs:[{type:'bytes32'}]},
 {type:'function',name:'scopeForModule',stateMutability:'pure',
  inputs:[{type:'bytes32'},{type:'bytes32'}],outputs:[{type:'bytes32'}]},
 {type:'function',name:'scopeForOperator',stateMutability:'pure',
  inputs:[{type:'bytes32'}],outputs:[{type:'bytes32'}]},
 {type:'function',name:'scopeForWager',stateMutability:'pure',
  inputs:[{type:'bytes32'}],outputs:[{type:'bytes32'}]},
 {type:'function',name:'scopeForVault',stateMutability:'pure',
  inputs:[{type:'bytes32'}],outputs:[{type:'bytes32'}]}
];
export const BET_REGISTRY_COMPONENT='registry-verifier-v1';
export function validateBetRegistryManifest(raw){
 requireValid(raw&&typeof raw==='object'&&!Array.isArray(raw),'missing approved manifest');
 requireValid(raw.schema==='bet-registry-manifest-v1','unsupported manifest version');
 const chainId=uint(raw.chainId,'chain ID');
 requireValid(chainId<=BigInt(Number.MAX_SAFE_INTEGER),'chain ID overflow');
 const genesisHash=normHash(raw.genesisHash,'genesis hash');
 const revision=uint(raw.revision,'manifest revision');
 const manifestApproval=normHash(raw.approvalDigest,'approval digest');
 requireValid(raw.approved===true,'independent approval absent');
 const approvalAuthority=normAddress(raw.approvalAuthority,'independent approval authority');
 requireValid(typeof raw.approvalSignature==='string'&&
  /^0x[0-9a-fA-F]{130}$/.test(raw.approvalSignature),'signed approval missing');
 requireValid(raw.contracts&&typeof raw.contracts==='object','missing registry bindings');
 const required=['gameRegistry','moduleRegistry','profileRegistry','operatorRegistry','authorization','capabilityRegistry'];
 const contracts={};
 for(const role of required){
  const c=raw.contracts[role];requireValid(c&&typeof c==='object','missing '+role);
  contracts[role]={address:normAddress(c.address,role),runtimeHash:normHash(c.runtimeHash,role+' runtime')};
 }
 if(raw.contracts.protocolRegistry)contracts.protocolRegistry={
  address:normAddress(raw.contracts.protocolRegistry.address,'protocolRegistry'),
  runtimeHash:normHash(raw.contracts.protocolRegistry.runtimeHash,'protocolRegistry runtime')
 };
 requireValid(new Set(Object.values(contracts).map(x=>x.address)).size===Object.keys(contracts).length,
  'registry contract address alias');
 requireValid(Array.isArray(raw.games)&&raw.games.length>0&&raw.games.length<=100,'invalid game manifest');
 const ids=new Set(),versions=new Set(),games=raw.games.map(g=>{
  requireValid(g&&typeof g==='object'&&/^[a-z][a-z0-9-]{0,48}$/.test(g.id),'invalid game label');
  requireValid(Object.hasOwn(PRODUCT_CLASSES,g.vertical),'unsupported game vertical');
  requireValid(!ids.has(g.id),'duplicate game label');ids.add(g.id);
  const gameId=normHash(g.gameId,'game ID'),gameVersionId=normHash(g.gameVersionId,'game version');
  requireValid(!versions.has(gameVersionId),'duplicate game version');versions.add(gameVersionId);
  const moduleId=normHash(g.moduleId,'module ID'),moduleVersionId=normHash(g.moduleVersionId,'module version');
  const rulesetId=normHash(g.rulesetId,'ruleset ID'),gameManifestHash=normHash(g.manifestHash,'game manifest');
  const moduleManifestHash=normHash(g.moduleManifestHash,'module manifest');
  const implementation=normAddress(g.implementation,'module implementation');
  const implementationCodeHash=normHash(g.implementationCodeHash,'module runtime');
  const settlement=normAddress(g.settlement.address,'settlement contract');
  const settlementCodeHash=normHash(g.settlement.runtimeHash,'settlement runtime');
  const operatorId=normHash(g.operatorId,'operator ID'),operatorAccount=normAddress(g.operatorAccount,'operator account');
  const operatorManifestHash=normHash(g.operatorManifestHash,'operator manifest');
  const profileKinds=['randomness','risk','settlement','access'];
  const profiles={};
  for(const kind of profileKinds){
   const p=g.profiles?.[kind];
   requireValid(p&&typeof p==='object','missing '+kind+' profile');
   profiles[kind]={id:normHash(p.id,kind+' profile ID'),
    type:normHash(p.type,kind+' profile type'),
    manifestHash:normHash(p.manifestHash,kind+' profile manifest'),
    artifactHash:normHash(p.artifactHash,kind+' profile artifact')};
  }
  requireValid(g.gameMode>=1&&Number.isInteger(g.gameMode)&&g.gameMode<=5,'unsupported game mode');
  requireValid(Array.isArray(g.authorizedRoles)&&g.authorizedRoles.length>0&&g.authorizedRoles.length<=16,
   'missing authorized roles');
  const roleKeys=new Set(),authorizedRoles=g.authorizedRoles.map(role=>{
   requireValid(role&&Object.hasOwn(ROLE_ACTIONS,role.action)&&
    ['game','module','operator','wager','vault'].includes(role.scope),'unsupported action or scope');
   const principal=normAddress(role.principal,'role principal');
   const id=role.scope==='wager'||role.scope==='vault'?normHash(role.scopeId,'role subject ID'):null;
   requireValid(role.scope==='wager'||role.scope==='vault'?Boolean(id):role.scopeId===undefined,
    'unexpected role scope ID');
   const key=role.action+':'+role.scope+':'+principal+':'+(id??'');
   requireValid(!roleKeys.has(key),'duplicate role');roleKeys.add(key);
   const amount=role.amount===undefined?0n:BigInt(role.amount);
   requireValid(amount>=0n&&amount<=(1n<<256n)-1n,'invalid role amount');
   return {action:role.action,scope:role.scope,principal,scopeId:id,amount:amount.toString()};
  });
  const protocolService=g.protocolService;
  if(protocolService){
   requireValid(Boolean(contracts.protocolRegistry),'protocol service needs ProtocolRegistry');
   normHash(protocolService.serviceId,'protocol service ID');
   requireValid(Number.isInteger(protocolService.version)&&protocolService.version>0&&
    protocolService.version<=4294967295,'invalid service version');
   normHash(protocolService.manifestHash,'protocol service manifest');
  }
  return {id:g.id,vertical:g.vertical,gameId,gameVersionId,moduleId,moduleVersionId,
   rulesetId,manifestHash:gameManifestHash,moduleManifestHash,implementation,
   implementationCodeHash,settlement:{address:settlement,runtimeHash:settlementCodeHash},
   operatorId,operatorAccount,operatorManifestHash,gameMode:g.gameMode,profiles,authorizedRoles,
   protocolService:protocolService?{serviceId:protocolService.serviceId.toLowerCase(),
    version:protocolService.version,manifestHash:protocolService.manifestHash.toLowerCase()}:null};
 });
 const result={schema:raw.schema,chainId:chainId.toString(),genesisHash,revision:revision.toString(),
  approvalDigest:manifestApproval,approvalAuthority,
  approvalSignature:raw.approvalSignature.toLowerCase(),contracts,games};
 return Object.freeze(result);
}
function fieldsMatch(actual,expected,names){
 for(const name of names)requireValid(
  typeof expected[name]==='string'?String(actual?.[name]).toLowerCase()===expected[name]:
   typeof expected[name]==='bigint'?BigInt(actual?.[name])===expected[name]:
   actual?.[name]===expected[name],'registry '+name+' mismatch');
}
function stableStringify(value){
 if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';
 if(value&&typeof value==='object')
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function registryManifestDigest(config){
 const {approvalDigest,approvalAuthority,approvalSignature,...body}=config;
 return keccak256(toHex(stableStringify(body)));
}
export function createBetRegistryVerifier({manifest,client,trustedApprover}={}){
 const config=validateBetRegistryManifest(manifest);
 const signer=normAddress(trustedApprover,'trusted approver');
 requireValid(config.approvalAuthority===signer,'manifest approved by wrong authority');
 requireValid(registryManifestDigest(config)===config.approvalDigest,
  'signed approval digest does not match configuration');
 requireValid(client&&typeof client.getChainId==='function'&&typeof client.getBlock==='function'&&
  typeof client.getCode==='function'&&typeof client.readContract==='function'&&
  typeof client.verifyMessage==='function','qualified read-only public client required');
 async function verify(){
  // Approval binds every contract address, ruleset, operator, runtime and
  // required capability role. The trust anchor comes from outside the manifest.
  const approved=await client.verifyMessage({address:signer,
   message:'420Bet registry manifest v1\\n'+config.approvalDigest,
   signature:config.approvalSignature});
  requireValid(approved===true,'independent manifest signature not verified');
  // Every call is pinned to exactly ONE finalized block, preventing mixed-version reads.
  const liveChain=await client.getChainId();
  requireValid(BigInt(liveChain)===BigInt(config.chainId),'wrong chain');
  const genesis=await client.getBlock({blockNumber:0n});
  requireValid(genesis?.hash?.toLowerCase()===config.genesisHash,'wrong genesis');
  const head=await client.getBlock({blockTag:'finalized'});
  requireValid(head?.hash&&/^0x[0-9a-fA-F]{64}$/.test(head.hash)&&
   typeof head.number==='bigint'&&head.number>=0n,'finalized block unavailable');
  const blockNumber=head.number;
  async function read(address,functionName,args=[]){
   return client.readContract({address,abi:BET_REGISTRY_ABI,functionName,args,blockNumber});
  }
  const bindings=config.contracts,codeAt=new Map();
  async function checkCode(address,expected){
   const key=address.toLowerCase();
   if(codeAt.has(key))requireValid(codeAt.get(key)===expected,'conflicting runtime hash manifest');
   else{
    const code=await client.getCode({address,blockNumber});
    requireValid(typeof code==='string'&&/^0x(?:[0-9a-fA-F]{2})+$/.test(code)&&code!=='0x00','deployed code absent');
    requireValid(keccak256(code).toLowerCase()===expected,'runtime code hash mismatch');
    codeAt.set(key,expected);
   }
  }
  for(const binding of Object.values(bindings))await checkCode(binding.address,binding.runtimeHash);
  const gameReg=bindings.gameRegistry.address,moduleReg=bindings.moduleRegistry.address,
   profileReg=bindings.profileRegistry.address,operatorReg=bindings.operatorRegistry.address,
   auth=bindings.authorization.address;
  requireValid(normAddress(await read(gameReg,'modules'))===moduleReg,'module Registry dependency mismatch');
  requireValid(normAddress(await read(gameReg,'profiles'))===profileReg,'profile Registry dependency mismatch');
  for(const registry of [gameReg,moduleReg,profileReg,operatorReg])
   requireValid(normAddress(await read(registry,'authorization'))===auth,'authorization dependency mismatch');
  requireValid(normAddress(await read(auth,'capabilityRegistry'))===bindings.capabilityRegistry.address,
   'capability Registry dependency mismatch');
  const evidence=[];
  for(const game of config.games){
   const actual=await read(gameReg,'getGame',[game.gameVersionId]);
   requireValid(actual?.exists===true&&Number(actual.status)===GAME_STATUSES.indexOf('ACTIVE'),
    'game missing, paused or deprecated: '+game.id);
   for(const [field,wanted] of Object.entries({
    gameId:game.gameId,gameVersionId:game.gameVersionId,moduleVersionId:game.moduleVersionId,
    rulesetId:game.rulesetId,manifestHash:game.manifestHash,
    randomnessProfileId:game.profiles.randomness.id,riskProfileId:game.profiles.risk.id,
    settlementProfileId:game.profiles.settlement.id,accessPolicyId:game.profiles.access.id
   }))requireValid(String(actual[field]).toLowerCase()===wanted,field+' mismatch for '+game.id);
   requireValid(Number(actual.productClass)===PRODUCT_CLASSES[game.vertical]&&
    Number(actual.gameMode)===game.gameMode,'game vertical/mode mismatch');
   const mod=await read(moduleReg,'getModule',[game.moduleVersionId]);
   requireValid(mod?.exists===true&&Number(mod.status)===MODULE_STATUSES.indexOf('APPROVED'),
    'module not approved for '+game.id);
   for(const [field,wanted] of Object.entries({
    moduleId:game.moduleId,moduleVersionId:game.moduleVersionId,
    implementation:game.implementation,manifestHash:game.moduleManifestHash,
    codeHash:game.implementationCodeHash
   }))requireValid(String(mod[field]).toLowerCase()===wanted,'module '+field+' mismatch');
   await checkCode(game.implementation,game.implementationCodeHash);
   // BetGameRegistry records a settlement *profile*, NOT a settlement address.
   // The approved manifest must independently bind the code-hashed settlement target.
   await checkCode(game.settlement.address,game.settlement.runtimeHash);
   for(const p of Object.values(game.profiles)){
    const current=await read(profileReg,'getProfile',[p.id]);
    requireValid(current?.exists===true&&current.active===true,'inactive profile');
    for(const [field,wanted] of Object.entries({profileId:p.id,profileType:p.type,
     manifestHash:p.manifestHash,artifactHash:p.artifactHash}))
     requireValid(String(current[field]).toLowerCase()===wanted,'profile '+field+' mismatch');
   }
   const operator=await read(operatorReg,'getOperator',[game.operatorId]);
   requireValid(operator?.exists===true&&Number(operator.status)===OPERATOR_STATUSES.indexOf('ACTIVE'),
    'operator inactive or revoked');
   for(const [field,wanted] of Object.entries({operatorId:game.operatorId,
    operatorAccount:game.operatorAccount,manifestHash:game.operatorManifestHash}))
    requireValid(String(operator[field]).toLowerCase()===wanted,'operator '+field+' mismatch');
   for(const role of game.authorizedRoles){
    const name='scopeFor'+role.scope[0].toUpperCase()+role.scope.slice(1);
    const args=role.scope==='game'?[game.gameId,game.gameVersionId]:
     role.scope==='module'?[game.moduleId,game.moduleVersionId]:
     role.scope==='operator'?[game.operatorId]:[role.scopeId];
    const hash=await read(auth,name,args);
    requireValid(typeof hash==='string'&&HASH.test(hash)&&hash.toLowerCase()!==ZERO,'invalid role scope');
    const actionId=keccak256(new TextEncoder().encode(ROLE_ACTIONS[role.action]));
    const granted=await read(auth,'isAuthorized',[role.principal,actionId,hash,BigInt(role.amount)]);
    requireValid(granted===true,'missing or revoked authorized role: '+role.action);
   }
   if(game.protocolService){
    const r=bindings.protocolRegistry.address;
    const service=await read(r,'getService',[game.protocolService.serviceId]);
    requireValid(service.active===true&&Number(service.version)===game.protocolService.version&&
     String(service.implementation).toLowerCase()===game.implementation&&
     String(service.codeHash).toLowerCase()===game.implementationCodeHash,
     'ProtocolRegistry service mismatch');
    const profile=await read(r,'getRegistrationProfile',[game.protocolService.serviceId,game.protocolService.version]);
    requireValid(String(profile.manifestHash).toLowerCase()===game.protocolService.manifestHash,
     'ProtocolRegistry service manifest mismatch');
   }
   evidence.push({id:game.id,vertical:game.vertical,gameVersionId:game.gameVersionId,
    rulesetId:game.rulesetId,moduleVersionId:game.moduleVersionId,settlement:game.settlement.address,
    roleCount:game.authorizedRoles.length});
  }
  const headAfter=await client.getBlock({blockNumber});
  requireValid(headAfter?.hash?.toLowerCase()===head.hash.toLowerCase(),'registry block reorg during verification');
  return Object.freeze({qualified:true,readOnly:true,chainId:config.chainId,
   registryBlock:blockNumber.toString(),registryBlockHash:head.hash.toLowerCase(),
   manifestRevision:config.revision,approvalDigest:config.approvalDigest,games:evidence});
 }
 return Object.freeze({config,verify});
}
