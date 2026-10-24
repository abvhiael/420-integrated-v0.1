// R05.8 minimal generated-compatible ABI bindings. Selectors derived from exact
// canonical Solidity signatures; the provider never accepts arbitrary method strings.
import {keccak256} from './keccak.js';
import {GamingTransportError420} from './transports.js';
const fail=x=>{throw new GamingTransportError420(x)};
const signatures=Object.freeze({
 games:Object.freeze({isActive:'isActive(bytes32)'}),
 identity:Object.freeze({profileIdOf:'profileIdOf(bytes32,address)'}),
 entitlements:Object.freeze({entitlement:'entitlement(bytes32)',isActive:'isActive(bytes32)'}),
 crossGame:Object.freeze({attestation:'attestation(bytes32)',isActive:'isActive(bytes32)'}),
 claims:Object.freeze({claim:'claim(bytes32)'}),
 bridge:Object.freeze({growerProfileIdOfMigrationClaim:'growerProfileIdOfMigrationClaim(bytes32)'}),
 migration:Object.freeze({appliedMigration:'appliedMigration(bytes32)'})
});
const types=s=>s.slice(s.indexOf('(')+1,s.lastIndexOf(')')).split(',').filter(Boolean);
const encode=(type,value)=>{
 if(type==='address'&&typeof value==='string'&&/^0x[0-9a-f]{40}$/.test(value))
   return value.slice(2).padStart(64,'0');
 if(type==='bytes32'&&typeof value==='string'&&/^0x[0-9a-f]{64}$/.test(value))
   return value.slice(2);
 if(type.startsWith('uint')&&typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value))
   return BigInt(value).toString(16).padStart(64,'0');
 fail('gaming-abi-argument-invalid');
};
export const GAMING_ABI_SIGNATURES420=signatures;
export const GAMING_ABI_SELECTORS420=Object.freeze(Object.fromEntries(Object.entries(signatures).map(([name,methods])=>
 [name,Object.freeze(Object.fromEntries(Object.entries(methods).map(([method,sig])=>
  [method,'0x'+keccak256(Buffer.from(sig)).slice(2,10)])))])));
export function createGamingContractBindings420({transport}={}){
 if(typeof transport?.request!=='function'||typeof transport?.assertNetwork!=='function'||
 !transport.deployment?.contracts)fail('gaming-bindings-configuration');
 return Object.freeze({async read({contract,method,args=[],blockHash}={}){
  const sig=signatures[contract]?.[method],spec=transport.deployment.contracts[contract];
  if(!sig||!spec||!Array.isArray(args)||args.length!==types(sig).length)
   fail('gaming-abi-method-denied');
  if(typeof blockHash!=='string'||!/^0x[0-9a-f]{64}$/.test(blockHash)||
    /^0x0+$/.test(blockHash))fail('gaming-unpinned-read-denied');
  await transport.assertNetwork();
  const calldata=GAMING_ABI_SELECTORS420[contract][method]+types(sig).map((t,i)=>encode(t,args[i])).join('');
  const tag={blockHash,requireCanonical:true};
  const code=await transport.request('eth_getCode',[spec.address,tag]);
  if(typeof code!=='string'||!/^0x([0-9a-f]{2})+$/.test(code)||
   keccak256(Buffer.from(code.slice(2),'hex'))!==spec.codeHash)
   fail('gaming-codehash-mismatch');
  const data=await transport.request('eth_call',[{to:spec.address,data:calldata},tag]);
  if(typeof data!=='string'||!/^0x([0-9a-f]{64})+$/.test(data))
   fail('gaming-abi-result-invalid');
  return Object.freeze({data,blockHash,contract,method});
 }});
}
