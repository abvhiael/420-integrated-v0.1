// R05.6 exact Solidity event decoding. Reject foreign topics, data lengths and forged ABI padding.
// High-risk authorization NEVER derives from this nonfinalized projection.
import {keccak256} from '../../highcountry-economy/src/keccak.js';
const fail=x=>{throw Object.assign(new Error(x),{code:x});};
const hex=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x);
const address=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/.test(x);
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<2n**64n;
const defs=Object.freeze({
 MigrationClaimIssued:{signature:'MigrationClaimIssued(bytes32,bytes32,address,bytes32,bytes32,uint64)',
  indexed:['claimId','gameId','targetAccount'],body:['guestStateCommitment','migrationPayloadHash','validUntil']},
 MigrationClaimConsumed:{signature:'MigrationClaimConsumed(bytes32,bytes32)',indexed:['claimId','profileId'],body:[]},
 MigrationClaimCancelled:{signature:'MigrationClaimCancelled(bytes32)',indexed:['claimId'],body:[]},
 GrowerGamingProfileBound:{signature:'GrowerGamingProfileBound(uint64,bytes32,address)',
  indexed:['growerId','profileId','account'],body:[]},
 MigrationClaimBound:{signature:'MigrationClaimBound(bytes32,uint64,bytes32)',
  indexed:['claimId','growerId','profileId'],body:[]},
 MigrationApplied:{signature:'MigrationApplied(bytes32,uint64,bytes32,bytes32)',
  indexed:['claimId','growerId'],body:['guestStateCommitment','migrationPayloadHash']}
});
const signatures=Object.freeze(Object.fromEntries(Object.entries(defs).map(([name,spec])=>
 [keccak256(Buffer.from(spec.signature)),{name,...spec}])));
const addrWord=x=>'0x'+x.slice(-40);
function decodeWord(word,field){
 if(field==='targetAccount'||field==='account'){
  if(word.slice(2,26)!=='0'.repeat(24))fail('event-invalid-address-padding');
  const v=addrWord(word);if(!address(v)||v==='0x'+'0'.repeat(40))fail('event-zero-account');
  return v;
 }
 if(field==='growerId'||field==='validUntil'){
  const n=BigInt(word);
  if(n>2n**64n-1n||(field==='growerId'&&n===0n))fail('event-invalid-uint64');
  return String(n);
 }
 if(!hex(word)||word==='0x'+'0'.repeat(64))fail('event-invalid-hash');
 return word;
}
export function decodeGamingEvent420({topics,data}={}){
 if(!Array.isArray(topics)||!hex(topics[0])||typeof data!=='string')fail('event-invalid-log');
 const spec=signatures[topics[0]];
 if(!spec)fail('event-topic-unknown');
 if(topics.length!==spec.indexed.length+1||
  !new RegExp('^0x[0-9a-f]{'+spec.body.length*64+'}$').test(data))fail('event-abi-shape');
 const result={};
 spec.indexed.forEach((field,i)=>{if(!hex(topics[i+1]))fail('event-invalid-topic');result[field]=decodeWord(topics[i+1],field);});
 spec.body.forEach((field,i)=>result[field]=decodeWord('0x'+data.slice(2+i*64,2+(i+1)*64),field));
 return Object.freeze({kind:spec.name,payload:Object.freeze(result),topic0:topics[0]});
}
export const GAMING_EVENT_TOPICS420=Object.freeze(Object.fromEntries(Object.entries(defs).map(([name,v])=>
 [name,keccak256(Buffer.from(v.signature))])));
export const gamingEventContract420=kind=>kind.startsWith('MigrationClaim')&&kind!=='MigrationClaimBound'?'claims':
 kind==='MigrationApplied'?'migration':'bridge';
