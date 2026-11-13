import {normalizeAddress} from './abi.js';
const U256=(1n<<256n)-1n;
function addressWord(word){
 if(!/^0{24}[0-9a-fA-F]{40}$/.test(word))throw new Error('invalid ABI encoded approval address');
 const a=normalizeAddress('0x'+word.slice(24));if(/^0x0{40}$/.test(a))throw new Error('zero spender');
 return a;
}
export function inspectExtensionApprovalRisk420(tx={}){
 const data=tx.data??'0x';
 if(typeof data!=='string'||!/^0x(?:[0-9a-fA-F]{2})*$/.test(data))
  throw new Error('invalid transaction calldata');
 if(data==='0x')return {kind:'native-transfer',severity:'normal',
  message:'Native transfer; verify recipient and network before approval.'};
 const selector=data.slice(0,10).toLowerCase(),body=data.slice(10);
 if(selector==='0x095ea7b3'){
  if(!/^[0-9a-fA-F]{128}$/.test(body))throw new Error('malformed ERC-20 approval calldata');
  const spender=addressWord(body.slice(0,64)),allowance=BigInt('0x'+body.slice(64,128));
  return {kind:'erc20-approve',severity:allowance===U256?'critical':'high',
    spender,allowance:allowance.toString(),unlimited:allowance===U256,
    message:allowance===U256?'UNLIMITED ERC-20 spending permission for '+spender:
      'ERC-20 token allowance of '+allowance+' base units for '+spender};
 }
 if(selector==='0xa22cb465'){
  if(!/^[0-9a-fA-F]{128}$/.test(body))throw new Error('malformed NFT operator approval');
  const operator=addressWord(body.slice(0,64)),enabled=BigInt('0x'+body.slice(64,128));
  if(enabled!==0n&&enabled!==1n)throw new Error('invalid NFT operator approval boolean');
  return {kind:'nft-operator-approval',severity:enabled===1n?'critical':'normal',
    spender:operator,enabled:enabled===1n,
    message:enabled===1n?'NFT approval for ALL assets held in this collection by '+operator:
      'NFT operator approval will be revoked for '+operator};
 }
 if(selector==='0xa9059cbb'){
  if(!/^[0-9a-fA-F]{128}$/.test(body))throw new Error('malformed ERC-20 transfer');
  return {kind:'erc20-transfer',severity:'normal',
    recipient:addressWord(body.slice(0,64)),amount:BigInt('0x'+body.slice(64,128)).toString(),
    message:'ERC-20 transfer: verify the token contract, recipient and base-unit amount.'};
 }
 return {kind:'arbitrary-contract-call',severity:'high',
  message:'Unrecognized contract interaction. Calldata may change token permissions, assets or smart-account state.'};
}
