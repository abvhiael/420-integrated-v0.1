import fs from 'node:fs';import assert from 'node:assert/strict';
export function verify(m,system,{ready=false}={}){
assert.equal(m.schema,'hc-r07-1-v1');assert.equal(m.genesisScopeDomain,'HC.GENESIS.ADMIN.V1');
assert.deepEqual(m.productionRoutineSelectors,[]);assert.equal(m.grantPolicy.wildcardsForbidden,true);assert.equal(m.grantPolicy.zeroScopeForbidden,true);
assert.equal(m.grantPolicy.periodLimit,0);assert.equal(m.grantPolicy.periodSeconds,0);
assert.equal(m.grantPolicy.temporaryGrantRevocationRequired,true);assert.equal(m.grantPolicy.enginePrincipalSeparateFromUser,true);
const names=new Set(),addresses=new Set(),address=/^0x[0-9a-fA-F]{40}$/,hash=/^0x[0-9a-fA-F]{64}$/;
const start=BigInt(system.reserved_range.start),end=BigInt(system.reserved_range.end);
function checkAddress(s,local=false){if(s===null){assert.ok(!ready,'missing address');return;}
assert.match(s,address);assert.notEqual(BigInt(s),0n,'zero address');
if(local)assert.ok(BigInt(s)<start||BigInt(s)>end,'reserved address');}
assert.ok(m.components.length>=20);
m.components.forEach((c,i)=>{assert.equal(c.order,i+1);assert.ok(!names.has(c.name),'duplicate component');
for(const dep of c.dependsOn)assert.ok(names.has(dep),'unsorted dependency');names.add(c.name);checkAddress(c.address,true);
if(c.address){assert.ok(!addresses.has(c.address.toLowerCase()),'duplicate address');addresses.add(c.address.toLowerCase());}
if(c.codeHash!==null)assert.match(c.codeHash,hash);
if(ready){assert.match(c.codeHash,hash);assert.ok(Array.isArray(c.constructorArgs),'constructor args');assert.ok(c.abiVersion&&c.deploymentReceipt,'missing deployment evidence');}
});
for(const c of m.externalContracts){checkAddress(c.address);if(ready)assert.match(c.codeHash,hash);}
const roles=new Set();
for(const r of m.authorities){assert.ok(!roles.has(r.role),'duplicate role');roles.add(r.role);checkAddress(r.principal);if(ready)assert.ok(r.custodian&&r.recoveryOwner&&r.independentReviewer,'unreviewed role');}
const grants=new Set();
for(const g of m.exactGrants){
assert.ok(g.principal&&g.component&&g.action&&g.scope);assert.ok(![g.principal,g.component,g.action,g.scope].includes('*'),'wildcard');
assert.match(g.scope,hash);assert.notEqual(BigInt(g.scope),0n,'zero scope');assert.equal(g.periodLimit,0);assert.equal(g.periodSeconds,0);
const key=[g.principal,g.component,g.action,g.scope].join(':');assert.ok(!grants.has(key),'duplicate grant');grants.add(key);
if(ready)assert.ok(g.approvalReceipt&&g.revocationPlan,'unreviewed grant');
}
if(m.chainId!==null)assert.ok(Number.isSafeInteger(m.chainId)&&m.chainId>0,'invalid chain ID');
if(ready){assert.ok(Number.isSafeInteger(m.chainId)&&m.chainId>0,'chain ID missing');assert.equal(m.state,'AUTHORIZED_DEPLOYMENT');assert.equal(m.releaseAuthority,'INDEPENDENTLY_APPROVED');assert.ok(m.exactGrants.length,'grants absent');}
return {templateValid:true,ready};
}
if(process.argv[1]?.endsWith('verify-r07-1.mjs')){
const m=JSON.parse(fs.readFileSync('deployments/highcountry/r07-1.testnet.json'));
const system=JSON.parse(fs.readFileSync('contracts/config/system-addresses.json'));
verify(m,system,{ready:process.argv.includes('--require-ready')});
console.log('R07.1 template valid; live approval not inferred');
}
