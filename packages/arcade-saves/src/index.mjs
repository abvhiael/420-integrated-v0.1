// ARC-1.8 local guest progress: per-game/version namespace, checksum, snapshots and pure migrations.
// The storage boundary is untrusted. No wallet, cloud sync or competitive verification.
const PREFIX='420arcade:guest:v1:';
export class SaveError extends Error {constructor(message){super(message);this.name='SaveError';}}
const fail=msg=>{throw new SaveError(msg)};
const clone=x=>structuredClone(x);
function canonical(value){if(value===undefined)fail('Unsupported save value');if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype){const keys=Object.keys(value).sort();return '{'+keys.map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';}return fail('Unsupported save value');}
async function digest(value,crypto){const bytes=new TextEncoder().encode(canonical(value));const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');}
function validProgress(progress){const json=canonical(progress);if(typeof json!=='string')fail('Unsupported save value');if(json.length>262144)fail('Progress exceeds byte budget');return clone(JSON.parse(json));}
function validId(id){if(typeof id!=='string'||!/^420\/GAMING\/GAME\/ARCADE_[A-Z0-9_]+\/V1$/.test(id))fail('Invalid game ID');return id;}
function validEnvelope(save,expected,now){
 if(!save||typeof save!=='object'||Array.isArray(save)||save.gameId!==expected.gameId||save.playerMode!=='guest'||save.playerRef!==null||!Number.isSafeInteger(save.schemaVersion)||save.schemaVersion<1||save.schemaVersion>expected.saveSchemaVersion||save.contentVersion!==expected.contentVersion||!Number.isSafeInteger(save.revision)||save.revision<1||!Number.isSafeInteger(save.updatedAt)||save.updatedAt<0||save.updatedAt>now+60000)fail('Invalid or foreign save envelope');
 validProgress(save.progress);
}
export class ArcadeProgressStore{
 #storage;#crypto;#clock;#games;#migrations;#busy=new Set();
 constructor({storage,crypto,now=()=>Date.now(),games,migrations={}}){
  if(!storage||!['getItem','setItem','removeItem'].every(k=>typeof storage[k]==='function')||typeof crypto?.subtle?.digest!=='function'||typeof now!=='function'||!Array.isArray(games)||games.length!==11)throw new TypeError('Invalid local save dependencies');
  const entries=new Map();
  for(const g of games){validId(g.gameId);if(entries.has(g.gameId)||!Number.isSafeInteger(g.saveSchemaVersion)||g.saveSchemaVersion<1||!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(g.contentVersion)||g.registration!=='UNREGISTERED'||g.walletRequiredForCore!==false)fail('Invalid canonical roster');entries.set(g.gameId,Object.freeze({...g}));}
  this.#storage=storage;this.#crypto=crypto;this.#clock=now;this.#games=entries;this.#migrations=migrations;
 }
 #expected(id){validId(id);const g=this.#games.get(id);if(!g)fail('Unknown game');return g;}
 #key(id){return PREFIX+encodeURIComponent(id);}
 async #decode(raw,g){let data;try{data=JSON.parse(raw);}catch{fail('Corrupt JSON');}
  if(!data||typeof data!=='object'||!data.save||typeof data.checksum!=='string'||!/^[a-f0-9]{64}$/.test(data.checksum))fail('Malformed record');
  if(await digest(data.save,this.#crypto)!==data.checksum)fail('Checksum mismatch');
  validEnvelope(data.save,g,this.#clock());return clone(data.save);
 }
 async #encode(save){return JSON.stringify({save,checksum:await digest(save,this.#crypto)});}
 async read(gameId,playerRef=null){const g=this.#expected(gameId);if(playerRef!==null)fail('Guest-only local store');const raw=this.#storage.getItem(this.#key(gameId));return raw===null?null:this.#decode(raw,g);}
 async writeIfRevision(gameId,expectedRevision,progress,{playerRef=null}={}){
  const g=this.#expected(gameId);if(playerRef!==null)fail('Guest-only local store');
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision===Number.MAX_SAFE_INTEGER)fail('Bad expected revision');
  if(this.#busy.has(gameId))fail('Concurrent local write');
  this.#busy.add(gameId);
  try{
   const existing=await this.read(gameId);if((existing?.revision??0)!==expectedRevision)fail('Stale revision');
   const timestamp=this.#clock();if(!Number.isSafeInteger(timestamp)||timestamp<0)fail('Invalid clock');
   const save={gameId,schemaVersion:g.saveSchemaVersion,contentVersion:g.contentVersion,revision:expectedRevision+1,updatedAt:timestamp,playerMode:'guest',playerRef:null,progress:validProgress(progress)};
   const record=await this.#encode(save);this.#storage.setItem(this.#key(gameId),record);
   return clone(save);
  }finally{this.#busy.delete(gameId);}
 }
 async migrate(gameId,fromVersion,toVersion){
  const g=this.#expected(gameId);if(!Number.isSafeInteger(fromVersion)||!Number.isSafeInteger(toVersion)||fromVersion<1||toVersion>g.saveSchemaVersion||toVersion<=fromVersion)fail('Invalid migration version');
  if(this.#busy.has(gameId))fail('Concurrent migration');this.#busy.add(gameId);
  try{
   const current=await this.read(gameId);if(!current||current.schemaVersion!==fromVersion)fail('Migration source mismatch');
   let next=validProgress(current.progress);
   for(let i=fromVersion;i<toVersion;i++){const fn=this.#migrations[gameId]?.[i];if(typeof fn!=='function')fail('Unapproved migration');next=validProgress(fn(clone(next)));}
   // Preserve old record before any promotion. Fail closed on backup write/storage errors.
   const key=this.#key(gameId), old=this.#storage.getItem(key);
   const backup=key+':backup:'+current.revision+':'+fromVersion;
   if(this.#storage.getItem(backup)!==null)fail('Backup collision');
   this.#storage.setItem(backup,old);
   const upgraded={...current,schemaVersion:toVersion,revision:current.revision+1,updatedAt:this.#clock(),progress:next};
   validEnvelope(upgraded,g,this.#clock());
   this.#storage.setItem(key,await this.#encode(upgraded));
   return clone(upgraded);
  }finally{this.#busy.delete(gameId);}
 }
 async restoreBackup(gameId,revision,version){
  this.#expected(gameId);
  if(!Number.isSafeInteger(revision)||revision<1||!Number.isSafeInteger(version)||version<1)fail('Invalid backup identifier');
  const key=this.#key(gameId),raw=this.#storage.getItem(key+':backup:'+revision+':'+version);if(raw===null)fail('Missing backup');
  const save=await this.#decode(raw,this.#expected(gameId));
  if(save.revision!==revision||save.schemaVersion!==version)fail('Backup mismatch');
  // Do not downgrade or overwrite any current progress automatically.
  return clone(save);
 }
}
export {PREFIX as LOCAL_SAVE_PREFIX};
