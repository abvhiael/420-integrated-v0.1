import {selector,bytes32Word,addressWord} from './abi.js';
const ZERO='0x'+'0'.repeat(64);
function words(hex){if(typeof hex!=='string'||!/^0x[0-9a-fA-F]*$/.test(hex)||(hex.length-2)%64)throw Error('invalid eth_call result');const h=hex.slice(2);const out=[];for(let i=0;i<h.length;i+=64)out.push(h.slice(i,i+64));return out;}
function uint(w){return Number(BigInt('0x'+w));}
function address(w){return '0x'+w.slice(24).toLowerCase();}
async function call(ethereum,to,data){if(!ethereum?.request)throw Error('EIP-1193 wallet unavailable');const result=await ethereum.request({method:'eth_call',params:[{to,data},'latest']});return words(result);}
export async function readCommunity(ethereum,to,communityId){const w=await call(ethereum,to,selector('community(bytes32)')+bytes32Word(communityId));if(w.length<8)throw Error('short community result');return {exists:uint(w[0])===1,owner:address(w[1]),metadataHash:'0x'+w[2],treasuryAuthorityId:'0x'+w[3],treasury:address(w[4]),createdAt:uint(w[5]),updatedAt:uint(w[6]),treasuryRevision:uint(w[7])};}
export async function readMembership(ethereum,to,communityId,member){const w=await call(ethereum,to,selector('membership(bytes32,address)')+bytes32Word(communityId)+addressWord(member));if(w.length<3)throw Error('short membership result');return {state:uint(w[0]),joinedAt:uint(w[1]),updatedAt:uint(w[2])};}
export async function readSubscription(ethereum,to,communityId,subscriber){const w=await call(ethereum,to,selector('subscription(bytes32,address)')+bytes32Word(communityId)+addressWord(subscriber));if(w.length<6)throw Error('short subscription result');return {state:uint(w[0]),planId:'0x'+w[1],startedAt:uint(w[2]),expiresAt:uint(w[3]),updatedAt:uint(w[4]),revision:uint(w[5])};}
export async function readEntitlement(ethereum,to,communityId,beneficiary,typeId){const w=await call(ethereum,to,selector('entitlement(bytes32,address,bytes32)')+bytes32Word(communityId)+addressWord(beneficiary)+bytes32Word(typeId));if(w.length<5)throw Error('short entitlement result');return {state:uint(w[0]),grantedAt:uint(w[1]),expiresAt:uint(w[2]),updatedAt:uint(w[3]),revision:uint(w[4])};}
export const membershipLabel=s=>['NONE','ACTIVE','LEFT','REMOVED'][Number(s)]??'UNKNOWN';
export const subscriptionLabel=s=>['NONE','ACTIVE','CANCELLED','EXPIRED'][Number(s)]??'UNKNOWN';
export const entitlementLabel=s=>['NONE','ACTIVE','REVOKED','EXPIRED'][Number(s)]??'UNKNOWN';
export const ZERO_BYTES32=ZERO;
