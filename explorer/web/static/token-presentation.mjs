const address=v=>typeof v==='string'&&/^0x[0-9a-f]{40}$/.test(v)&&BigInt(v)!==0n;
const hash=v=>typeof v==='string'&&/^0x[0-9a-f]{64}$/.test(v);
const decimal=v=>typeof v==='string'&&/^(0|[1-9][0-9]*)$/.test(v);
export function tokenPresentation420(p,requested){
 if(!p||p.authoritative!==false||p.evidenceKind!=='factory-creation-and-fee-events'||p.token!==requested.toLowerCase()||![p.token,p.creator,p.factory,p.vault,p.accounting].every(address)||![p.configHash,p.blockHash,p.snapshotHash,p.transactionHash,p.genesisHash,p.templateId].every(hash)||![p.chainId,p.blockNumber,p.snapshotHeight].every(decimal)||BigInt(p.chainId)===0n||BigInt(p.blockNumber)>BigInt(p.snapshotHeight)||p.templateVersion!==1||!/^ERC(?:20_(?:FIXED|MINTABLE|CAPPED|BURNABLE|PERMIT|VOTES)|721_COLLECTION|1155_MULTI)$/.test(p.template)||p.creationFeeWei!=='42000000000000000000'||![p.transactionIndex,p.logIndex,p.accountingLogIndex,p.vaultLogIndex,p.feeLogIndex].every(n=>Number.isSafeInteger(n)&&n>=0)||!(p.logIndex<p.accountingLogIndex&&p.accountingLogIndex<p.vaultLogIndex&&p.vaultLogIndex<p.feeLogIndex))throw new Error('Invalid Token deployment evidence');
 return {data:p,transactionPath:'#/transactions/'+p.transactionHash,blockPath:'#/blocks/'+p.blockNumber,warning:'Historical factory creation and fee events only. Not current ownership, audit, endorsement, listing, liquidity, or investment approval.'};
}
