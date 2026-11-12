const HASH=/^0x[0-9a-fA-F]{64}$/, QTY=/^0x[0-9a-fA-F]+$/;
export function normalizeTransactionHash420(hash) {if(typeof hash!=='string'||!HASH.test(hash))throw Error('invalid transaction hash');return hash.toLowerCase();}
export async function assertWalletChain420(provider,expected) {
  if(expected==null)return null;
  let n;try{n=BigInt(expected);}catch{throw Error('invalid expected Wallet chain');}
  if(n<=0n)throw Error('invalid expected Wallet chain');
  const chain=await provider.request('eth_chainId');
  if(typeof chain!=='string'||!QTY.test(chain))throw Error('invalid connected Wallet chain');
  if(BigInt(chain)!==n)throw Error('wallet chain changed or does not match approved runtime');
  return '0x'+n.toString(16);
}
export class PendingWalletTransaction420 extends Error{
  constructor(hash,reason='pending confirmation'){
    super('Wallet transaction '+reason+'; it may still be mined. Do not rebroadcast automatically.');
    this.code='WALLET_TX_PENDING';this.txHash=hash;this.name='PendingWalletTransaction420';
  }
}
export async function readWalletTransactionStatus420(provider,hash,options={}){
  hash=normalizeTransactionHash420(hash);
  await assertWalletChain420(provider,options.expectedChainId);
  const r=await provider.request('eth_getTransactionReceipt',[hash]);
  if(!r)return {txHash:hash,status:'pending',receipt:null,confirmations:0n};
  if(r.transactionHash!=null&&normalizeTransactionHash420(r.transactionHash)!==hash)throw Error('receipt transaction hash mismatch');
  if(r.status!=='0x1'&&r.status!=='0x0')throw Error('invalid transaction receipt status');
  if(options.canonical!==true)return {
    txHash:hash,status:r.status==='0x0'?'reverted':'confirmed',receipt:r,confirmations:1n
  };
  if(typeof r.blockNumber!=='string'||!QTY.test(r.blockNumber)||typeof r.blockHash!=='string'||!HASH.test(r.blockHash))throw Error('canonical receipt missing block metadata');
  const [block,tip]=await Promise.all([provider.request('eth_getBlockByNumber',[r.blockNumber,false]),provider.request('eth_blockNumber')]);
  if(typeof tip!=='string'||!QTY.test(tip))throw Error('invalid chain tip');
  if(!block||typeof block.hash!=='string'||!HASH.test(block.hash)||block.hash.toLowerCase()!==r.blockHash.toLowerCase())return {txHash:hash,status:'reorganized',receipt:r,confirmations:0n};
  const count=BigInt(tip)>=BigInt(r.blockNumber)?BigInt(tip)-BigInt(r.blockNumber)+1n:0n;
  const minimum=options.confirmations==null?1n:BigInt(options.confirmations);
  if(minimum<1n||minimum>1024n)throw Error('invalid confirmation count');
  if(count<minimum)return {txHash:hash,status:'confirming',receipt:r,confirmations:count};
  const latest=await provider.request('eth_getTransactionReceipt',[hash]);
  if(!latest||latest.blockHash?.toLowerCase()!==r.blockHash.toLowerCase()
      || latest.status!==r.status || (latest.transactionHash != null
      && normalizeTransactionHash420(latest.transactionHash)!==hash))
    return {txHash:hash,status:'reorganized',receipt:latest,confirmations:0n};
  await assertWalletChain420(provider,options.expectedChainId);
  return {txHash:hash,status:latest.status==='0x0'?'reverted':'confirmed',receipt:latest,confirmations:count};
}
export async function waitForWalletReceipt420(provider,hash,options={}){
  hash=normalizeTransactionHash420(hash);
  const attempts=Number.isInteger(options.attempts)&&options.attempts>0&&options.attempts<=10000?options.attempts:30;
  const delay=Number.isInteger(options.delayMs)&&options.delayMs>=0?options.delayMs:1000;
  const sleep=options.sleep||((ms)=>new Promise(resolve=>setTimeout(resolve,ms)));
  let state='pending';
  for(let i=0;i<attempts;i++){
    if(options.signal?.aborted||options.cancelled?.()===true)throw new PendingWalletTransaction420(hash,'tracking cancelled');
    const result=await readWalletTransactionStatus420(provider,hash,options);state=result.status;options.onStatus?.(result);
    if(state==='reverted')throw Error('Wallet transaction reverted');
    if(state==='confirmed')return result;
    if(i+1<attempts)await sleep(delay);
  }
  throw new PendingWalletTransaction420(hash,state==='reorganized'?'reorganized and awaiting canonical confirmation':'pending confirmation');
}
