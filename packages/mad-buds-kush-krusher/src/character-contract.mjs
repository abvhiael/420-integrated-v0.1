// MB-3.1 portability contract only. Canonical Unity gameplay authority remains in abvhiael/420-integrated/mad-buds.
export const KUSH_KRUSHER_ID = 'kush-krusher';
export const KUSH_KRUSHER = deepFreeze({
 id:KUSH_KRUSHER_ID,
 name:'Kush Krusher',
 tagline:'Heavy hitter. Zero patience.',
 role:'demolition',
 physicsIntent:{mass:4,speed:2,bounce:1,penetration:3,structuralForce:4,controlDifficulty:2},
 ability:{id:'wrecking-ball',activationMode:'airborne-tap',singleUsePerLaunch:true,
  affectedTargets:['structures','breakables'],tags:['HeavyImpact','StructuralCollapse']},
 profiles:{physics:'kush-krusher-heavy',collision:'kush-krusher-demolition',
  animation:'kush-krusher',audio:'kush-krusher',vfx:'kush-krusher',camera:'kush-krusher'},
 materialAffinity:{strong:['wood','drywall','shelving','unstable-metal-frame','weakened-brick','wet-structure'],
  average:['brick','reinforced-panel'],weak:['armored-obstacle']},
 lifecycle:['Queued','Loaded','Aiming','Launched','Airborne','AbilityActive','Impacted','Settling','Resolved','Removed']
});
function deepFreeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value)}return value}
const REQUIRED = ['id','name','tagline','role','physicsIntent','ability','profiles','materialAffinity','lifecycle'];
export function validateKushKrusherDefinition(definition){
 if(!definition||typeof definition!=='object'||Array.isArray(definition))throw new TypeError('character definition must be object');
 for(const key of REQUIRED)if(!Object.hasOwn(definition,key))throw new Error('missing character field: '+key);
 if(definition.id!==KUSH_KRUSHER_ID||definition.name!=='Kush Krusher'||definition.ability?.id!=='wrecking-ball')throw new Error('canonical identity mismatch');
 if(definition.ability.activationMode!=='airborne-tap'||definition.ability.singleUsePerLaunch!==true)throw new Error('invalid ability activation contract');
 for(const [key,value] of Object.entries(KUSH_KRUSHER.physicsIntent)){
  if(definition.physicsIntent?.[key]!==value)throw new Error('physics intent mismatch: '+key);
 }
 for(const [key,value] of Object.entries(KUSH_KRUSHER.profiles))if(definition.profiles?.[key]!==value)throw new Error('profile mismatch: '+key);
 if(JSON.stringify(definition.lifecycle)!==JSON.stringify(KUSH_KRUSHER.lifecycle))throw new Error('lifecycle mismatch');
 return true;
}
export class KushKrusherRuntimeContract{
 #state='Queued'; #launchCount=0; #abilityUsed=false;
 constructor(definition=KUSH_KRUSHER){validateKushKrusherDefinition(definition);this.definition=definition}
 get characterId(){return KUSH_KRUSHER_ID}
 get state(){return this.#state}
 get abilityUsed(){return this.#abilityUsed}
 get launchCount(){return this.#launchCount}
 load(){this.#require('Queued');this.#state='Loaded'}
 aim(){this.#require('Loaded');this.#state='Aiming'}
 launch(){this.#require('Aiming');this.#state='Launched';this.#launchCount++;this.#abilityUsed=false}
 airborne(){if(!['Launched','Impacted'].includes(this.#state))throw new Error('invalid airborne transition');this.#state='Airborne'}
 activate(){this.#require('Airborne');if(this.#abilityUsed)throw new Error('ability already used');this.#abilityUsed=true;this.#state='AbilityActive'}
 impact(){if(!['Launched','Airborne','AbilityActive'].includes(this.#state))throw new Error('invalid impact transition');this.#state='Impacted'}
 settle(){this.#require('Impacted');this.#state='Settling'}
 resolve(){this.#require('Settling');this.#state='Resolved'}
 remove(){this.#require('Resolved');this.#state='Removed'}
 reset(){if(!['Removed','Resolved'].includes(this.#state))throw new Error('cannot reset unresolved bud');this.#state='Queued';this.#abilityUsed=false}
 #require(expected){if(this.#state!==expected)throw new Error('invalid lifecycle transition: '+this.#state+' -> '+expected)}
}
