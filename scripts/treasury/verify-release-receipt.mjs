/**
 * Operator-side correlation for the atomic Treasury release executor.
 * Never a consensus verifier, never signs or submits transactions.
 * Requires a separately reviewed plan + trusted chain RPC + reviewed executor runtime hash.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const require = createRequire(new URL('../../420-indexer/package.json', import.meta.url));
const { AbiCoder, Interface, JsonRpcProvider, concat, id, keccak256, ZeroHash } = require('ethers');
const abi = AbiCoder.defaultAbiCoder();
export const EVIDENCE_TYPE = 'tuple(uint256 chainId,address protocolRegistry,address treasuryRouter,uint32 treasuryVersion,address vaultRouter,uint32 vaultVersion,address disbursementRegistry,address budgetRegistry,address vaultAccounting,bytes32 disbursementId,bytes32 budgetId,bytes32 vaultId,address vault,bytes32 vaultCodeHash,address asset,address recipient,uint128 amount,bytes32 civicActionHash,bytes32 purposeHash,address executor,address operator,bytes32 operationId)';
const RELEASE_DOMAIN = id('420/TREASURY/VAULT_RELEASE_COMMITMENT/V1');
const OPERATION_DOMAIN = id('420/TREASURY/VAULT_RELEASE_OPERATION/V1');
const execABI = new Interface([
  'event VaultReleaseCommitted(bytes32 indexed disbursementId,bytes32 indexed operationId,bytes32 indexed commitment,bytes evidence)',
  'function execute(bytes32 id,bytes32 expectedCommitment) returns (bytes32)',
  'function registry() view returns (address)', 'function operator() view returns (address)',
]);
const vaultABI = new Interface([
  'event Withdrawal(bytes32 indexed operationId,address indexed asset,address indexed recipient,uint256 amount)',
  'function executedOperation(bytes32) view returns (bool)',
  'function vaultId() view returns (bytes32)', 'function accounting() view returns (address)',
]);
const accountingABI = new Interface([
  'event WithdrawalRecorded(bytes32 indexed vaultId,address indexed asset,uint256 amount,uint256 balance)',
]);
const treasuryABI = new Interface([
  'event DisbursementExecuted(bytes32 indexed disbursementId,bytes32 vaultReleaseHash,address indexed executor)',
  'function disbursement(bytes32) view returns (tuple(bytes32 budgetId,address recipient,address asset,uint128 amount,uint64 notBefore,uint64 expiresAt,bytes32 civicActionHash,bytes32 purposeHash,bytes32 vaultReleaseHash,uint8 state,bool exists))',
  'function budgets() view returns (address)',
]);
const budgetABI = new Interface([
  'event BudgetCommitmentChanged(bytes32 indexed budgetId,uint128 committed,uint128 executed)',
  'function budget(bytes32) view returns (tuple(bytes32 vaultId,bytes32 category,address asset,uint128 ceiling,uint128 committed,uint128 executed,uint64 validFrom,uint64 validUntil,bytes32 civicActionHash,bytes32 metadataHash,bool active,bool exists))',
]);
const eq = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
function need(ok, message) { if (!ok) throw new Error(message); }
const hex32 = x => typeof x === 'string' && /^0x[0-9a-f]{64}$/i.test(x) && !eq(x, ZeroHash);
export function decodeReviewedPlan(plan) {
  need(plan && hex32(plan.commitment) && hex32(plan.executorCodeHash), 'missing reviewed commitment/runtime identity');
  const e = abi.decode([EVIDENCE_TYPE], plan.evidence)[0];
  need(eq(abi.encode([EVIDENCE_TYPE], [e]), plan.evidence), 'noncanonical evidence encoding');
  need(eq(keccak256(concat([RELEASE_DOMAIN, plan.evidence])), plan.commitment), 'commitment mismatch');
  need(BigInt(plan.chainId) === e.chainId && eq(plan.registry, e.protocolRegistry)
    && eq(plan.executor, e.executor) && eq(plan.disbursementId, e.disbursementId), 'reviewed identity mismatch');
  need(e.amount > 0n && hex32(e.disbursementId) && hex32(e.budgetId) && hex32(e.vaultId)
    && hex32(e.civicActionHash) && hex32(e.purposeHash) && hex32(e.vaultCodeHash), 'invalid release fields');
  const op = keccak256(abi.encode(['bytes32','uint256','address','bytes32'],
    [OPERATION_DOMAIN,e.chainId,e.disbursementRegistry,e.disbursementId]));
  need(eq(op,e.operationId), 'operation identity mismatch');
  return e;
}
async function read(rpc, address, iface, name, args, tag) {
  const raw = await rpc.send('eth_call', [{to:address,data:iface.encodeFunctionData(name,args)},tag]);
  return iface.decodeFunctionResult(name, raw)[0];
}
function eventIn(receipt, emitter, iface, name, filter) {
  const topic = iface.getEvent(name).topicHash;
  const selected = receipt.logs.filter(l => eq(l.address, emitter) && eq(l.topics[0], topic))
    .map(l => ({log:l,args:iface.parseLog(l).args})).filter(x => filter(x.args));
  need(selected.length === 1, 'missing or duplicate ' + name);
  const {log,args}=selected[0];
  need(log.removed !== true && eq(log.transactionHash,receipt.transactionHash)
    && eq(log.blockHash,receipt.blockHash) && BigInt(log.blockNumber)===BigInt(receipt.blockNumber)
    && BigInt(log.transactionIndex)===BigInt(receipt.transactionIndex), 'log provenance mismatch: ' + name);
  return {args,index:BigInt(log.logIndex)};
}
async function canonicalBlock(rpc, receipt) {
  const block = await rpc.send('eth_getBlockByNumber',[receipt.blockNumber,false]);
  need(block && eq(block.hash,receipt.blockHash) && BigInt(block.number)===BigInt(receipt.blockNumber)
    && eq(block.transactions[Number(BigInt(receipt.transactionIndex))],receipt.transactionHash),
    'receipt is not in the canonical block/transaction position');
  return block;
}
export async function verifyReleaseReceipt(rpc, plan, transactionHash) {
  const e=decodeReviewedPlan(plan);
  need(hex32(transactionHash),'invalid transaction hash');
  need(BigInt(await rpc.send('eth_chainId',[]))===e.chainId,'wrong chain');
  const receipt=await rpc.send('eth_getTransactionReceipt',[transactionHash]);
  need(receipt && eq(receipt.transactionHash,transactionHash) && BigInt(receipt.status)===1n,'receipt unavailable or failed');
  const block=await canonicalBlock(rpc,receipt);
  const tx=await rpc.send('eth_getTransactionByHash',[transactionHash]);
  need(tx && eq(tx.hash,transactionHash) && eq(tx.blockHash,receipt.blockHash)
    && BigInt(tx.blockNumber)===BigInt(receipt.blockNumber) && BigInt(tx.transactionIndex)===BigInt(receipt.transactionIndex)
    && eq(tx.from,receipt.from) && ((tx.to===null && receipt.to===null)||eq(tx.to,receipt.to)), 'transaction provenance mismatch');
  const tag=receipt.blockNumber;
  // Direct EOA/operator submission or a nested call (e.g. a smart account). For nested calls,
  // the trusted executor's onlyOperator check and event bind operator, not outer tx.from.
  if (eq(tx.to,e.executor)) {
    const parsed=execABI.parseTransaction({data:tx.input,value:tx.value});
    need(parsed?.name==='execute' && eq(tx.from,e.operator) && BigInt(tx.value)===0n
      && eq(parsed.args[0],e.disbursementId) && eq(parsed.args[1],plan.commitment),'direct transaction intent mismatch');
  }
  const [executorCode,vaultCode,registry,operator,d,b,opUsed,vid,accounting,budgetRegistry]=await Promise.all([
    rpc.send('eth_getCode',[e.executor,tag]),rpc.send('eth_getCode',[e.vault,tag]),
    read(rpc,e.executor,execABI,'registry',[],tag),read(rpc,e.executor,execABI,'operator',[],tag),
    read(rpc,e.disbursementRegistry,treasuryABI,'disbursement',[e.disbursementId],tag),
    read(rpc,e.budgetRegistry,budgetABI,'budget',[e.budgetId],tag),
    read(rpc,e.vault,vaultABI,'executedOperation',[e.operationId],tag),
    read(rpc,e.vault,vaultABI,'vaultId',[],tag),read(rpc,e.vault,vaultABI,'accounting',[],tag),
    read(rpc,e.disbursementRegistry,treasuryABI,'budgets',[],tag),
  ]);
  need(executorCode!=='0x' && eq(keccak256(executorCode),plan.executorCodeHash)
    && vaultCode!=='0x' && eq(keccak256(vaultCode),e.vaultCodeHash)
    && eq(registry,e.protocolRegistry) && eq(operator,e.operator)
    && eq(vid,e.vaultId) && eq(accounting,e.vaultAccounting) && eq(budgetRegistry,e.budgetRegistry),
    'historical deployment identity mismatch');
  need(d.exists && d.state===2n && eq(d.budgetId,e.budgetId) && eq(d.asset,e.asset)
    && eq(d.recipient,e.recipient) && d.amount===e.amount && eq(d.civicActionHash,e.civicActionHash)
    && eq(d.purposeHash,e.purposeHash) && eq(d.vaultReleaseHash,plan.commitment)
    && b.exists && eq(b.vaultId,e.vaultId) && eq(b.asset,e.asset) && eq(b.civicActionHash,e.civicActionHash)
    && b.executed>=e.amount && b.executed<=b.committed && b.committed<=b.ceiling && opUsed,
    'historical canonical accounting mismatch');
  const withdrawal=eventIn(receipt,e.vault,vaultABI,'Withdrawal',a=>eq(a.operationId,e.operationId));
  need(eq(withdrawal.args.asset,e.asset) && eq(withdrawal.args.recipient,e.recipient)
    && withdrawal.args.amount===e.amount,'Vault withdrawal fields mismatch');
  const debit=eventIn(receipt,e.vaultAccounting,accountingABI,'WithdrawalRecorded',
    a=>eq(a.vaultId,e.vaultId)&&eq(a.asset,e.asset)&&a.amount===e.amount);
  const settlement=eventIn(receipt,e.budgetRegistry,budgetABI,'BudgetCommitmentChanged',a=>eq(a.budgetId,e.budgetId));
  need(settlement.args.executed>=e.amount && settlement.args.executed<=settlement.args.committed,'budget event mismatch');
  const executed=eventIn(receipt,e.disbursementRegistry,treasuryABI,'DisbursementExecuted',a=>eq(a.disbursementId,e.disbursementId));
  need(eq(executed.args.vaultReleaseHash,plan.commitment)&&eq(executed.args.executor,e.executor),'Treasury commitment/executor mismatch');
  const committed=eventIn(receipt,e.executor,execABI,'VaultReleaseCommitted',a=>eq(a.disbursementId,e.disbursementId));
  need(eq(committed.args.operationId,e.operationId)&&eq(committed.args.commitment,plan.commitment)
    && eq(committed.args.evidence,plan.evidence),'executor evidence mismatch');
  need(debit.index<withdrawal.index && withdrawal.index<settlement.index && settlement.index<executed.index
    && executed.index<committed.index,'release event ordering mismatch');
  await canonicalBlock(rpc,receipt); // Detect a reorg during the historical reads.
  return {status:'CORRELATED_AT_CHECKED_CANONICAL_BLOCK',chainId:e.chainId.toString(),
    transactionHash,blockHash:block.hash,blockNumber:BigInt(block.number).toString(),
    transactionIndex:BigInt(receipt.transactionIndex).toString(),from:tx.from,to:tx.to,
    disbursementId:e.disbursementId,operationId:e.operationId,commitment:plan.commitment,
    logIndices:[debit,withdrawal,settlement,executed,committed].map(x=>x.index.toString()),
    finality:'NOT_ESTABLISHED_BY_THIS_CHECK'};
}
export async function recoverRelease(rpc,plan,fromBlock,toBlock) {
  const e=decodeReviewedPlan(plan);
  need(BigInt(await rpc.send('eth_chainId',[]))===e.chainId,'wrong chain');
  need(/^0x[0-9a-f]+$/i.test(fromBlock)&&/^0x[0-9a-f]+$/i.test(toBlock)
    && BigInt(fromBlock)<=BigInt(toBlock),'explicit bounded block range required');
  const logs=await rpc.send('eth_getLogs',[{address:e.executor,fromBlock,toBlock,
    topics:[execABI.getEvent('VaultReleaseCommitted').topicHash,e.disbursementId,e.operationId]}]);
  need(logs.length<=1,'ambiguous release history; stop and reconcile');
  if (logs.length===1) {
    need(logs[0].removed!==true,'removed recovery log');
    return verifyReleaseReceipt(rpc,plan,logs[0].transactionHash);
  }
  const block=await rpc.send('eth_getBlockByNumber',['latest',false]);
  need(block && hex32(block.hash),'latest block unavailable');
  const [d,used]=await Promise.all([
    read(rpc,e.disbursementRegistry,treasuryABI,'disbursement',[e.disbursementId],block.number),
    read(rpc,e.vault,vaultABI,'executedOperation',[e.operationId],block.number),
  ]);
  const current=await rpc.send('eth_getBlockByNumber',[block.number,false]);
  need(current && eq(current.hash,block.hash),'reorg during reconciliation');
  return {status:used||d.state===2n?'MANUAL_RECONCILIATION_REQUIRED':
    d.state===1n?'SCHEDULED_NO_MATCH_IN_RANGE':'TERMINAL_OR_UNAVAILABLE',
    blockHash:block.hash,blockNumber:BigInt(block.number).toString(),vaultOperationUsed:used,
    treasuryState:d.state.toString(),automaticRetryAuthorized:false};
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [planPath,receiptOrFrom,toBlock]=process.argv.slice(2);
  need(planPath&&receiptOrFrom&&process.env.TREASURY_RPC_URL,
    'usage: TREASURY_RPC_URL=... node verify-release-receipt.mjs plan.json TX_HASH | FROM_HEX TO_HEX');
  const rpc=new JsonRpcProvider(process.env.TREASURY_RPC_URL);
  try {
    const plan=JSON.parse(readFileSync(planPath,'utf8'));
    const result=toBlock?await recoverRelease(rpc,plan,receiptOrFrom,toBlock):
      await verifyReleaseReceipt(rpc,plan,receiptOrFrom);
    console.log(JSON.stringify(result,null,2));
  } finally { rpc.destroy(); }
}
