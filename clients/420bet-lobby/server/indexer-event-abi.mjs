// Actual Solidity topic0 computation (Ethereum Keccak-256, NOT NIST SHA3-256).
// The signatures below are transcribed from contracts/src/bet and bound by role.
const MASK=(1n<<64n)-1n;
const RC=['0000000000000001','0000000000008082','800000000000808a','8000000080008000',
'000000000000808b','0000000080000001','8000000080008081','8000000000008009',
'000000000000008a','0000000000000088','0000000080008009','000000008000000a',
'000000008000808b','800000000000008b','8000000000008089','8000000000008003',
'8000000000008002','8000000000000080','000000000000800a','800000008000000a',
'8000000080008081','8000000000008080','0000000080000001','8000000080008008'].map(x=>BigInt('0x'+x));
const ROT=[0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
const rotate=(v,n)=>n===0?v:((v<<BigInt(n))|(v>>BigInt(64-n)))&MASK;
function permute(a){
 for(const rc of RC){
  const c=Array.from({length:5},(_,x)=>a[x]^a[x+5]^a[x+10]^a[x+15]^a[x+20]);
  for(let x=0;x<5;x++)for(let y=0;y<5;y++)a[x+5*y]^=c[(x+4)%5]^rotate(c[(x+1)%5],1);
  const b=new Array(25).fill(0n);
  for(let x=0;x<5;x++)for(let y=0;y<5;y++)b[y+5*((2*x+3*y)%5)]=rotate(a[x+5*y],ROT[x+5*y]);
  for(let x=0;x<5;x++)for(let y=0;y<5;y++)a[x+5*y]=b[x+5*y]^((~b[(x+1)%5+5*y])&b[(x+2)%5+5*y]);
  a[0]^=rc;
 }
}
export function eventTopic(signature){
 if(typeof signature!=='string'||!signature||!/^[A-Za-z][A-Za-z0-9]*(\([a-zA-Z0-9,\[\]]*\))$/.test(signature))throw Error('invalid Solidity event signature');
 const input=Buffer.from(signature,'ascii'),a=new Array(25).fill(0n);
 const bytes=[...input,1];while(bytes.length%136!==135)bytes.push(0);bytes.push(128);
 for(let offset=0;offset<bytes.length;offset+=136){
  for(let i=0;i<136;i++)a[Math.floor(i/8)]^=BigInt(bytes[offset+i])<<BigInt((i%8)*8);
  permute(a);
 }
 const result=Buffer.alloc(32);
 for(let i=0;i<32;i++)result[i]=Number((a[Math.floor(i/8)]>>BigInt(8*(i%8)))&255n);
 return '0x'+result.toString('hex');
}
const specs={
 'casino-router':[
  ['WAGER_ACCEPTED','WagerAcceptanceCompleted(bytes32,address,bytes32,bytes32,uint256,uint256,uint256,uint256)',5,3,1,2],
 ],
 'casino-settlement':[
  ['WAGER_SETTLED','SettlementCompleted(bytes32,uint8,uint256,uint256)',3,1,1,null],
  ['WAGER_VOIDED','ExpiredWagerVoided(bytes32,address)',0,2,1,null],
 ],
 'poker-ledger':[
  ['POKER_HAND_SETTLED','HandSettled(bytes32,bytes32,uint256,uint256)',2,2,1,null],
  ['POKER_HAND_CANCELLED','HandCancelled(bytes32,bytes32)',0,2,1,null],
 ],
 'poker-canonical':[
  ['POKER_CANONICAL_SETTLED','CanonicalHandSettled(bytes32,bytes32,bytes32,uint256)',2,2,1,null],
 ],
 'fantasy-contest':[
  ['FANTASY_ENTRY_ACCEPTED','EntryAccepted(bytes32,uint64,bytes32,uint64,bytes32,bytes)',4,3,1,null],
  ['FANTASY_POOL_SETTLED','PoolSettled(bytes32,bytes32,uint256,uint256)',3,1,1,null],
  ['FANTASY_POOL_CANCELLED','PoolCanceled(bytes32,bytes32)',1,1,1,null],
 ],
 'sports-tickets':[
  ['SPORTS_TICKET_FUNDED','TicketFunded(bytes32,bytes32,address,bytes32,uint256,uint256)',3,3,1,3],
  ['SPORTS_TICKET_SETTLED','TicketSettlementRecorded(bytes32,bytes32,uint8,uint256,bytes32,address)',3,3,1,null],
  ['SPORTS_TICKET_FINALIZED','TicketFinalized(bytes32,uint8,uint256)',2,1,1,null],
 ],
};
export const EVENT_SPECS=Object.freeze(Object.fromEntries(Object.entries(specs).map(([role,rows])=>[
 role,Object.freeze(rows.map(([type,signature,words,indexed,idIndex,accountIndex])=>Object.freeze({
 type,signature,topic0:eventTopic(signature),words,indexed,idIndex,accountIndex
 })))
])));
const HEX=/^0x(?:[0-9a-fA-F]{2})*$/;
const WORD=/^0x[0-9a-fA-F]{64}$/;
export function decodeKnownEvent(role,log){
 const spec=EVENT_SPECS[role]?.find(s=>s.topic0===log.topics?.[0]?.toLowerCase());
 if(!spec)return null;
 if(!Array.isArray(log.topics)||log.topics.length!==spec.indexed+1||log.topics.some(t=>!WORD.test(t)))throw Error('invalid event topics');
 if(typeof log.data!=='string'||!HEX.test(log.data)||((log.data.length-2)%64)!==0||((log.data.length-2)/64)<spec.words)throw Error('invalid ABI event data');
 if(spec.type!=='FANTASY_ENTRY_ACCEPTED'&&((log.data.length-2)/64)!==spec.words)throw Error('noncanonical ABI event length');
 // Dynamic fantasy envelope is not decoded or emitted. ABI length and pointer must be valid.
 if(spec.type==='FANTASY_ENTRY_ACCEPTED'){
  const pointer=BigInt('0x'+log.data.slice(2+64*2,2+64*3));
  const len=BigInt('0x'+log.data.slice(2+64*3,2+64*4));
  if(pointer!==96n||len>4096n||BigInt((log.data.length-2)/2)!==128n+((len+31n)/32n)*32n)throw Error('invalid dynamic event envelope');
 }
 const word=log.topics[spec.idIndex].toLowerCase();
 const account=spec.accountIndex?('0x'+log.topics[spec.accountIndex].slice(-40).toLowerCase()):null;
 if(account&&log.topics[spec.accountIndex].slice(2,26)!=='0'.repeat(24))throw Error('invalid indexed address');
 return {type:spec.type,objectId:word,account,topic0:spec.topic0,
   gameVersionId:role==='casino-router'?log.topics[3].toLowerCase():null};
}
