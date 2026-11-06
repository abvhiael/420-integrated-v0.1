import {createPublicClient,http,keccak256} from 'viem';
import {createHash} from 'node:crypto';
const A=t=>({type:t,name:'',internalType:t});
const C=(name,type)=>({name,type});
const configFields=[C('tableId','bytes32'),C('gameVersionId','bytes32'),C('rulesetId','bytes32'),C('operatorId','bytes32'),
 C('vaultId','bytes32'),C('rakePolicyHash','bytes32'),C('trustPolicyHash','bytes32'),C('asset','address'),
 C('seats','uint8'),C('smallBlind','uint256'),C('bigBlind','uint256'),C('minBuyIn','uint256'),
 C('maxBuyIn','uint256'),C('maxRakeBps','uint16')];
const abiFn=(name,inputs,outputs)=>({type:'function',name,stateMutability:'view',
 inputs:inputs.map(([name,type])=>({name,type})),outputs});
const registryABI=[
 abiFn('getTable',[['id','bytes32']],[{type:'tuple',name:'',components:[
 {type:'tuple',name:'config',components:configFields},C('configHash','bytes32'),C('controller','address'),
 C('status','uint8'),C('createdAt','uint64'),C('exists','bool')]}]),
 abiFn('operators',[],[A('address')])
];
const ledgerABI=[
 abiFn('seatOf',[['id','bytes32'],['seat','uint8']],[{type:'tuple',name:'',components:[C('player','address'),C('chips','uint256'),C('sittingOut','bool'),C('epoch','uint64')]}]),
 abiFn('activeHand',[['id','bytes32']],[A('bytes32')]),
 abiFn('seatingEpoch',[['id','bytes32']],[A('uint64')]),
 abiFn('playerSeatPlusOne',[['id','bytes32'],['player','address']],[A('uint8')])
];
const gameFields=[
 C('tableId','bytes32'),C('stateRoot','bytes32'),C('seatsMask','uint16'),C('pendingMask','uint16'),
 C('button','uint8'),C('smallBlindSeat','uint8'),C('bigBlindSeat','uint8'),C('toAct','uint8'),
 C('nonce','uint64'),C('deadline','uint64'),C('actionTimeout','uint32'),
 C('currentBet','uint256'),C('minRaise','uint256'),C('initialChips','uint256'),
 C('pot','uint256'),C('phase','uint8'),C('initialized','bool')
];
const playerFields=['stack','bet','contributed','lastFacing'].map(name=>C(name,'uint256'))
 .concat(['acted','folded','allIn'].map(name=>C(name,'bool')));
const engineABI=[
 abiFn('gameOf',[['handId','bytes32']],[{type:'tuple',name:'',components:gameFields}]),
 abiFn('playerOf',[['handId','bytes32'],['seat','uint8']],[{type:'tuple',name:'',components:playerFields}]),
 abiFn('revealForTable',[['id','bytes32']],[A('address')]),
 abiFn('ledger',[],[A('address')]),
 abiFn('deals',[],[A('address')]),
 abiFn('shuffle',[],[A('address')])
];
const shuffleABI=[abiFn('recordOf',[['handId','bytes32']],[{type:'tuple',name:'',components:[
 C('initialDeckRoot','bytes32'),C('firstDeckRoot','bytes32'),C('finalDeckRoot','bytes32'),
 C('stageOneProofHash','bytes32'),C('stageTwoProofHash','bytes32'),C('stage','uint8')]}])];
const dealABI=[abiFn('getHand',[['handId','bytes32']],[{type:'tuple',name:'',components:[
 C('tableId','bytes32'),C('configHash','bytes32'),C('rulesetId','bytes32'),C('versionId','bytes32'),
 C('priorStateHash','bytes32'),C('seatSnapshotHash','bytes32'),C('epoch','uint64'),C('nonce','uint64'),
 C('deadline','uint64'),C('rootA','bytes32'),C('rootB','bytes32'),C('transcriptCommitment','bytes32'),C('state','uint8')]}])];
const revealABI=[abiFn('slotOf',[['handId','bytes32'],['pos','uint8']],[{type:'tuple',name:'',components:
 ['c1x','c1y','c2x','c2y','dax','day','dbx','dby'].map(n=>C(n,'uint256')).concat([
 C('shareA','bool'),C('shareB','bool'),C('opened','bool'),C('card','uint8')])}])];
