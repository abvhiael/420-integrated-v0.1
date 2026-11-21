import {Rpc} from './core/rpc.mjs';
import {rebuildProjection} from './core/indexer.mjs';
const {LAUNCHPAD_RPC_URL,LAUNCHPAD_CHAIN_ID,LAUNCHPAD_PROJECTION_FILE,LAUNCHPAD_INDEX_FROM_BLOCK}=process.env;
if(!LAUNCHPAD_RPC_URL||!LAUNCHPAD_CHAIN_ID||!LAUNCHPAD_PROJECTION_FILE||!LAUNCHPAD_INDEX_FROM_BLOCK)
  throw new Error('RPC_URL, CHAIN_ID, PROJECTION_FILE and INDEX_FROM_BLOCK are required for canonical reconstruction');
const result=await rebuildProjection(new Rpc(LAUNCHPAD_RPC_URL),{
  chainId:LAUNCHPAD_CHAIN_ID,file:LAUNCHPAD_PROJECTION_FILE,fromBlock:LAUNCHPAD_INDEX_FROM_BLOCK
});
console.log(JSON.stringify({schema:'420-launchpad-reconstruction-v1',...result}));
