// Run once from a trusted server/worker scheduler. No browser credentials or signing keys.
import {readFile} from 'node:fs/promises';
import {synchronizeIndexerEvents} from './indexer-event-reader.mjs';
const manifestPath=process.env.BET_INDEXER_EVENT_MANIFEST;
const checkpointPath=process.env.BET_INDEXER_EVENT_CHECKPOINT;
if(!manifestPath||!checkpointPath)throw Error('BET_INDEXER_EVENT_MANIFEST and BET_INDEXER_EVENT_CHECKPOINT are required');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const maxBlocks=Number(process.env.BET_INDEXER_EVENT_BATCH||64);
const result=await synchronizeIndexerEvents({manifest,checkpointPath,maxBlocks});
// No account or gameplay details printed: infrastructure-only operations.
console.log(JSON.stringify({kind:'bet-indexer-events-sync',...result}));
