import {createServer} from 'node:http';
import {createPokerProjection,createPokerProjectionHandler} from './service.mjs';
import {createCanonicalPokerReader} from './chain-reader.mjs';
import {createPokerWalletAuth} from './auth.mjs';
// Fails closed unless an externally qualified, pinned runtime manifest and a
// distinct authenticated session issuer are configured.
if(process.env.POKER_ENABLE_API!=='true')throw Error('Poker API disabled: activation gate not approved');
const chainId=Number(process.env.POKER_CHAIN_ID);
const secretHex=process.env.POKER_SESSION_HMAC_KEY||'';
if(!/^[a-fA-F0-9]{64,}$/.test(secretHex)||secretHex.length%2!==0)
 throw Error('Poker session secret must be at least 32 random bytes (hex)');
const secret=Buffer.from(secretHex,'hex');
let manifest,contracts;
try{
 manifest=JSON.parse(process.env.POKER_TABLES_JSON||'null');
 contracts=JSON.parse(process.env.POKER_CONTRACTS_JSON||'null');
}catch{throw Error('Invalid pinned Poker deployment manifest');}
if(manifest?.chainId!==chainId||!Number.isSafeInteger(chainId)||chainId<1)
 throw Error('Invalid poker network binding');
const reader=createCanonicalPokerReader({rpcUrl:process.env.POKER_RPC_URL,chainId,contracts});
const service=createPokerProjection({manifest,reader,secret});
const port=Number(process.env.PORT||process.env.POKER_PORT||8789);
if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('Invalid poker port');
const expectedOrigin=process.env.POKER_ALLOWED_ORIGIN;
if(typeof expectedOrigin!=='string'||!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(expectedOrigin))
 throw Error('Missing approved HTTPS poker origin');
const handler=createPokerProjectionHandler(service,{origin:expectedOrigin});
const auth=createPokerWalletAuth({origin:expectedOrigin,chainId,secret});
const httpHandler=(req,res)=>{
 if(req.url==='/api/420bet/poker/v1/auth/challenge'||
    req.url==='/api/420bet/poker/v1/auth/verify')
  return auth.handle(req,res);
 return handler(req,res);
};
createServer(httpHandler).listen(port,process.env.POKER_HOST||'127.0.0.1',
 ()=>console.log('420Bet read-only, authenticated poker projection listening on port '+port));
