import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file = new URL("../../docs/migration/MIG-0.1-ownership-inventory.json",import.meta.url);
const data = JSON.parse(readFileSync(file,"utf8"));
assert.equal(data.schema,"420-migration-ownership-inventory-v1");
assert.equal(data.step,"MIG-0.1");
assert.equal(data.qualification.passed,false,"Do not assert qualification PASS without exact-SHA CI evidence");
const allowed=new Set(["genesis",...data.destinations]);
const dispositions=new Set(["move","retain","split","review"]);
const seen=new Set(),ids=new Set(),destinations=new Set();
for(const e of data.entries){
 assert.match(e.id,/^MIG01-\d{3}$/);
 assert(!ids.has(e.id),"Duplicate entry id: "+e.id);ids.add(e.id);
 assert(e.source&&e.sourceRepository&&e.destination&&e.disposition,"Missing ownership fields");
 assert(allowed.has(e.destination),"Unknown destination "+e.destination);
 assert(dispositions.has(e.disposition),"Unknown disposition "+e.disposition);
 const key=e.sourceRepository+":"+e.source;assert(!seen.has(key),"Duplicate ownership: "+key);seen.add(key);
 if(e.destination!=="genesis")destinations.add(e.destination);
 if(e.disposition==="retain")assert.equal(e.destination,"genesis");
}
assert.deepEqual([...destinations].sort(),[...data.destinations].sort(),"Missing destination coverage");
for(const p of ["packages/420-gaming-sdk/","contracts/src/gaming/","config/genesis-applications.json","clients/highcountry-access-v1/"]){
 assert(data.entries.some(e=>e.source===p && e.destination==="genesis" && e.disposition==="retain"),"Canonical core not retained: "+p);
}
assert(data.unresolved.length>=5,"Do not claim exhaustive inventory before the tree and asset audit");
console.log("MIG-0.1 inventory schema/ownership checks PASS ("+data.entries.length+" classified source families).");
