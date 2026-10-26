import {keccak256} from './keccak.js';
import {word} from './finalized-rpc.js';
import {SEED_PACK_POLICY,SEED_REGIONS} from './seed-packs.js';
export const seedHash=value=>keccak256(Buffer.from(value));
export const OPENING_DOMAIN=seedHash('HC.RANDOM.SEED_PACK.V1');
export const OPENING_POLICY_HASH=seedHash(JSON.stringify(SEED_PACK_POLICY));
export const OPENING_TIERS=Object.freeze(['common','rare','exclusive']);
export const OPENING_POOLS=Object.freeze([...SEED_REGIONS,'World']);
export const abiHash=(...values)=>keccak256(Buffer.from(values.map(word).join(''),'hex'));
export const openingKey=(game,packId)=>abiHash(game,seedHash(packId));
export function poolDefinition(catalogue,region){
 const index=OPENING_POOLS.indexOf(region);if(index<0)throw Error('invalid opening pool');
 const tiers=OPENING_TIERS.map(t=>[...catalogue.rows.values()].filter(c=>c.tier===t&&(region==='World'||c.region===region)).map(c=>c.id).sort());
 if(tiers.some(a=>!a.length))throw Error('empty opening tier');
 return {index,region,tiers,hash:abiHash(OPENING_POLICY_HASH,index,...tiers.flatMap(ids=>[ids.length,...ids.map(seedHash)]))};
}
export const eligibleGenomeCommitment=eligible=>seedHash(JSON.stringify(eligible.map(g=>[g.cultivarId,g.genomeId,g.breedingEventId??'0'])));
export const openingCommitment=i=>{const p=i.sourcePack;return seedHash(JSON.stringify(['HC.SEED.OPENING.V1',i.gameId,[i.deployment.chainId,i.deployment.contract,i.deployment.contractCodeHash,i.deployment.router,i.deployment.routerCodeHash,i.deployment.emergency,i.deployment.emergencyCodeHash,i.deployment.profileId,i.deployment.timeoutSeconds],[p.id,p.owner,p.region,p.policyVersion,p.seeds,p.source.kind,p.source.receiptId,p.source.issuer,p.createdAt],i.owner,i.wallet,i.ownerProfile,i.poolHash,eligibleGenomeCommitment(i.eligible)]));};
export const openingPurpose=i=>abiHash(OPENING_DOMAIN,i.gameId,OPENING_POLICY_HASH,i.openingKey,i.wallet,i.pool,i.poolHash,i.commitment);
export function reduceSeedWord(value,bound){
 if(typeof value!=='bigint'||value<0n||value>=2n**256n||!Number.isSafeInteger(bound)||bound<1||bound>65)throw Error('invalid reduction');
 const b=BigInt(bound);return {accepted:value>=(2n**256n)%b,ticket:Number(value%b)};
}
export function uniformSeedDraw(entropy,requestId,domain,bound){
 if(!/^0x[0-9a-f]{64}$/i.test(entropy)||!/^0x[0-9a-f]{64}$/i.test(requestId)||BigInt(requestId)===0n||!Number.isSafeInteger(bound)||bound<1||bound>65)throw Error('invalid seed draw');
 for(let counter=0;counter<256;counter++){const value=BigInt(abiHash(entropy,requestId,seedHash(domain),counter)),r=reduceSeedWord(value,bound);if(r.accepted)return r.ticket;}
 throw Error('seed draw expansion exhausted');
}
export function seedTier(ticket){if(!Number.isSafeInteger(ticket)||ticket<0||ticket>=10)throw Error('invalid tier ticket');return ticket<6?0:ticket<9?1:2;}
export function selectSeedOutcome(pool,entropy,requestId){
 const tier=seedTier(uniformSeedDraw(entropy,requestId,'HC.SEED.TIER.V1',10));
 const index=uniformSeedDraw(entropy,requestId,'HC.SEED.CULTIVAR.V1',pool.tiers[tier].length);
 return {tier:OPENING_TIERS[tier],tierIndex:tier,index,cultivarId:pool.tiers[tier][index]};
}
