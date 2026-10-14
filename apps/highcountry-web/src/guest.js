// Guest-only, local simulation. These records are never chain/service-authoritative.
export const SAVE_KEY='highcountry.guest.v1';
export const STAGES=['germination','seedling','vegetative','flowering','ready'];
export const DURATIONS=[86400000,172800000,604800000,604800000];
export const DEFAULT_ENV=Object.freeze({temperature:2500,humidity:5000,light:5000,water:5000,nutrients:5000,airflow:5000});
const BOUNDS={temperature:[1000,4000],humidity:[0,10000],light:[0,10000],water:[0,10000],nutrients:[0,10000],airflow:[0,10000]};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function validEnv(e){return plain(e)&&Object.keys(BOUNDS).every(k=>Number.isSafeInteger(e[k])&&e[k]>=BOUNDS[k][0]&&e[k]<=BOUNDS[k][1])&&Object.keys(e).length===6;}
function checkClock(now){if(!Number.isSafeInteger(now)||now<0)throw Error('invalid-clock');}
function uuid(){if(!globalThis.crypto?.randomUUID)throw Error('secure-random-unavailable');return globalThis.crypto.randomUUID();}
export function newGuest(now=Date.now()){checkClock(now);return {schema:1,revision:0,createdAt:now,lastSeen:now,plant:null,harvests:[],completed:0};}
export function validateSave(s){if(!plain(s)||s.schema!==1||!Number.isSafeInteger(s.revision)||s.revision<0||!Number.isSafeInteger(s.createdAt)||s.createdAt<0||!Number.isSafeInteger(s.lastSeen)||s.lastSeen<s.createdAt||!Array.isArray(s.harvests)||!Number.isSafeInteger(s.completed)||s.completed!==s.harvests.length)throw Error('guest-save-invalid');
 if(s.harvests.length>1000||s.harvests.some(h=>!plain(h)||typeof h.id!=='string'||typeof h.plantId!=='string'||!Number.isSafeInteger(h.massMg)||h.massMg<0||h.massMg>100000||!Number.isSafeInteger(h.qualityBps)||h.qualityBps<0||h.qualityBps>10000||!['D','C','B','A','S'].includes(h.grade)||!Number.isSafeInteger(h.at)))throw Error('guest-harvest-invalid');
 if(s.plant!==null){const p=s.plant;if(!plain(p)||typeof p.id!=='string'||!Number.isSafeInteger(p.plantedAt)||p.plantedAt<s.createdAt||p.plantedAt>s.lastSeen||!validEnv(p.env)||typeof p.genome!=='string'||p.genome!=='founding-local-preview'||!Number.isSafeInteger(p.environmentUpdatedAt)||p.environmentUpdatedAt<p.plantedAt||p.environmentUpdatedAt>s.lastSeen)throw Error('guest-plant-invalid');}
 return s;}
export function loadGuest(storage){let raw;try{raw=storage.getItem(SAVE_KEY);}catch{throw Error('guest-storage-unavailable');}if(raw===null)return null;try{return validateSave(JSON.parse(raw));}catch{throw Error('guest-save-corrupt');}}
export function saveGuest(storage,s){validateSave(s);try{storage.setItem(SAVE_KEY,JSON.stringify(s));}catch{throw Error('guest-storage-write-failed');}return s;}
function touch(s,now){validateSave(s);checkClock(now);if(now<s.lastSeen)throw Error('clock-rollback');return {...s,lastSeen:now,revision:s.revision+1};}
export function plant(s,now=Date.now()){const n=touch(s,now);if(n.plant)throw Error('plot-occupied');return {...n,plant:{id:uuid(),genome:'founding-local-preview',plantedAt:now,environmentUpdatedAt:now,env:{...DEFAULT_ENV}}};}
export function setEnvironment(s,changes,now=Date.now()){const n=touch(s,now);if(!n.plant)throw Error('plant-required');if(stage(n.plant,now)==='ready')throw Error('environment-sealed');if(!plain(changes)||!Object.keys(changes).length||Object.keys(changes).some(k=>!(k in BOUNDS)))throw Error('environment-change-invalid');const env={...n.plant.env,...changes};if(!validEnv(env))throw Error('environment-out-of-range');return {...n,plant:{...n.plant,env,environmentUpdatedAt:now}};}
export function stage(p,now){checkClock(now);if(!p||now<p.plantedAt)throw Error('invalid-stage-time');let d=now-p.plantedAt;for(let i=0;i<DURATIONS.length;i++){if(d<DURATIONS[i])return STAGES[i];d-=DURATIONS[i];}return 'ready';}
export function advance(s,now=Date.now()){return touch(s,now);} // Elapsed time is derived; no mutable tick counters or skipped transitions.
export function grade(q){if(!Number.isSafeInteger(q)||q<0||q>10000)throw Error('quality-out-of-range');return q>=9000?'S':q>=7500?'A':q>=5000?'B':q>=2500?'C':'D';}
export function harvest(s,now=Date.now()){const n=touch(s,now);if(!n.plant||stage(n.plant,now)!=='ready')throw Error('plant-not-ready');if(n.harvests.length>=1000)throw Error('guest-harvest-limit');
 // The canonical checkpoint quality needs authoritative expression, so guest previews
 // use explicitly labeled neutral local quality, never invent a genome decoder.
 const qualityBps=10000;
 const receipt={id:uuid(),plantId:n.plant.id,at:now,qualityBps,grade:grade(qualityBps),massMg:Math.floor(100000*qualityBps/10000),localOnly:true};
 return {...n,plant:null,harvests:[...n.harvests,receipt],completed:n.completed+1};}
