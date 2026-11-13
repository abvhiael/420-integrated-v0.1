
import {normalizeAddress} from './abi.js';
import {assertWalletChain420} from './transaction-lifecycle.js';
const Q=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const UINT128=(1n<<128n)-1n;
function quantity(value,label){
  if(typeof value!=='string'||!Q.test(value))throw new Error('invalid '+label+' RPC quantity');
  const n=BigInt(value);
  if(n<0n||n>UINT128)throw new Error(label+' outside uint128');
  return n;
}
export function normalizeExtensionFeeChoice420(choice){
  const level=choice?.level??'standard';
  if(!['economy','standard','priority','custom'].includes(level))throw new Error('unsupported fee choice');
  if(level==='custom'){
    const maxFeePerGas=quantity(choice.maxFeePerGas,'max fee');
    const maxPriorityFeePerGas=quantity(choice.maxPriorityFeePerGas,'priority fee');
    if(maxFeePerGas===0n||maxPriorityFeePerGas>maxFeePerGas)throw new Error('priority fee must not exceed max fee');
    return {level,maxFeePerGas:'0x'+maxFeePerGas.toString(16),maxPriorityFeePerGas:'0x'+maxPriorityFeePerGas.toString(16)};
  }
  return {level};
}
export function packExtensionUserOpFees420({maxFeePerGas,maxPriorityFeePerGas}){
  const max=quantity(maxFeePerGas,'max fee'),priority=quantity(maxPriorityFeePerGas,'priority fee');
  if(!max||priority>max)throw new Error('invalid UserOperation fee caps');
  return '0x'+priority.toString(16).padStart(32,'0')+max.toString(16).padStart(32,'0');
}
export async function quoteExtensionSend420(provider,{chainId,smartAccount,transaction,choice}={}){
  if(!provider||typeof provider.request!=='function')throw new Error('verified RPC required');
  await assertWalletChain420(provider,chainId);
  const mode=normalizeExtensionFeeChoice420(choice);
  const from=normalizeAddress(smartAccount),to=normalizeAddress(transaction?.to);
  if(!/^0x(?:[0-9a-fA-F]{2})*$/.test(transaction?.data??'0x'))throw new Error('invalid calldata');
  const value=quantity(transaction?.value??'0x0','transaction value');
  const call={from,to,data:transaction?.data??'0x',value:'0x'+value.toString(16)};
  // This checks target contract execution as SmartAccount, not EntryPoint execution.
  // It is NEVER evidence that the fully signed UserOperation will succeed.
  try{await provider.request('eth_call',[call,'latest']);}
  catch(e){throw new Error('Target simulation reverted: '+(e?.message||'eth_call failed'));}
  const block=await provider.request('eth_getBlockByNumber',['latest',false]);
  const base=quantity(block?.baseFeePerGas,'base fee');
  let tip;
  try{tip=quantity(await provider.request('eth_maxPriorityFeePerGas',[]),'suggested priority fee');}
  catch{throw new Error('Verified EIP-1559 priority fee RPC unavailable');}
  if(tip===0n)tip=1n;
  const multiplier={economy:1n,standard:2n,priority:3n};
  const maxPriorityFeePerGas=mode.level==='custom'?BigInt(mode.maxPriorityFeePerGas):tip*multiplier[mode.level];
  const maxFeePerGas=mode.level==='custom'?BigInt(mode.maxFeePerGas):base*2n+maxPriorityFeePerGas;
  if(maxFeePerGas>UINT128||maxPriorityFeePerGas>UINT128||maxFeePerGas<base+maxPriorityFeePerGas)
    throw new Error('fee cap does not cover current base fee and selected priority');
  let indicativeGasUnits=null;
  try{
    const estimated=await provider.request('eth_estimateGas',[call]);
    if(typeof estimated==='string'&&Q.test(estimated)&&BigInt(estimated)>0n)
      indicativeGasUnits=BigInt(estimated);
  }catch{ /* Do not convert failure of a target-only gas estimate into a verified AA quote. */ }
  await assertWalletChain420(provider,chainId);
  return Object.freeze({
    chainId,from,to,feeLevel:mode.level,
    maxFeePerGas:'0x'+maxFeePerGas.toString(16),
    maxPriorityFeePerGas:'0x'+maxPriorityFeePerGas.toString(16),
    baseFeePerGas:'0x'+base.toString(16),
    gasFees:packExtensionUserOpFees420({maxFeePerGas:'0x'+maxFeePerGas.toString(16),maxPriorityFeePerGas:'0x'+maxPriorityFeePerGas.toString(16)}),
    simulation:'target-only',entryPointSimulation:'required-after-passkey',
    estimateStatus:indicativeGasUnits===null?'unavailable':'target-call-only',
    gasUnits:indicativeGasUnits?.toString()??null,
    indicativeTargetFeeWei:indicativeGasUnits===null?null:
      (indicativeGasUnits*maxFeePerGas).toString(),
    totalFeeWei:null,
    blockHash:typeof block?.hash==='string'?block.hash:null
  });
}
export function assertExtensionPreflightUnchanged420(expected,current){
  if(!expected||!current||expected.chainId!==current.chainId||expected.from!==current.from||
    expected.to!==current.to||expected.gasFees!==current.gasFees||
    expected.blockHash!==current.blockHash)throw new Error('preflight changed; review and confirm again');
  return true;
}
