import { Contract, Interface, JsonRpcProvider, getAddress, keccak256 } from 'ethers';
import type { Hex32 } from './types.js';
import type { CanonicalVaultOperation420, VaultEscrowSnapshot420, VaultEvidenceReader420, VaultObligationSnapshot420 } from './vault-reconciliation.js';

const ESCROW_ABI = ['function escrows(bytes32) view returns (address payer,address beneficiary,bytes32 providerId,bytes32 vaultRef,bytes32 fundingRef,bytes32 settlementRef,uint256 amount,uint8 state)'];
const ACCOUNTING_ABI = [
  'function getObligation(bytes32) view returns (tuple(bytes32 vaultId,address asset,address beneficiary,uint256 amount,bytes32 obligationType,bytes32 sourceRef,uint8 state,bool exists))',
  'event ObligationClaimed(bytes32 indexed obligationId,uint256 amount)'
];
const VAULT_ABI = [
  'function vaultId() view returns (bytes32)',
  'function accounting() view returns (address)',
  'function executedOperation(bytes32) view returns (bool)',
  'event Withdrawal(bytes32 indexed operationId,address indexed asset,address indexed recipient,uint256 amount)'
];
const WITHDRAWAL = new Interface(VAULT_ABI).getEvent('Withdrawal')!;
const CLAIMED = new Interface(ACCOUNTING_ABI).getEvent('ObligationClaimed')!;
const ESCROW_STATES = ['NONE','FUNDED','CLAIMABLE','REFUNDABLE','CLOSED'] as const;
const OBLIGATION_STATES = ['NONE','RESERVED','CLAIMABLE','CLAIMED','CANCELLED'] as const;
const ZERO32 = `0x${'00'.repeat(32)}`;
const B32 = /^0x[0-9a-fA-F]{64}$/;
const eq = (a: string,b: string): boolean => a.toLowerCase() === b.toLowerCase();
function id(value: string): Hex32 { if (!B32.test(value) || eq(value,ZERO32)) throw new Error('invalid Vault evidence identifier'); return value.toLowerCase() as Hex32; }
function address(value: string): string { const a=getAddress(value); if (a === '0x0000000000000000000000000000000000000000') throw new Error('zero Vault deployment address'); return a; }

/** Addresses AND runtime bytecode hashes must be obtained from an independently approved deployment manifest. */
export interface VaultRPCEvidenceConfig420 {
  chainId: bigint;
  confirmations: number;
  fromBlock: number;
  vaultRef: Hex32;
  escrowAddress: string;
  vaultAddress: string;
  accountingAddress: string;
  escrowCodeHash: Hex32;
  vaultCodeHash: Hex32;
  accountingCodeHash: Hex32;
}