const operatorABI=[abiFn('isActive',[['id','bytes32']],[A('bool')])];
const ZERO='0x'+'0'.repeat(64),ZERO_ADDR='0x'+'0'.repeat(40);
export const NATIVE_PHASES=Object.freeze(['NONE','PREFLOP','AWAIT_FLOP','FLOP','AWAIT_TURN','TURN','AWAIT_RIVER','RIVER','SHOWDOWN','UNCONTESTED']);
const safe=v=>{const n=typeof v==='bigint'?Number(v):v;if(!Number.isSafeInteger(n)||n<0)throw Error('unsafe chain integer');return n;};
const addr=s=>typeof s==='string'&&/^0x[a-f0-9]{40}$/i.test(s)&&s.toLowerCase()!==ZERO_ADDR;
const hex=s=>typeof s==='string'&&/^0x[a-f0-9]{64}$/i.test(s)&&s.toLowerCase()!==ZERO;
const hash=x=>'0x'+createHash('sha256').update(x).digest('hex');
const id=s=>typeof s==='string'&&/^0x[a-f0-9]{64}$/i.test(s);
function cardAt(i){
 const ranks=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
 // PokerHandRank420 uses suit * 13 + rankIndex, from the native hand evaluator.
 // Visually assigned suit order is pinned by the actual application ruleset.
 const suits=['♠','♥','♦','♣'];
 if(!Number.isInteger(i)||i<0||i>=52)throw Error('invalid proven card');
 return {rank:ranks[i%13],suit:suits[Math.floor(i/13)]};
}
function pinnedContracts(raw){
 for(const key of ['registry','ledger','engine','deals','shuffle','reveals'])
  if(!addr(raw?.[key]))throw Error('missing authoritative contract '+key);
 for(const key of ['registry','ledger','engine','deals','shuffle','reveals'])
  if(!hex(raw?.codeHashes?.[key]))throw Error('missing code hash '+key);
 return raw;
}
export function createCanonicalPokerReader({rpcUrl,chainId,contracts,clientOverride}={}){
 if(!Number.isSafeInteger(chainId)||chainId<1)throw Error('invalid chain');
 pinnedContracts(contracts);
 if(!clientOverride){
  const url=new URL(rpcUrl);
  if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search)
   throw Error('only HTTPS RPC without embedded secrets is permitted');
 }
 const rpc=clientOverride||createPublicClient({transport:http(rpcUrl,{retryCount:0,timeout:8000})});
 async function call(address,abi,functionName,args,blockNumber){
  return rpc.readContract({address,abi,functionName,args,blockNumber});
 }
 async function readTable(binding,{subject,chainId:requested}={}){
  if(requested!==chainId||!addr(subject)||!id(binding?.tableId)||!hex(binding?.configHash))throw Error('wrong read scope');
  const actual=await rpc.getChainId();if(actual!==chainId)throw Error('RPC wrong chain');
  // finalized block pin is mandatory; fallback latest/safe is forbidden.
  const block=await rpc.getBlock({blockTag:'finalized'});
  if(!block||!hex(block.hash)||!block.number||!block.timestamp)throw Error('finalized block unavailable');
  const at=block.number;
  for(const key of ['registry','ledger','engine','deals','shuffle','reveals']){
   const code=await rpc.getBytecode({address:contracts[key],blockNumber:at});
   if(!code||keccak256(code).toLowerCase()!==contracts.codeHashes[key].toLowerCase())
    throw Error('contract runtime code hash mismatch: '+key);
  }
  const r=await call(contracts.registry,registryABI,'getTable',[binding.tableId],at);
  if(!r.exists||safe(r.status)!==3||r.config.tableId.toLowerCase()!==binding.tableId.toLowerCase()||
   r.configHash.toLowerCase()!==binding.configHash.toLowerCase()||
   ![2,3,4,5,6,7,8,9].includes(safe(r.config.seats)))throw Error('registry table not open/approved');
  const operators=await call(contracts.registry,registryABI,'operators',[],at);
  if(!await call(operators,operatorABI,'isActive',[r.config.operatorId],at))throw Error('table operator inactive');
  if(safe(r.config.smallBlind)!==binding.smallBlind||safe(r.config.bigBlind)!==binding.bigBlind)
   throw Error('blind policy mismatch');
  const epoch=await call(contracts.ledger,ledgerABI,'seatingEpoch',[binding.tableId],at);
  const active=await call(contracts.ledger,ledgerABI,'activeHand',[binding.tableId],at);
  const seats=[];
  for(let i=0;i<safe(r.config.seats);i++){
   const s=await call(contracts.ledger,ledgerABI,'seatOf',[binding.tableId,i],at);
   const occupied=addr(s.player);
   seats.push({index:i,status:!occupied?'empty':s.sittingOut?'sitting-out':'active',
     owner:occupied?s.player.toLowerCase():null,stack:safe(s.chips),committed:0});
  }
  let hand={nonce:0,actionNonce:0,pot:0,deadline:0,turnSeat:0,dealerSeat:0,community:[],phase:'TABLE_OPEN'};
  let dealProofVerified=false,seatEpochVerified=false,revealsVerified=false,engineVerified=false,tableVersionVerified=false,deckRoot=null;
  let stateHash=hash([block.hash,binding.tableId,r.configHash,String(epoch),...seats.map(s=>s.owner+':'+s.stack)].join('|'));
  if(active!==ZERO){
   if(!id(active))throw Error('invalid funded hand');
   // Runtime association must match the registry, deal provider and ledger.
   const [led,deals,shuffle,reveal]=await Promise.all([
    call(contracts.engine,engineABI,'ledger',[],at),call(contracts.engine,engineABI,'deals',[],at),
    call(contracts.engine,engineABI,'shuffle',[],at),
    call(contracts.engine,engineABI,'revealForTable',[binding.tableId],at)
   ]);
   if(led.toLowerCase()!==contracts.ledger.toLowerCase()||
      deals.toLowerCase()!==contracts.deals.toLowerCase()||
      shuffle.toLowerCase()!==contracts.shuffle.toLowerCase()||
      reveal.toLowerCase()!==contracts.reveals.toLowerCase())
     throw Error('NLHE module binding mismatch');
   const [g,d,s]=await Promise.all([
    call(contracts.engine,engineABI,'gameOf',[active],at),
    call(contracts.deals,dealABI,'getHand',[active],at),
    call(contracts.shuffle,shuffleABI,'recordOf',[active],at)
   ]);
   if(!g.initialized||g.tableId.toLowerCase()!==binding.tableId.toLowerCase()||
     d.tableId.toLowerCase()!==binding.tableId.toLowerCase()||
     d.configHash.toLowerCase()!==r.configHash.toLowerCase()||
     safe(d.epoch)!==safe(epoch)||safe(d.state)!==2||safe(s.stage)!==2||
     !hex(s.finalDeckRoot)||!hex(d.transcriptCommitment)||!hex(g.stateRoot))
     throw Error('unverified funded deal/hand');
   // Only on-chain proof-verifier accepted public openings are displayed.
   const count=Array.from({length:9},(_,i)=>(safe(g.seatsMask)>>i)&1).reduce((a,b)=>a+b,0);
   if(count<2||count>r.config.seats)throw Error('invalid verified participant mask');
   const start=2*count;
   const phase=NATIVE_PHASES[safe(g.phase)];
   if(!phase||phase==='NONE')throw Error('unsupported canonical phase');
   const positions=phase==='FLOP'||phase==='AWAIT_TURN'?[start+1,start+2,start+3]:
    phase==='TURN'||phase==='AWAIT_RIVER'?[start+1,start+2,start+3,start+5]:
    phase==='RIVER'||phase==='SHOWDOWN'?[start+1,start+2,start+3,start+5,start+7]:[];
   // UNCONTESTED does not imply that all streets were publicly revealed.
   // Waiting-for-reveal phases cannot leak hidden card slots.
   const community=[];
   for(const pos of positions){
    const slot=await call(contracts.reveals,revealABI,'slotOf',[active,pos],at);
    if(!slot.opened||!slot.shareA||!slot.shareB)throw Error('unverified public card reveal');
    community.push(cardAt(safe(slot.card)));
   }
   let contributed=0;
   for(let i=0;i<seats.length;i++){
    const p=await call(contracts.engine,engineABI,'playerOf',[active,i],at);
    if((safe(g.seatsMask)&(1<<i))!==0){
     seats[i].stack=safe(p.stack);seats[i].committed=safe(p.contributed);
     if(p.folded)seats[i].status='folded';else if(p.allIn)seats[i].status='all-in';
     contributed+=seats[i].committed;
    }
   }
   if(contributed!==safe(g.pot))throw Error('native pot mismatch');
   hand={nonce:safe(d.nonce),actionNonce:safe(g.nonce),pot:safe(g.pot),
     deadline:safe(g.deadline)*1000,turnSeat:safe(g.toAct),dealerSeat:safe(g.button),
     community,phase};
   stateHash=g.stateRoot;
   dealProofVerified=seatEpochVerified=revealsVerified=engineVerified=tableVersionVerified=true;
   deckRoot=s.finalDeckRoot;
  }
  return {verified:true,finalized:true,finalityBlock:safe(at),
   blockNumber:safe(at),sequence:safe(at),chainId,tableId:binding.tableId,
   tableVersion:binding.tableVersion??1,ledgerVersion:safe(epoch),stateHash,
   config:{hash:r.configHash,seatCount:safe(r.config.seats),
     smallBlind:safe(r.config.smallBlind),bigBlind:safe(r.config.bigBlind)},
   seats,hand,dealProofVerified,seatEpochVerified,revealsVerified,engineVerified,
   tableVersionVerified,deckRoot};
 }
 return Object.freeze({readTable});
}
