// HC-ECON-01: pure, authoritative-data taxonomy and bounded modifier policy.
// Classification, proof verification, issuance, currency, and placement authorization
// are deliberately NOT performed here. HC-ECON-02/03 own those trust boundaries.
import {createHash} from 'node:crypto';
import {SURFACES,LAYERS} from './placement-contract.js';
export const TAXONOMY_VERSION='HC.ECON.TAXONOMY.V1';
export const POLICY_VERSION='HC.ECON.MODIFIERS.V2';
export const ORDINARY_MAX_BPS=500;
export const ORDINARY_TARGET_AVERAGE_BPS=250;
export const ORIGINS=Object.freeze(['creator','developer','quest']);
const fail=(code)=>{throw new TypeError('hc-econ-01:'+code);};
const id=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{1,63}$/.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const unique=a=>Array.isArray(a)&&a.length===new Set(a).size;
const integer=x=>Number.isSafeInteger(x);
const clone=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
// Semantic families, not creator-editable effect-to-object mappings.
export const FUNCTIONAL_ROLES=freeze(['comfort','hospitality','storage','crafting','preservation','cultivation','environment','display','heritage']);
export const EFFECT_ROLES=freeze({
 comfort:['comfort'],hospitality:['hospitality'],storage_capacity:['storage'],
 crafting_efficiency:['crafting'],material_conservation:['crafting'],
 preservation:['preservation'],cultivation_efficiency:['cultivation'],
 climate_stability:['environment'],visitor_appeal:['display','hospitality'],
 heritage_preservation:['heritage','preservation']
});
export const ROLE_STACK_CAP_BPS=freeze({
 comfort:500,hospitality:500,storage:500,crafting:500,
 preservation:500,cultivation:500,environment:500,display:500,heritage:500
});
const LAYER_SURFACE=freeze({
 furniture:['floor'],cultivation:['floor','outdoor_ground'],outdoor_structure:['outdoor_ground'],
 outdoor_feature:['outdoor_ground'],outdoor_decor:['outdoor_ground'],outdoor_path:['outdoor_ground'],
 outdoor_recreation:['outdoor_ground'],wall_decor:['wall_slot'],tabletop_decor:['tabletop_slot'],
 shelf_decor:['shelf_slot']
});
export function defineObjectType(value){
 if(!exact(value,['schemaVersion','typeId','family','roles','surfaces','layers','decorative','qualified','qualificationRef']))fail('type-shape');
 if(value.schemaVersion!==TAXONOMY_VERSION||!id(value.typeId)||!id(value.family)||
 typeof value.decorative!=='boolean'||typeof value.qualified!=='boolean')fail('type-identity');
 if(value.qualified?!id(value.qualificationRef):value.qualificationRef!==null)fail('type-qualification');
 if(!unique(value.roles)||value.roles.length===0||!value.roles.every(r=>FUNCTIONAL_ROLES.includes(r)))fail('roles');
 if(!unique(value.surfaces)||value.surfaces.length===0||!value.surfaces.every(s=>SURFACES.includes(s)))fail('surfaces');
 if(!unique(value.layers)||value.layers.length===0||!value.layers.every(l=>LAYERS.includes(l)))fail('layers');
 if(!value.layers.every(l=>value.surfaces.some(s=>LAYER_SURFACE[l]?.includes(s))))fail('layer-surface');
 // The union must not silently permit nonsensical combinations.
 if(!value.surfaces.every(s=>value.layers.some(l=>LAYER_SURFACE[l]?.includes(s))))fail('unmatched-surface');
 if(value.decorative===false&&value.roles.every(r=>r==='display'))fail('nondecorative-display-only');
 return freeze(clone(value));
}
export function eligibleEffects(type){
 const t=defineObjectType(type);
 if(!t.qualified)fail('type-unqualified');
 return freeze(Object.keys(EFFECT_ROLES).filter(k=>EFFECT_ROLES[k].some(role=>t.roles.includes(role))));
}
export function defineModifierPolicy(value,type){
 const t=defineObjectType(type);
 if(!t.qualified)fail('type-unqualified');
 if(!exact(value,['schemaVersion','policyId','typeId','revision','origin','maxModifiers','perItemCapBps','effects','qualified','qualificationRef']))fail('policy-shape');
 if(value.schemaVersion!==POLICY_VERSION||!id(value.policyId)||value.typeId!==t.typeId||
 !integer(value.revision)||value.revision<1||!ORIGINS.includes(value.origin)||typeof value.qualified!=='boolean')fail('policy-identity');
 if(value.qualified?!id(value.qualificationRef):value.qualificationRef!==null)fail('policy-qualification');
 if(!integer(value.maxModifiers)||value.maxModifiers<0||value.maxModifiers>3||
 !integer(value.perItemCapBps)||value.perItemCapBps<0||value.perItemCapBps>(value.origin==='quest'?10000:ORDINARY_MAX_BPS))fail('power-budget');
 if(!Array.isArray(value.effects)||value.effects.length>20||
 (value.effects.length===0)!==(value.maxModifiers===0))fail('pool-size');
 const permitted=new Set(eligibleEffects(t));
 const keys=new Set();
 let totalWeight=0;
 for(const effect of value.effects){
   if(!exact(effect,['effectId','minBps','maxBps','weight'])||
      !permitted.has(effect.effectId)||keys.has(effect.effectId))fail('effect-ineligible');
   keys.add(effect.effectId);
   if(!integer(effect.minBps)||!integer(effect.maxBps)||effect.minBps<1||
      effect.maxBps<effect.minBps||effect.maxBps>(value.origin==='quest'?10000:ORDINARY_MAX_BPS)||
      !integer(effect.weight)||effect.weight<1||effect.weight>10000)fail('effect-bounds');
   totalWeight+=effect.weight;
 }
 if(totalWeight>100000)fail('weight-overflow');
 if(value.maxModifiers>value.effects.length)fail('insufficient-effects');
 const worst=value.effects.map(e=>e.maxBps).sort((a,b)=>b-a).slice(0,value.maxModifiers).reduce((a,b)=>a+b,0);
 if(worst>value.perItemCapBps)fail('item-budget-exceeded');
 if(value.origin==='developer'&&(value.effects.some(e=>e.minBps!==e.maxBps)||value.maxModifiers!==value.effects.length))fail('developer-locked-modifier');
 // Ordinary creator pools have a 2–3% expected aggregate target (2.5% default).
 // This rejects distorted creator-defined ranges at catalogue registration.
 if(value.origin==='creator'&&value.maxModifiers>0){
   const minimum=value.effects.map(e=>e.minBps).sort((a,b)=>a-b).slice(0,value.maxModifiers).reduce((a,b)=>a+b,0);
   const midpoint=Math.round((minimum+worst)/2);
   if(midpoint<200||midpoint>300)fail('ordinary-average-band');
 }
 return freeze(clone(value));
}
export function defineTaxonomyCatalog({types,policies}={}){
 if(!Array.isArray(types)||!Array.isArray(policies)||types.length>1000||policies.length>1000)fail('catalog-shape');
 const byType=new Map();
 for(const raw of types){const t=defineObjectType(raw);if(byType.has(t.typeId))fail('duplicate-type');byType.set(t.typeId,t);}
 const seen=new Set(),validated=[];
 for(const raw of policies){const t=byType.get(raw?.typeId);if(!t)fail('unknown-type');const p=defineModifierPolicy(raw,t);
 const key=p.policyId+':'+p.revision;if(seen.has(key))fail('duplicate-policy');seen.add(key);validated.push(p);}
 const result={schemaVersion:TAXONOMY_VERSION,types:[...byType.values()].sort((a,b)=>a.typeId.localeCompare(b.typeId)),
 policies:validated.sort((a,b)=>a.policyId.localeCompare(b.policyId)||a.revision-b.revision)};
 return freeze({...result,sha256:sha(result)});
}
export function resolveCertifiedPolicy(catalog,{typeId,policyId,revision}={}){
 if(!catalog||catalog.schemaVersion!==TAXONOMY_VERSION||!id(typeId)||!id(policyId)||!integer(revision))fail('lookup');
 const t=catalog.types?.find(x=>x.typeId===typeId),p=catalog.policies?.find(x=>x.typeId===typeId&&x.policyId===policyId&&x.revision===revision);
 if(!t||!p||!t.qualified||!p.qualified)fail('unavailable-policy');
 // Revalidate: never trust mutable or forged caller-side catalogue data.
 const validated=defineTaxonomyCatalog({types:catalog.types,policies:catalog.policies});
 if(validated.sha256!==catalog.sha256)fail('catalog-integrity');
 return freeze({type:t,policy:p,catalogSha256:catalog.sha256});
}
export function validateModifierOutcome(certified,outcome){
 if(!certified||!exact(outcome,['effects'])||!Array.isArray(outcome.effects))fail('outcome-shape');
 const {type,policy}=certified;defineModifierPolicy(policy,type);
 if(outcome.effects.length!==policy.maxModifiers)fail('outcome-count');
 const seen=new Set(),pool=new Map(policy.effects.map(e=>[e.effectId,e]));let sum=0;
 for(const effect of outcome.effects){
   if(!exact(effect,['effectId','bps'])||seen.has(effect.effectId)||!pool.has(effect.effectId))fail('outcome-effect');
   seen.add(effect.effectId);
   const range=pool.get(effect.effectId);
   if(!integer(effect.bps)||effect.bps<range.minBps||effect.bps>range.maxBps)fail('outcome-bounds');
   sum+=effect.bps;
 }
 if(sum>policy.perItemCapBps|| (policy.origin!=='quest'&&sum>ORDINARY_MAX_BPS))fail('outcome-budget');
 // This checks bounds only: HC-ECON-02 must verify entropy and the draw.
 return freeze({valid:true,totalBps:sum});
}
export function checkStacking(type,items){
 const t=defineObjectType(type);
 if(!t.qualified||!Array.isArray(items)||items.length>1000)fail('stack-shape');
 const totals=Object.fromEntries(t.roles.map(role=>[role,0]));
 const developerSeen=new Set();
 for(const item of items){
   if(!plain(item)||!Array.isArray(item.effects)||!ORIGINS.includes(item.origin))fail('stack-item');
   if(item.origin==='developer'){
     for(const e of item.effects){if(developerSeen.has(e.effectId))fail('developer-nonstackable');developerSeen.add(e.effectId);}
   }
   for(const e of item.effects){
     if(!exact(e,['effectId','bps'])||!integer(e.bps)||e.bps<0||
       !Object.hasOwn(EFFECT_ROLES,e.effectId)||!EFFECT_ROLES[e.effectId].some(r=>t.roles.includes(r)))fail('stack-effect');
     for(const role of EFFECT_ROLES[e.effectId]){
       if(Object.hasOwn(totals,role))totals[role]+=e.bps;
     }
   }
 }
 return freeze({totals,applied:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,Math.min(v,ROLE_STACK_CAP_BPS[k])]))});
}

// Entitlement verification and weighted entropy remain with HC-ECON-02. This
// boundary explicitly prohibits a caller from requesting an ordinary reveal
// before a canonical, finalized purchase acceptance has been supplied.
export function assertRevealEligible({origin,purchaseFinalized,issuerAuthorized}={}){
 if(!ORIGINS.includes(origin)||issuerAuthorized!==true)fail('reveal-authority');
 if(origin==='creator'&&purchaseFinalized!==true)fail('purchase-not-finalized');
 return true;
}