/** Immutable snapshot. A fresh reader is required after a reorg, with every read rechecking its pinned block. */
export class VaultRPCEvidence420 implements VaultEvidenceReader420 {
  private readonly escrow: Contract;
  private readonly vault: Contract;
  private readonly accounting: Contract;
  private readonly addresses: {escrow:string;vault:string;accounting:string};
  private constructor(readonly rpc: JsonRpcProvider, readonly config: VaultRPCEvidenceConfig420, readonly height: number, readonly blockHash: string) {
    this.addresses={escrow:address(config.escrowAddress),vault:address(config.vaultAddress),accounting:address(config.accountingAddress)};
    this.escrow=new Contract(this.addresses.escrow,ESCROW_ABI,rpc);
    this.vault=new Contract(this.addresses.vault,VAULT_ABI,rpc);
    this.accounting=new Contract(this.addresses.accounting,ACCOUNTING_ABI,rpc);
  }
  static async open(rpc: JsonRpcProvider, config: VaultRPCEvidenceConfig420): Promise<VaultRPCEvidence420> {
    id(config.vaultRef); id(config.escrowCodeHash); id(config.vaultCodeHash); id(config.accountingCodeHash);
    if (config.chainId<=0n || !Number.isSafeInteger(config.confirmations) || config.confirmations<1 || !Number.isSafeInteger(config.fromBlock) || config.fromBlock<0) throw new Error('invalid Vault evidence finality configuration');
    const tip=await rpc.getBlockNumber();
    const height=tip-config.confirmations;
    if (height<config.fromBlock) throw new Error('insufficient confirmed Vault history');
    const block=await rpc.getBlock(height);
    if (!block?.hash) throw new Error('Vault pinned block unavailable');
    const reader=new VaultRPCEvidence420(rpc,config,height,block.hash);
    await reader.assertCanonical();
    const contracts=[
      [reader.addresses.escrow,config.escrowCodeHash],
      [reader.addresses.vault,config.vaultCodeHash],
      [reader.addresses.accounting,config.accountingCodeHash]
    ] as const;
    if (new Set(contracts.map(([a])=>a.toLowerCase())).size!==3) throw new Error('duplicate Vault deployment addresses');
    for (const [a,expected] of contracts) {
      const code=await rpc.getCode(a,height);
      if (code==='0x' || !eq(keccak256(code),expected)) throw new Error('Vault deployment bytecode mismatch');
    }
    const [vaultRef,accountingAddress]=await Promise.all([reader.vault.vaultId({blockTag:height}),reader.vault.accounting({blockTag:height})]);
    if (!eq(vaultRef,config.vaultRef) || !eq(accountingAddress,reader.addresses.accounting)) throw new Error('Vault deployment binding mismatch');
    await reader.assertCanonical();
    return reader;
  }
  private async assertCanonical(): Promise<void> {
    if ((await this.rpc.getNetwork()).chainId!==this.config.chainId) throw new Error('Vault RPC chain mismatch');
    if (await this.rpc.getBlockNumber()<this.height+this.config.confirmations) throw new Error('Vault confirmation depth lost');
    const block=await this.rpc.getBlock(this.height);
    if (!block?.hash || !eq(block.hash,this.blockHash)) throw new Error('Vault pinned block reorganized');
  }
  async escrow(jobId: Hex32): Promise<VaultEscrowSnapshot420> {
    id(jobId); await this.assertCanonical();
    const e=await this.escrowContract().escrows(jobId,{blockTag:this.height});
    const state=ESCROW_STATES[Number(e.state)];
    if (!state) throw new Error('unknown Vault escrow state');
    const snapshot: VaultEscrowSnapshot420={jobId,payer:e.payer,beneficiary:e.beneficiary,providerId:e.providerId,vaultRef:e.vaultRef,fundingRef:e.fundingRef,settlementRef:e.settlementRef,amount420:e.amount,state};
    await this.assertCanonical();
    return snapshot;
  }
  private escrowContract(): Contract { return this.escrow; }
  async obligation(obligationId: Hex32): Promise<VaultObligationSnapshot420> {
    id(obligationId); await this.assertCanonical();
    const o=await this.accounting.getObligation(obligationId,{blockTag:this.height});
    const state=OBLIGATION_STATES[Number(o.state)];
    if (!o.exists || !state || !eq(o.vaultId,this.config.vaultRef)) throw new Error('Vault obligation missing or bound to a different vault');
    const snapshot: VaultObligationSnapshot420={obligationId,vaultRef:o.vaultId,sourceRef:o.sourceRef,asset:o.asset,beneficiary:o.beneficiary,amount420:o.amount,state};
    await this.assertCanonical();
    return snapshot;
  }
  async payout(operationId: Hex32): Promise<CanonicalVaultOperation420 | null> {
    id(operationId); await this.assertCanonical();
    const logs=await this.rpc.getLogs({address:this.addresses.vault,topics:[WITHDRAWAL.topicHash,operationId],fromBlock:this.config.fromBlock,toBlock:this.height});
    if (logs.length===0) { await this.assertCanonical(); return null; }
    if (logs.length!==1) throw new Error('ambiguous Vault payout operation');
    const log=logs[0];
    const receipt=await this.rpc.getTransactionReceipt(log.transactionHash);
    if (!receipt || receipt.status!==1 || receipt.blockNumber>this.height || receipt.blockNumber!==log.blockNumber || !eq(receipt.blockHash,log.blockHash)) throw new Error('Vault payout transaction not canonically confirmed');
    const canonicalBlock=await this.rpc.getBlock(receipt.blockNumber);
    if (!canonicalBlock?.hash || !eq(canonicalBlock.hash,receipt.blockHash)) throw new Error('Vault payout receipt reorganized');
    const withdrawals=receipt.logs.filter(l=>eq(l.address,this.addresses.vault) && eq(l.topics[0]??'',WITHDRAWAL.topicHash) && eq(l.topics[1]??'',operationId));
    const claims=receipt.logs.filter(l=>eq(l.address,this.addresses.accounting) && eq(l.topics[0]??'',CLAIMED.topicHash));
    if (withdrawals.length!==1 || claims.length!==1) throw new Error('Vault payout missing unique matching claim/withdrawal pair');
    const withdrawal=new Interface(VAULT_ABI).parseLog(withdrawals[0]);
    const claim=new Interface(ACCOUNTING_ABI).parseLog(claims[0]);
    if (!withdrawal || !claim || withdrawal.name!=='Withdrawal' || claim.name!=='ObligationClaimed' || withdrawal.args.amount!==claim.args.amount || withdrawal.args.amount<=0n) throw new Error('Vault payout events disagree');
    const obligationId=id(claim.args.obligationId);
    const o=await this.obligation(obligationId);
    if (o.state!=='CLAIMED' || !eq(o.asset,withdrawal.args.asset) || !eq(o.beneficiary,withdrawal.args.recipient) || o.amount420!==withdrawal.args.amount || !(await this.vault.executedOperation(operationId,{blockTag:this.height}))) throw new Error('Vault payout does not match claimed obligation');
    await this.assertCanonical();
    return {operationId,vaultRef:this.config.vaultRef,obligationId,asset:o.asset,recipient:o.beneficiary,amount420:o.amount420,txHash:receipt.hash as Hex32,canonical:true,withdrawalAndClaimProven:true};
  }
}
