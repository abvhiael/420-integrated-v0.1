// R06.3 explicitly LOCAL-ONLY identity issuer for integration qualification.
// No production sign-up permission or production credential authority is implied.
import {createHmac,randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const name=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{2,63}$/.test(x);
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
export function createLocalHighCountryIssuer420({gameId,provisionAccount,now=()=>Date.now(),secret=randomBytes(32),ttlMs=900000}={}){
 if(!/^0x[0-9a-f]{64}$/.test(gameId||'')||typeof provisionAccount!=='function'||!(secret instanceof Uint8Array)||secret.length<32||
 !Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>3600000)fail('local-issuer-invalid');
 const users=new Map(),sessions=new Map();
 function signature(v){return createHmac('sha256',secret).update(v).digest('base64url');}
 async function register({username,password}){
  if(!name(username)||typeof password!=='string'||password.length<12||password.length>256)fail('identity-invalid-input');
  if(users.has(username))fail('identity-already-exists');
  const salt=randomBytes(16),key=scryptSync(password,salt,32);
  const accountId='local_'+randomUUID(),issuerRef='highcountry-local-test';
  const commitment='0x'+createHash('sha256').update(key).digest('hex');
  await provisionAccount({accountId,issuerRef,credentialCommitment:commitment});
  users.set(username,{accountId,issuerRef,salt,key,epoch:0,disabled:false});
  return {accountId};
 }
 function login({username,password}){
  const user=users.get(username);
  const salt=user?.salt||randomBytes(16);
  const attempted=scryptSync(typeof password==='string'?password:'',salt,32);
  if(!user||user.disabled||!timingSafeEqual(attempted,user.key))fail('authentication-denied');
  const claims={sub:user.accountId,iss:user.issuerRef,game:gameId,epoch:user.epoch,exp:now()+ttlMs,jti:randomUUID()};
  const raw=b64(claims),token=raw+'.'+signature(raw);
  sessions.set(claims.jti,true);
  return {token,expiresAt:claims.exp};
 }
 function verifyToken(token){
  if(typeof token!=='string'||token.length>4096)fail('authentication-denied');
  const chunks=token.split('.');if(chunks.length!==2)fail('authentication-denied');
  const expected=Buffer.from(signature(chunks[0]));const actual=Buffer.from(chunks[1]);
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual))fail('authentication-denied');
  let claims;try{claims=JSON.parse(Buffer.from(chunks[0],'base64url').toString('utf8'));}catch{fail('authentication-denied');}
  const user=[...users.values()].find(u=>u.accountId===claims.sub);
  if(!user||user.disabled||!sessions.has(claims.jti)||claims.epoch!==user.epoch||
    claims.iss!==user.issuerRef||claims.game!==gameId||!Number.isSafeInteger(claims.exp)||claims.exp<=now())fail('authentication-denied');
  return claims;
 }
 async function registeredPrincipal(token){return verifyToken(token).sub;}
 function logout(token){const c=verifyToken(token);sessions.delete(c.jti);}
 function revokeAccount(username){const u=users.get(username);if(!u)fail('identity-not-found');u.epoch++;u.disabled=true;}
 return Object.freeze({gameId,register,login,logout,revokeAccount,verifyToken,registeredPrincipal});
}
