const TX_STATES=Object.freeze(['SUBMITTED','PENDING','INCLUDED','CONFIRMED','SAFE','FINALIZED','REVERTED','REORGED','DROPPED','UNKNOWN']);

export class ExchangeLifecycleError extends Error {
  constructor(code,message,details={}){
    super(message);
    this.name='ExchangeLifecycleError';
    this.code=code;
    this.details=Object.freeze({...details});
  }
}

function requireHash(value,label='transaction hash'){
  if(typeof value!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new ExchangeLifecycleError('INVALID_HASH',`invalid ${label}`);
  return value.toLowerCase();
}
function hexQuantity(value,label){
  if(typeof value!=='string'||!/^0x[0-9a-fA-F]+$/.test(value)) throw new ExchangeLifecycleError('INVALID_RPC_DATA',`invalid ${label}`);
  return BigInt(value);
}
async function rpc(provider,method,params=[]){
  if(!provider||typeof provider.request!=='function') throw new ExchangeLifecycleError('RPC_UNAVAILABLE','RPC provider required');
  try{return await provider.request({method,params});}
  catch(error){throw new ExchangeLifecycleError('RPC_ERROR',String(error?.message??'RPC request failed'),{method,providerCode:error?.code??null});}
}
function normalizeBlock(block,label){
  if(block===null||block===undefined) return null;
  if(typeof block!=='object') throw new ExchangeLifecycleError('INVALID_RPC_DATA',`invalid ${label}`);
  return Object.freeze({
    number:hexQuantity(block.number,`${label} number`),
    hash:requireHash(block.hash,`${label} hash`),
  });
}

export function normalizeReceipt(receipt,expectedTxHash=null){
  if(receipt===null||receipt===undefined) return null;
  if(typeof receipt!=='object') throw new ExchangeLifecycleError('INVALID_RECEIPT','invalid transaction receipt');
  const transactionHash=requireHash(receipt.transactionHash);
  if(expectedTxHash&&transactionHash!==requireHash(expectedTxHash)) throw new ExchangeLifecycleError('RECEIPT_MISMATCH','receipt transaction hash mismatch');
  const blockHash=requireHash(receipt.blockHash,'receipt block hash');
  const blockNumber=hexQuantity(receipt.blockNumber,'receipt block number');
  const status=hexQuantity(receipt.status,'receipt status');
  if(status!==0n&&status!==1n) throw new ExchangeLifecycleError('INVALID_RECEIPT','invalid receipt status');
  return Object.freeze({
    transactionHash,
    blockHash,
    blockNumber,
    status,
    gasUsed:receipt.gasUsed??null,
    cumulativeGasUsed:receipt.cumulativeGasUsed??null,
    contractAddress:receipt.contractAddress??null,
    logs:Array.isArray(receipt.logs)?receipt.logs:[],
    raw:receipt,
  });
}

export function confirmationCount(includedBlock,latestBlock){
  const included=BigInt(includedBlock), latest=BigInt(latestBlock);
  return latest<included?0n:latest-included+1n;
}

export async function inspectTransactionLifecycle({
  provider,
  txHash,
  minConfirmations=1,
}={}){
  const hash=requireHash(txHash);
  if(!Number.isInteger(minConfirmations)||minConfirmations<1) throw new ExchangeLifecycleError('INVALID_POLICY','minConfirmations must be >= 1');

  const [txRaw,receiptRaw,latestRaw,safeRaw,finalizedRaw]=await Promise.all([
    rpc(provider,'eth_getTransactionByHash',[hash]),
    rpc(provider,'eth_getTransactionReceipt',[hash]),
    rpc(provider,'eth_getBlockByNumber',['latest',false]),
    rpc(provider,'eth_getBlockByNumber',['safe',false]),
    rpc(provider,'eth_getBlockByNumber',['finalized',false]),
  ]);
  const latest=normalizeBlock(latestRaw,'latest block');
  if(!latest) throw new ExchangeLifecycleError('INVALID_RPC_DATA','latest block unavailable');
  const safe=normalizeBlock(safeRaw,'safe block');
  const finalized=normalizeBlock(finalizedRaw,'finalized block');
  const receipt=normalizeReceipt(receiptRaw,hash);

  if(!receipt){
    return Object.freeze({
      state:txRaw?'PENDING':'DROPPED',
      txHash:hash,
      receipt:null,
      confirmations:0,
      latestBlock:latest.number.toString(),
      safeBlock:safe?.number.toString()??null,
      finalizedBlock:finalized?.number.toString()??null,
      canonical:true,
    });
  }

  const inclusionBlockRaw=await rpc(provider,'eth_getBlockByNumber',['0x'+receipt.blockNumber.toString(16),false]);
  const inclusionBlock=normalizeBlock(inclusionBlockRaw,'inclusion block');
  if(!inclusionBlock||inclusionBlock.hash!==receipt.blockHash){
    return Object.freeze({
      state:'REORGED',
      txHash:hash,
      receipt,
      confirmations:0,
      latestBlock:latest.number.toString(),
      safeBlock:safe?.number.toString()??null,
      finalizedBlock:finalized?.number.toString()??null,
      canonical:false,
    });
  }

  if(receipt.status===0n){
    return Object.freeze({
      state:'REVERTED',
      txHash:hash,
      receipt,
      confirmations:Number(confirmationCount(receipt.blockNumber,latest.number)),
      latestBlock:latest.number.toString(),
      safeBlock:safe?.number.toString()??null,
      finalizedBlock:finalized?.number.toString()??null,
      canonical:true,
    });
  }

  const confirmations=confirmationCount(receipt.blockNumber,latest.number);
  let state='INCLUDED';
  if(finalized&&receipt.blockNumber<=finalized.number) state='FINALIZED';
  else if(safe&&receipt.blockNumber<=safe.number) state='SAFE';
  else if(confirmations>=BigInt(minConfirmations)) state='CONFIRMED';

  return Object.freeze({
    state,
    txHash:hash,
    receipt,
    confirmations:Number(confirmations),
    latestBlock:latest.number.toString(),
    safeBlock:safe?.number.toString()??null,
    finalizedBlock:finalized?.number.toString()??null,
    canonical:true,
  });
}

export function reconcileIndexedActivity({txHash,rpcLifecycle,records=[]}={}){
  const hash=requireHash(txHash);
  if(!rpcLifecycle||!TX_STATES.includes(rpcLifecycle.state)) throw new ExchangeLifecycleError('INVALID_LIFECYCLE','RPC lifecycle required');
  if(!Array.isArray(records)) throw new ExchangeLifecycleError('INVALID_INDEX_DATA','indexed records must be an array');

  const matches=records.filter((record)=>typeof record?.txHash==='string'&&record.txHash.toLowerCase()===hash);
  const canonical=matches.filter((record)=>record.active!==false);
  const orphaned=matches.filter((record)=>record.active===false);
  const replacements=matches.filter((record)=>record.replacedBy).map((record)=>record.replacedBy);

  let status='UNINDEXED';
  if(matches.length){
    if(canonical.length) status='CANONICAL';
    else if(orphaned.length) status='REORGED';
  }

  const conflicts=[];
  if(rpcLifecycle.state==='REORGED'&&canonical.length) conflicts.push('rpc-reorg-v13-canonical');
  if(['SAFE','FINALIZED','CONFIRMED','INCLUDED'].includes(rpcLifecycle.state)&&orphaned.length&&!canonical.length) conflicts.push('rpc-canonical-v13-reorg');
  if(rpcLifecycle.state==='REVERTED'&&canonical.some((record)=>record.kind==='TRADE'||record.kind==='FILL'||record.kind==='BRIDGE_WITHDRAWAL'||record.kind==='BRIDGE_DEPOSIT')){
    conflicts.push('reverted-rpc-has-canonical-success-activity');
  }

  return Object.freeze({
    txHash:hash,
    status,
    records:Object.freeze(matches),
    canonicalRecords:Object.freeze(canonical),
    orphanedRecords:Object.freeze(orphaned),
    replacementRecordIds:Object.freeze(replacements),
    conflicts:Object.freeze(conflicts),
    reconciled:conflicts.length===0&&matches.length>0,
  });
}

export async function loadV13TransactionRecords({
  exchangeClient,
  txHash,
  kinds=['TRADE','FILL','ORDER','CANCELLATION','BRIDGE_DEPOSIT','BRIDGE_WITHDRAWAL','FEE_ROUTING'],
  subjectId=null,
  perKindLimit=100,
}={}){
  const hash=requireHash(txHash);
  if(!exchangeClient||typeof exchangeClient.history!=='function') throw new ExchangeLifecycleError('INDEXER_UNAVAILABLE','Exchange V13 client required');
  const records=[];
  for(const kind of kinds){
    const page=await exchangeClient.history({kind,subjectId,activeOnly:false,limit:perKindLimit});
    for(const record of page.records){
      if(typeof record.txHash==='string'&&record.txHash.toLowerCase()===hash) records.push(record);
    }
  }
  return Object.freeze(records);
}

export async function inspectAndReconcileTransaction({
  provider,
  exchangeClient,
  txHash,
  minConfirmations=1,
  subjectId=null,
  kinds,
}={}){
  const rpcLifecycle=await inspectTransactionLifecycle({provider,txHash,minConfirmations});
  const records=exchangeClient
    ? await loadV13TransactionRecords({exchangeClient,txHash,subjectId,kinds})
    : [];
  const reconciliation=reconcileIndexedActivity({txHash,rpcLifecycle,records});
  return Object.freeze({rpc:rpcLifecycle,indexed:reconciliation});
}

export {TX_STATES};
