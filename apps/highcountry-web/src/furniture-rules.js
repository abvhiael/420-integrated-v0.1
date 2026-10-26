// HC-ART-02 design-rules v1. Preview-only, deterministic, non-authoritative.
// Never credits BUDS, issues furniture, transfers ownership or modifies canonical cultivation state.
export const FURNITURE_RULES_VERSION='hc-art-02/v1';
export const CONDITION_STATES=Object.freeze(['secondhand','used','good','restored','heirloom']);
export const CONDITION_THRESHOLDS=Object.freeze({secondhand:0,used:35,good:70,restored:90});
export const COMFORT_CAPS=Object.freeze({comfort:20,morale:12,workspace:15,value:30});
export const ARRANGEMENTS=Object.freeze({
 'break-corner':Object.freeze({requires:Object.freeze(['seating','table']),bonus:Object.freeze({comfort:2,morale:1,workspace:1,value:1})}),
 'grower-lounge':Object.freeze({requires:Object.freeze(['seating','table','lighting','rug']),bonus:Object.freeze({comfort:4,morale:3,workspace:2,value:3})}),
 'botanical-sanctuary':Object.freeze({requires:Object.freeze(['greenhouse-seating','table','lighting']),environment:'greenhouse',bonus:Object.freeze({comfort:4,morale:2,workspace:2,value:3})}),
 'patio-retreat':Object.freeze({requires:Object.freeze(['outdoor-seating','table','shade']),environment:'outdoor',bonus:Object.freeze({comfort:3,morale:3,workspace:1,value:3})}),
 'heritage-lounge':Object.freeze({requires:Object.freeze(['seating','table','heritage-display']),bonus:Object.freeze({comfort:2,morale:2,workspace:3,value:5})}),
 'restored-collection':Object.freeze({requires:Object.freeze(['restored-furniture','heritage-display']),bonus:Object.freeze({comfort:2,morale:2,workspace:2,value:5})})
});
const finiteNonnegative=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
export function furnitureCondition({wear,restored=false,heirloom=false}){
 if(!Number.isSafeInteger(wear)||wear<0||wear>100)throw Error('invalid-furniture-wear');
 if(typeof restored!=='boolean'||typeof heirloom!=='boolean')throw Error('invalid-furniture-condition');
 if(heirloom)return 'heirloom'; // Provenance must be authorized by trusted service.
 if(restored&&wear<=10)return 'restored';
 return wear>=65?'secondhand':wear>=30?'used':'good';
}
export function evaluateWorkspace({environment,items=[]}){
 if(!['indoor','greenhouse','outdoor'].includes(environment)||!Array.isArray(items)||items.length>256)throw Error('invalid-workspace');
 const active=items.filter(item=>{
  if(!item||typeof item!=='object'||typeof item.tag!=='string'||!Array.isArray(item.tags))throw Error('invalid-workspace-item');
  if(!Number.isSafeInteger(item.comfort)||item.comfort<0||item.comfort>10)throw Error('invalid-workspace-item');
  return item.placed===true&&item.reserved!==true&&item.damaged!==true;
 });
 const tags=new Set(active.flatMap(i=>i.tags));
 const unique=new Set(),total={comfort:0,morale:0,workspace:0,value:0};
 for(const item of active){if(unique.has(item.tag))continue;unique.add(item.tag);total.comfort+=item.comfort;}
 const earned=[];
 for(const [id,rule] of Object.entries(ARRANGEMENTS)){
  if((!rule.environment||rule.environment===environment)&&rule.requires.every(t=>tags.has(t))){
   earned.push(id);for(const k of Object.keys(total))total[k]+=rule.bonus[k];
  }
 }
 return Object.freeze({arrangements:Object.freeze(earned),modifiers:Object.freeze(Object.fromEntries(Object.entries(total).map(([key,value])=>[key,Math.min(value,COMFORT_CAPS[key])])) )});
}
// Read-only eligibility. The existing server must verify ownership, reserve an item,
// suspend its active bonuses, settle BUDS and transfer unique instance exactly once.
export function furnitureResaleEligibility(item){
 if(!item||typeof item!=='object'||typeof item.instanceId!=='string'||!item.instanceId||typeof item.ownerId!=='string'||!item.ownerId)throw Error('invalid-furniture-instance');
 const reason=item.listed||item.reserved?'already-reserved':item.bound?'non-transferable':item.placed?'unplace-before-listing':null;
 return Object.freeze({eligible:reason===null,reason,instanceId:item.instanceId,requiresServerSettlement:true});
}
