import {normalizeExtensionAddress420,normalizeExtensionChain420} from './extension-wallet-ui.js';
import {keccak256Hex} from './keccak.js';
import {createNames420Client} from './names-client.js';
import {validateNamesRecord,normalize420Name} from './names-send.js';
const ZERO='0x'+'0'.repeat(40);
const ENS_REGISTRY='0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e';
const CANONICAL_NAMES420='0x0000000000000000000000000000000000000435';
const CANONICAL_NAMES420_RUNTIME_HASH='0xa974fffd3a40e7f28db41e4ae30656b33789d2483b18b47c809ce2385de709b7';
function codeHash420(hex){
  if(typeof hex!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(hex)||/^0x0+$/i.test(hex))
    throw new Error('Names420 deployed bytecode unavailable');
  const bytes=new Uint8Array((hex.length-2)/2);
  for(let i=0;i<bytes.length;i++)bytes[i]=Number.parseInt(hex.slice(2+i*2,4+i*2),16);
  return keccak256Hex(bytes);
}
const encoder=new TextEncoder();
function namehash(name){
  let node=new Uint8Array(32);
  for(const part of name.split('.').reverse()){
    const label=keccak256Hex(encoder.encode(part));
    const data=new Uint8Array(64);data.set(node);
    for(let i=0;i<32;i++)data[32+i]=parseInt(label.slice(2+i*2,4+i*2),16);
    const digest=keccak256Hex(data);
    node=Uint8Array.from({length:32},(_,i)=>parseInt(digest.slice(2+i*2,4+i*2),16));
  }
  return '0x'+Array.from(node,x=>x.toString(16).padStart(2,'0')).join('');
}
function abiAddress(result,label){
  if(typeof result!=='string'||!/^0x0{24}[0-9a-fA-F]{40}$/.test(result))
    throw new Error('invalid '+label+' address response');
  const address=normalizeExtensionAddress420('0x'+result.slice(-40));
  if(address===ZERO)throw new Error(label+' address unregistered');
  return address;
}
async function deployed(provider,address,label){
  const code=await provider.request('eth_getCode',[address,'latest']);
  if(typeof code!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(code)||/^0x0+$/i.test(code))
    throw new Error(label+' contract is not deployed');
}
export async function resolveExtensionRecipient420(provider,{input,chainId,qualifiedNamesConfig=null}={}){
  const verified=normalizeExtensionChain420(await provider.request('eth_chainId'));
  const chain=normalizeExtensionChain420(chainId);
  if(verified!==chain)throw new Error('recipient resolution network mismatch');
  if(typeof input!=='string'||input.length>255)throw new Error('invalid recipient name');
  if(/^0x[0-9a-fA-F]{40}$/.test(input)){
    return {input,recipient:normalizeExtensionAddress420(input),kind:'address',chainId:chain};
  }
  if(input.endsWith('.420')){
    const name=normalize420Name(input);
    const config=qualifiedNamesConfig;
    if(config?.schema!=='420-wallet-runtime-config-v1'||
      normalizeExtensionChain420(config?.network?.chainId)!==chain||
      !config?.deployment?.namesAddress||!config?.deployment?.environment||
      !config?.deployment?.sourceInventoryPhase||!config?.manifest?.url)
      throw new Error('420Names requires a qualified chain-specific deployment manifest');
    const canonical=normalizeExtensionAddress420(config.deployment.namesAddress);
    if(canonical!==CANONICAL_NAMES420)
      throw new Error('420Names address is not the frozen Genesis namespace');
    const runtime=await provider.request('eth_getCode',[canonical,'latest']);
    if(codeHash420(runtime)!==CANONICAL_NAMES420_RUNTIME_HASH)
      throw new Error('420Names deployed runtime hash is not the independently frozen canonical artifact');
    const client=createNames420Client({provider,namesAddress:canonical,chainId:chain});
    const lookup=await client.lookup(name);
    const record=validateNamesRecord(lookup.record,{nowSeconds:await client.chainTime(),expectedLabelHash:lookup.labelHash});
    await client.verifyChain();
    return {kind:'420names',input:name,recipient:record.recipient,owner:record.owner,
      expiresAt:record.expiresAt.toString(),labelHash:lookup.labelHash,
      registry:client.namesAddress,chainId:chain};
  }
  // Unicode and name-service wildcard/off-chain resolution require separate
  // ENSIP normalization and CCIP-read qualification; do not silently downgrade.
  if(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+eth$/.test(input)){
    if(chain!=='0x1')throw new Error('ENS is available only on qualified Ethereum mainnet');
    await deployed(provider,ENS_REGISTRY,'ENS registry');
    const node=namehash(input);
    const resolver=abiAddress(await provider.request('eth_call',[
      {to:ENS_REGISTRY,data:'0x0178b8bf'+node.slice(2)},'latest']),'ENS resolver');
    await deployed(provider,resolver,'ENS resolver');
    const recipient=abiAddress(await provider.request('eth_call',[
      {to:resolver,data:'0x3b3b57de'+node.slice(2)},'latest']),'ENS recipient');
    if(normalizeExtensionChain420(await provider.request('eth_chainId'))!==chain)
      throw new Error('ENS network changed during resolution');
    return {kind:'ens',input,recipient,node,resolver,registry:ENS_REGISTRY,chainId:chain};
  }
  throw new Error('unsupported recipient: use an EVM address, qualified .420 name, or supported ASCII .eth name');
}
export function assertExtensionRecipientSnapshot420(previous,current){
  if(!previous||!current||previous.kind!==current.kind||previous.input!==current.input||
     previous.chainId!==current.chainId||previous.recipient!==current.recipient||
     previous.owner!==current.owner||previous.expiresAt!==current.expiresAt||
     previous.resolver!==current.resolver||previous.registry!==current.registry||
     previous.labelHash!==current.labelHash||previous.node!==current.node)
    throw new Error('recipient name changed; review address again');
  return current.recipient;
}
export {namehash as ensNamehash420};
