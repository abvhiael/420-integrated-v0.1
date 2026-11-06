// Canonical poker projection service. It cannot sign, settle, start hands or
// reveal other players' cards. No configured contract reads => no verified data.
import {createHmac,timingSafeEqual,createHash} from 'node:crypto';
const HASH=/^0x[0-9a-f]{64}$/i,ADDR=/^0x[0-9a-f]{40}$/i;
const ID=/^0x[0-9a-f]{64}$/i;
const allowedPhases=new Set(['TABLE_OPEN','SEATED','HAND_COMMITTED','PREFLOP','FLOP','TURN','RIVER','SHOWDOWN','SETTLED','ABORTED','REFUNDED','DISPUTED']);
const safeInt=(v,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const fail=(message)=>{throw Error(message)};
const bytes=(s)=>Buffer.from(s,'base64url');
const sha=(value)=>'0x'+createHash('sha256').update(value).digest('hex');
export function parseCookie(header,name='__Host-poker_session'){
 const matches=String(header||'').split(';').map(x=>x.trim());
 const found=matches.find(x=>x.startsWith(name+'='));
 return found?found.slice(name.length+1):null;
}
export function verifyPokerSession(token,secret,{chainId,now=Date.now()}={}){
 if(!Buffer.isBuffer(secret)||secret.length<32)fail('invalid server signing key');
 if(typeof token!=='string'||token.length>4096||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(token))fail('no valid session cookie');
 const [data,signature]=token.split('.');
 const expected=createHmac('sha256',secret).update(data).digest();
 const received=bytes(signature);
 if(received.length!==expected.length||!timingSafeEqual(received,expected))fail('invalid session signature');
 const claims=JSON.parse(bytes(data).toString('utf8'));
 if(!claims||claims.iss!=='420bet-poker-auth-v1'||claims.scope!=='poker:read'||
    !ADDR.test(claims.subject)||!safeInt(claims.chainId)||claims.chainId!==chainId||
    typeof claims.viewerId!=='string'||!/^[-_a-zA-Z0-9]{1,80}$/.test(claims.viewerId)||
    !safeInt(claims.expiresAt)||claims.expiresAt<=now||claims.expiresAt>now+3600000||
    !safeInt(claims.issuedAt)||claims.issuedAt>now+30000||now-claims.issuedAt>3600000)
    fail('expired or unauthorized poker session');
 return Object.freeze({viewerId:claims.viewerId,subject:claims.subject.toLowerCase(),chainId,expiresAt:claims.expiresAt});
}
const isCard=c=>c&&typeof c==='object'&&['2','3','4','5','6','7','8','9','10','J','Q','K','A'].includes(String(c.rank))&&['♠','♥','♦','♣'].includes(c.suit);
function checkedRoot(v){if(typeof v!=='string'||!HASH.test(v)||/^0x0{64}$/i.test(v))fail('invalid source commitment');return v.toLowerCase();}
function text(v,max){if(typeof v!=='string'||!v.length||v.length>max)fail('invalid display string');return v;}
function int(v){if(!safeInt(v))fail('unsafe numeric chain result');return v;}
const ph=(value)=>{if(!allowedPhases.has(value))fail('invalid canonical phase');return value;};
export function projectCanonicalTable(raw,session,manifest,now=Date.now()){
 if(!raw||raw.verified!==true||raw.chainId!==manifest.chainId||
    raw.tableId!==manifest.tableId||!int(raw.blockNumber)||
    raw.blockNumber<1||!int(raw.sequence)||!int(raw.tableVersion)||
    raw.tableVersion<1||!int(raw.ledgerVersion)||
    !raw.finalized||raw.finalityBlock<raw.blockNumber)
    fail('unverified canonical chain state');
 const hash=checkedRoot(raw.stateHash);
 const config=raw.config;
 if(!config||config.hash?.toLowerCase()!==manifest.configHash.toLowerCase()||
    !safeInt(config.seatCount,9)||config.seatCount<2||
    !safeInt(config.smallBlind)||!safeInt(config.bigBlind)||config.bigBlind<config.smallBlind)
    fail('table config mismatched canonical registry');
 if(!Array.isArray(raw.seats)||raw.seats.length!==config.seatCount)fail('invalid ledger seats');
 const seats=raw.seats.map((s,i)=>{
  if(!s||s.index!==i||!safeInt(s.stack)||!safeInt(s.committed)||typeof s.status!=='string')fail('invalid seat ledger');
  if(!['empty','active','folded','sitting-out','all-in','disconnected'].includes(s.status))fail('invalid seat status');
  const owner=s.owner===null?null:String(s.owner).toLowerCase();
  if(s.status==='empty'?owner!==null:!ADDR.test(owner))fail('invalid seat owner');
  return {index:i,status:s.status,playerId:owner===session.subject?session.viewerId:owner,
   displayName:owner===session.subject?'YOU':owner?'PLAYER '+(i+1):'EMPTY',
   stack:s.stack,committed:s.committed};
 });
 const viewerSeat=seats.findIndex(s=>s.playerId===session.viewerId);
 const viewer=viewerSeat>=0?viewerSeat+1:0;
 const hand=raw.hand;
 if(!hand||!safeInt(hand.nonce)||!safeInt(hand.actionNonce)||!safeInt(hand.pot)||
  !safeInt(hand.deadline)||!safeInt(hand.turnSeat,config.seatCount-1)||
  !safeInt(hand.dealerSeat,config.seatCount-1)||!Array.isArray(hand.community)||
  hand.community.length>5||!hand.community.every(isCard)||!ph(hand.phase))
  fail('invalid canonical hand state');
 if(hand.nonce>0){
  // Proofs must be verified against the committed hand and revealed slots.
  if(raw.dealProofVerified!==true||raw.seatEpochVerified!==true||raw.revealsVerified!==true||
     raw.engineVerified!==true||raw.tableVersionVerified!==true||
     checkedRoot(raw.deckRoot)!==checkedRoot(manifest.deckRoot??raw.deckRoot))
    fail('confidential deal / hand proof not verified');
 }
 const caps={PREFLOP:0,FLOP:3,TURN:4,RIVER:5,SHOWDOWN:5};
 if(caps[hand.phase]!==undefined&&hand.community.length>caps[hand.phase])fail('premature board');
 const values=hand.community.map(c=>String(c.rank)+c.suit);
 if(new Set(values).size!==values.length)fail('duplicate revealed cards');
 // Private-card release needs BOTH matching recipient proof and session owner.
 // A public deal commitment is not equivalent to a private-card proof.
 let hole=[];
 if(raw.privateCards!==undefined){
  if(viewer===0||raw.privateDeliveryVerified!==true||
    raw.privateRecipient?.toLowerCase()!==session.subject||
    raw.privateHandNonce!==hand.nonce||!Array.isArray(raw.privateCards)||
    raw.privateCards.length!==2||!raw.privateCards.every(isCard))
     fail('unauthorized private-card delivery');
  hole=raw.privateCards.map(c=>({rank:String(c.rank),suit:c.suit}));
  if(new Set([...values,...hole.map(c=>c.rank+c.suit)]).size!==values.length+2)
   fail('duplicate private/public card');
 }
 const table={id:raw.tableId,tableVersion:raw.tableVersion,seatCount:config.seatCount,
  dealerSeat:hand.dealerSeat,phase:hand.phase,handNonce:hand.nonce,
  actionNonce:hand.actionNonce,ledgerVersion:raw.ledgerVersion,pot:hand.pot,
  deadline:hand.deadline,turnSeat:hand.turnSeat,
  community:hand.community.map(c=>({rank:String(c.rank),suit:c.suit})),
  seats,viewer:{seatPlusOne:viewer,holeCards:hole}};
 return {source:'canonical-poker-projection-v1',authority:'verified',
  viewerId:session.viewerId,chainId:session.chainId,stateHash:hash,
  blockNumber:raw.blockNumber,sequence:raw.sequence,observedAt:now,table};
}
export function createPokerProjection({manifest,reader,secret,clock=()=>Date.now()}={}){
 if(!manifest||!safeInt(manifest.chainId)||!Array.isArray(manifest.tables)||
    !manifest.tables.length||manifest.tables.length>100||!reader||
    !Buffer.isBuffer(secret)||secret.length<32)fail('incomplete production poker bindings');
 const byId=new Map();
 for(const m of manifest.tables){
  if(!m||!ID.test(m.tableId)||!HASH.test(m.configHash)||
     typeof m.name!=='string'||m.name.length>64||byId.has(m.tableId))fail('invalid table manifest');
  byId.set(m.tableId,m);
 }
 async function sessionFrom(req){
  const token=parseCookie(req.headers?.cookie);
  return verifyPokerSession(token,secret,{chainId:manifest.chainId,now:clock()});
 }
 async function snapshot(id,session){
  const binding=byId.get(id);if(!binding)fail('table not registered');
  const raw=await reader.readTable(binding,{chainId:manifest.chainId,subject:session.subject});
  return projectCanonicalTable(raw,session,{...binding,chainId:manifest.chainId},clock());
 }
 async function tables(session){
  // Discovery comes from independent registry/ledger state, never hardcoded sample seats.
  const entries=await Promise.all([...byId.values()].map(m=>snapshot(m.tableId,session)));
  const canonical=entries.map(({table:t})=>({id:t.id,name:byId.get(t.id).name,
    seatCount:t.seatCount,occupied:t.seats.filter(x=>x.status!=='empty').length,
    smallBlind:int(byId.get(t.id).smallBlind),bigBlind:int(byId.get(t.id).bigBlind),
    phase:t.phase,tableVersion:t.tableVersion}));
  const heads=entries.map(e=>e.blockNumber),hashes=entries.map(e=>e.stateHash);
  // To prevent mixed-finality table discovery, all reads must share a finalized block.
  if(new Set(heads).size!==1)fail('inconsistent finalized snapshot block');
  return {source:'canonical-poker-projection-v1',authority:'verified',
    viewerId:session.viewerId,chainId:session.chainId,
    blockNumber:heads[0],sequence:Math.max(...entries.map(e=>e.sequence)),
    stateHash:sha(hashes.join('|')),observedAt:clock(),tables:canonical};
 }
 return {sessionFrom,snapshot,tables};
}
export function createPokerProjectionHandler(projection,{origin=null}={}){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private',
  'Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'none'"};
 return async(req,res)=>{
  const send=(code,payload)=>{res.writeHead(code,headers);res.end(JSON.stringify(payload));};
  if(req.method!=='GET')return send(405,{error:'read only'});
  if(origin&&req.headers?.origin&&req.headers.origin!==origin)return send(403,{error:'cross-origin denied'});
  let url;try{url=new URL(req.url,'https://poker.invalid');}catch{return send(400,{error:'invalid request'});}
  if(url.search||url.hash)return send(400,{error:'unexpected query'});
  const base='/api/420bet/poker/v1';
  if(![base+'/session',base+'/tables'].includes(url.pathname)&&
    !/^\/api\/420bet\/poker\/v1\/tables\/0x[a-fA-F0-9]{64}\/snapshot$/.test(url.pathname))
   return send(404,{error:'unknown route'});
  let session;try{session=await projection.sessionFrom(req);}catch{return send(401,{error:'authentication required'});}
  try{
   if(url.pathname===base+'/session')return send(200,{authenticated:true,scope:'poker:read',
     viewerId:session.viewerId,subject:session.subject,chainId:session.chainId,expiresAt:session.expiresAt});
   if(url.pathname===base+'/tables')return send(200,await projection.tables(session));
   const id=url.pathname.split('/')[6]; // base /api/420bet/poker/v1/tables/{id}/snapshot
   return send(200,await projection.snapshot(id,session));
  }catch{return send(503,{error:'verified poker state unavailable'});}
 };
}
