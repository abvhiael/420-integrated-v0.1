import { readFileSync } from 'node:fs';
import type { ChainSource420, Hex, IndexerBlock, IndexerLog } from '../../src/chain-source.js';
import type { RetainedAbiArtifact420, StakeReleaseDescriptor420 } from '../../src/abi-manifest.js';
import { descriptorsFromStakeRelease420 } from '../../src/abi-manifest.js';
export const manifest = JSON.parse(readFileSync('descriptors/stake420-v3.json','utf8')) as StakeReleaseDescriptor420;
export const artifacts = new Map<string, RetainedAbiArtifact420>([
 ['ValidatorRegistry', 'ValidatorRegistry.govpre04.abi.json'],
 ['RewardController', 'RewardController.v3.abi.json']
].map(([name,filename]) => [name, JSON.parse(readFileSync(`../contracts/artifacts/${filename}`,'utf8'))]));
const descriptors = descriptorsFromStakeRelease420(manifest, artifacts);
export const h = (n: number): Hex => `0x${n.toString(16).padStart(64,'0')}`;
const data = (...n: number[]): Hex => `0x${n.map(v=>h(v).slice(2)).join('')}`;
export const validator = h(0xaa);
export class StakeSource420 implements ChainSource420 {
 sourceId='stake-recovery-canonical-fixture';
 head=3n; finalized=1n; fork=false; finalizedFork=false; mixed=false; failLogs=false;
 async chainId() {return 420n;}
 async blockNumber() {return this.head;}
 async finalizedBlockNumber() {return this.finalized;}
 async getBlockByNumber(n: bigint): Promise<IndexerBlock|null> {
   if(n<0n || n>this.head)return null;
   const id=(v:bigint)=>Number(v)+(this.finalizedFork && v>=1n?200:this.fork && v>=2n?100:0);
   return {number:n,hash:h(id(n)),parentHash:n===0n?h(0):h(id(n-1n)),timestamp:100n+n};
 }
 async getBlockByHash(hash: Hex) {for(let n=0n;n<=this.head;n++){const b=await this.getBlockByNumber(n);if(b?.hash===hash)return b;}return null;}
 async getTransactionByHash(){return null;}
 async getTransactionReceipt(){return null;}
 async getLogs(filter: {fromBlock:bigint;toBlock:bigint}): Promise<IndexerLog[]> {
   if(this.failLogs)throw new Error('interrupted RPC ingestion');
   const n=filter.fromBlock;if(n===0n)return [];
   const event=n===1n?'ValidatorRegistered':n===2n?'ConsensusStateApplied':this.fork?'ExitNoticeApplied':'SlashApplied';
   const d=descriptors.find(x=>x.eventName===event)!;
   const b=(await this.getBlockByNumber(n))!;
   const topics:Hex[]=[d.topic0,validator];
   if(n===1n)topics.push(h(1),h(2));
   const encoded=n===1n?data(21000,0):n===2n?data(3,4,100,1,4,0):this.fork?data(100,101):data(2,1,10,11,55,6);
   const log:IndexerLog={address:d.contractAddress,blockNumber:n,blockHash:this.mixed?h(999):b.hash,transactionHash:h(Number(n)+1000),transactionIndex:0,logIndex:0,topics,data:encoded};
   return [log,{...log}]; // Real decoder + duplicate normalization on every block.
 }
 async call():Promise<Hex>{return '0x';}
 async getCode():Promise<Hex>{return '0x';}
}
