// Read-only Indexer DTOs. These are never evidence of spend authorization or Vault settlement.
export interface TreasuryProjectionProvenance420 {
  chainId: string;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  authoritative: false;
}
export interface TreasuryAssetPolicyProjection420 extends TreasuryProjectionProvenance420 {
  asset:string; allowed:boolean; maxSingleDisbursement:string; maxEpochDisbursement:string; epochSeconds:string; revision:string;
}
export interface TreasuryBudgetProjection420 extends TreasuryProjectionProvenance420 {
  budgetId:string; vaultId:string; category:string; asset:string; ceiling:string; committed:string; executed:string;
  validFrom:string; validUntil:string; civicActionHash:string; metadataHash:string;
}
export interface TreasuryDisbursementProjection420 extends TreasuryProjectionProvenance420 {
  disbursementId:string; budgetId:string; recipient:string; asset:string; amount:string; notBefore:string; expiresAt:string;
  civicActionHash:string; purposeHash:string; state:'SCHEDULED'|'EXECUTED'|'CANCELLED'; vaultReleaseHash:string|null; executor:string|null;
}
export type TreasuryProjectionTransport420 = (path:string)=>Promise<unknown>;

function object420(input:unknown): Record<string,unknown> {
  if (!input || typeof input!=='object'||Array.isArray(input)) throw new Error('invalid Treasury projection');
  return input as Record<string,unknown>;
}
function hex420(v:unknown,n:number): v is string {return typeof v==='string' && v.length===2+n*2 && /^0x[0-9a-fA-F]+$/.test(v);}
function uint420(v:unknown,bits:number):bigint {
  if(typeof v!=='string'||! /^(0|[1-9][0-9]*)$/.test(v)||v.length>78||BigInt(v)>=(1n<<BigInt(bits)))throw new Error('invalid Treasury projection integer');
  return BigInt(v);
}
function require420(condition:unknown):asserts condition {if(!condition)throw new Error('invalid derived Treasury projection');}
function coords420(d:Record<string,unknown>,chainId:bigint){
  require420(d.chainId===chainId.toString()&&d.authoritative===false&&hex420(d.blockHash,32)&&hex420(d.transactionHash,32));
  uint420(d.blockNumber,256);
  for (const k of ['transactionIndex','logIndex']) require420(typeof d[k]==='number'&&Number.isSafeInteger(d[k])&&Number(d[k])>=0);
}
export function createTreasuryProjectionClient420(chainId:bigint,read:TreasuryProjectionTransport420){
  require420(chainId>0n);
  async function get(kind:string,id:string){
    require420(hex420(id,kind==='asset-policies'?20:32));
    const env=object420(await read('/v1/treasury/'+kind+'/'+id.toLowerCase()+'?chainId='+chainId));
    require420(env.apiVersion==='v1'&&!env.error);
    const d=object420(env.data);
    coords420(d,chainId);
    require420(hex420(d.asset,20));
    const field=kind==='budgets'?'budgetId':kind==='disbursements'?'disbursementId':'asset';
    require420(typeof d[field]==='string'&&String(d[field]).toLowerCase()===id.toLowerCase());
    return d;
  }
  return {
    async assetPolicy(asset:string):Promise<TreasuryAssetPolicyProjection420>{
      const d=await get('asset-policies',asset);
      const a=uint420(d.maxSingleDisbursement,128),b=uint420(d.maxEpochDisbursement,128);
      require420(typeof d.allowed==='boolean'&&a>0n&&b>=a&&uint420(d.epochSeconds,64)>0n&&uint420(d.revision,32)>0n);
      return d as unknown as TreasuryAssetPolicyProjection420;
    },
    async budget(id:string):Promise<TreasuryBudgetProjection420>{
      const d=await get('budgets',id);
      const c=uint420(d.ceiling,128),m=uint420(d.committed,128),e=uint420(d.executed,128);
      require420(c>0n&&e<=m&&m<=c&&uint420(d.validUntil,64)>uint420(d.validFrom,64));
      for(const k of ['vaultId','category','civicActionHash','metadataHash'])require420(hex420(d[k],32));
      return d as unknown as TreasuryBudgetProjection420;
    },
    async disbursement(id:string):Promise<TreasuryDisbursementProjection420>{
      const d=await get('disbursements',id);
      require420(hex420(d.budgetId,32)&&hex420(d.recipient,20)&&hex420(d.civicActionHash,32)&&hex420(d.purposeHash,32)&&uint420(d.amount,128)>0n&&uint420(d.expiresAt,64)>uint420(d.notBefore,64));
      if(d.state==='EXECUTED')require420(hex420(d.vaultReleaseHash,32)&&!/^0x0{64}$/.test(d.vaultReleaseHash)&&hex420(d.executor,20)&&!/^0x0{40}$/.test(d.executor));
      else require420((d.state==='SCHEDULED'||d.state==='CANCELLED')&&d.vaultReleaseHash===null&&d.executor===null);
      return d as unknown as TreasuryDisbursementProjection420;
    }
  };
}
