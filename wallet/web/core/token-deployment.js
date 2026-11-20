import {assertWalletChain420,normalizeTransactionHash420,readWalletTransactionStatus420} from './transaction-lifecycle.js';
import {tokenHashText420,tokenHashHex420,tokenAddressWord420,tokenWord420,tokenReadCall420} from './token-sdk.js';
import {TOKEN_CREATION_FEE_WEI_420,TOKEN_COMMUNITY_VAULT_ID_420,normalizeTokenReleaseBinding420} from './token-runtime.js';

const check=(ok,msg)=>{if(!ok)throw Error(msg);};
const hex=(x,n)=>typeof x==='string'&&x.length===2+n*2&&/^0x[0-9a-fA-F]+$/.test(x);
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const qty=x=>{check(typeof x==='string'&&x.length<=66&&/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(x),'Malformed transaction quantity');return BigInt(x);};
const word=x=>'0x'+tokenAddressWord420(x);
const deploymentTopic=tokenHashText420('TokenDeployed(address,address,bytes32,uint32,bytes32,uint256)');
const feeTopic=tokenHashText420('CreationFeeDeposited(address,bytes32,uint256)');
const vaultId=tokenHashText420(TOKEN_COMMUNITY_VAULT_ID_420);
const feeWord='0x'+tokenWord420(TOKEN_CREATION_FEE_WEI_420);
const eventData=(...words)=>'0x'+words.map(x=>x.replace(/^0x/,'')).join('');
const result=(txHash,status,extra={})=>Object.freeze({txHash,status,tokenAddress:null,confirmations:0n,...extra});

// A canonical receipt proves inclusion, not finality or token approval. The
// Wallet must supply its retained approved review, never a dApp's event claims.
export async function readTokenDeployment420(provider,submitted,binding,options={}){
  const r=normalizeTokenReleaseBinding420(binding),q=submitted.review,hash=normalizeTransactionHash420(submitted.txHash);
  check(q.chainId===r.chainId&&q.request.target===r.factory.address&&q.communityTreasuryVault===r.communityTreasuryVault.address&&
    ['metadataHash','manifestHash','interfaceHash','dependencyRoot'].every(k=>q.release[k]===r.release[k]),'Submitted Token release mismatch');
  const state=await readWalletTransactionStatus420(provider,hash,{canonical:true,expectedChainId:r.chainId,confirmations:options.confirmations??1});
  if(!['confirmed','reverted'].includes(state.status))return result(hash,state.status,{confirmations:state.confirmations});
  const receipt=state.receipt,tag=receipt.blockNumber,blockHash=receipt.blockHash;
  const tx=await provider.request('eth_getTransactionByHash',[hash]);
  check(tx&&same(tx.hash,hash)&&same(tx.blockHash,blockHash)&&qty(tx.blockNumber)===qty(tag)&&
    same(receipt.from,q.controller)&&same(receipt.to,q.smartAccount)&&same(tx.from,q.controller)&&same(tx.to,q.smartAccount)&&
    qty(tx.value)===0n&&same(tx.input,q.transaction.data),'Transaction does not match reviewed SmartAccount execution');
  check(tx.chainId==null||qty(tx.chainId)===BigInt(q.chainId),'Transaction chain mismatch');
  check(tx.type==null||qty(tx.type)===0n,'Unexpected transaction fee type');
  check(tx.maxFeePerGas==null&&tx.maxPriorityFeePerGas==null,'Unexpected dynamic fee fields');
  const gas=qty(tx.gas),price=qty(tx.gasPrice),used=qty(receipt.gasUsed),effective=qty(receipt.effectiveGasPrice);
  check(gas>0n&&gas<=BigInt(q.gasUnits)&&price<=BigInt(q.gasPriceWei)&&gas*price<=BigInt(submitted.maxGasWei)&&
    used<=gas&&effective===price&&used*effective+TOKEN_CREATION_FEE_WEI_420<=BigInt(submitted.maxTotalWei),
    'Transaction exceeded reviewed fee bounds');
  async function canonical(){
    const [block,again]=await Promise.all([provider.request('eth_getBlockByNumber',[tag,false]),provider.request('eth_getTransactionReceipt',[hash])]);
    await assertWalletChain420(provider,r.chainId);
    return block&&qty(block.number)===qty(tag)&&same(block.hash,blockHash)&&again&&same(again.transactionHash,hash)&&
      same(again.blockHash,blockHash)&&again.blockNumber===tag&&again.status===receipt.status&&
      JSON.stringify(again.logs)===JSON.stringify(receipt.logs);
  }
  if(state.status==='reverted')return await canonical()?result(hash,'reverted',{confirmations:state.confirmations}):result(hash,'reorganized');
  check(Array.isArray(receipt.logs),'Missing receipt logs');
  const factoryLogs=receipt.logs.filter(l=>same(l?.address,r.factory.address));
  function one(topic){
    const matches=factoryLogs.filter(l=>same(l.topics?.[0],topic));
    check(matches.length===1,'Missing or duplicate canonical factory event');
    const l=matches[0];
    check(l.removed===false&&same(l.transactionHash,hash)&&same(l.blockHash,blockHash)&&qty(l.blockNumber)===qty(tag)&&qty(l.transactionIndex)===qty(receipt.transactionIndex),
      'Factory log is not bound to the canonical receipt');
    return l;
  }
  const deployed=one(deploymentTopic),fee=one(feeTopic);
  const tokenWord=deployed.topics[1];
  check(deployed.topics.length===4&&hex(tokenWord,32)&&/^0x0{24}[0-9a-fA-F]{40}$/.test(tokenWord)&&
    same(deployed.topics[2],word(q.smartAccount))&&same(deployed.topics[3],q.templateId)&&
    same(deployed.data,eventData(tokenWord420(1n),q.configHash,feeWord)),'Deployment event differs from reviewed configuration');
  const token='0x'+tokenWord.slice(-40).toLowerCase();
  check(BigInt(token)!==0n&&same(token,q.predictedAddress)&&token!==q.smartAccount&&token!==q.controller&&
    !Object.values(r.dependencies).some(x=>x.address===token),'Deployment address differs from reviewed prediction');
  check(fee.topics.length===3&&same(fee.topics[1],word(r.communityTreasuryVault.address))&&same(fee.topics[2],vaultId)&&
    same(fee.data,feeWord)&&qty(fee.logIndex)>qty(deployed.logIndex),'Treasury fee event mismatch');
  for(const dep of [r.factory,r.communityTreasuryVault]){
    const code=await provider.request('eth_getCode',[dep.address,tag]);
    check(tokenHashHex420(code)===dep.codeHash,'Deployment dependency code mismatch');
  }
  const code=await provider.request('eth_getCode',[token,tag]);
  check(typeof code==='string'&&/^0x(?:[0-9a-fA-F]{2})+$/.test(code)&&!/^0x(?:00)+$/.test(code),'Missing deployed token code');
  const registered=await provider.request('eth_call',[{to:r.factory.address,data:tokenReadCall420('isFactoryDeployment(address)',['address'],[token])},tag]);
  check(same(registered,'0x'+tokenWord420(1n)),'Token is not a recorded factory deployment');
  if(!await canonical())return result(hash,'reorganized');
  return result(hash,'confirmed',{tokenAddress:token,confirmations:state.confirmations,blockNumber:tag,blockHash:blockHash.toLowerCase(),
    templateId:q.templateId,configHash:q.configHash,creationFeeWei:TOKEN_CREATION_FEE_WEI_420.toString(),gasPaidWei:(used*effective).toString()});
}
