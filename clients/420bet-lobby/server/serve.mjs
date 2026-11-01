import {createServer} from 'node:http';
import {createGameHistoryLookup,createGameHistoryHandler} from './history.mjs';
const chainId=Number(process.env.BET_HISTORY_CHAIN_ID);
let bindings;
try{bindings=JSON.parse(process.env.BET_HISTORY_GAME_CONTRACTS||'null');}catch{throw Error('invalid game contract binding JSON');}
const lookup=createGameHistoryLookup({indexerUrl:process.env.BET_HISTORY_INDEXER_URL,chainId,gameContracts:bindings});
const port=Number(process.env.BET_HISTORY_PORT||8787);
if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('invalid history port');
const server=createServer(createGameHistoryHandler(lookup));
server.listen(port,process.env.BET_HISTORY_HOST||'127.0.0.1',()=>console.log('420Bet scoped history service listening on '+port));
