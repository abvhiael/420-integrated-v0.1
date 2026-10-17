// Phase 3.20: presentation-only state projection for Tier 2 progression and optional Tier 3 polish.
export function projectSceneVisuals(state,polish=false){
 const products=Object.values(state?.store?.products??{});
 const sum=products.reduce((n,p)=>n+(Number.isFinite(p?.stock)?Math.max(0,p.stock):0),0);
 const capacity=products.reduce((n,p)=>n+(Number.isFinite(p?.capacity)?Math.max(0,p.capacity):0),0);
 const stock=sum===0?"empty":capacity>0&&sum/capacity>=0.65?"full":"partial";
 const upgrades=state?.progression?.upgrades??{};
 const expansions=state?.progression?.unlockedExpansions??[];
 const premium=Object.values(upgrades).some(v=>typeof v==="number"?v>0:typeof v==="object"&&v!==null&&Number(v.level)>0);
 const expanded=Array.isArray(expansions)&&expansions.some(name=>typeof name==="string"&&name!=="tinyShop");
 return {stock,upgrade:premium?"premium":"base",expansion:expanded?"expanded":"starter",polish:polish?"on":"off"};
}
export function applySceneVisuals(stage,projection){
 if(!stage||!projection)throw Error("missing scene projection");
 const nodes=[...stage.querySelectorAll("[data-variant-kind]")];
 for(const node of nodes){const kind=node.getAttribute("data-variant-kind");const value=node.getAttribute("data-variant-value");if(!["stock","upgrade","expansion","polish"].includes(kind)||!["empty","full","premium","expanded","on"].includes(value))throw Error("invalid scene variant");}
 for(const node of nodes)node.hidden=projection[node.getAttribute("data-variant-kind")]!==node.getAttribute("data-variant-value");
 return projection;
}
