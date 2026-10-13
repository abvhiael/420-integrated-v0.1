import { randomUUID } from 'node:crypto';
import { migrationRuntimeDigest } from './migration-runtime-migrations.js';
const error=code=>{const e=new Error(code);e.code=code;throw e;};
const opaque=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const hash=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x)&&!/^0x0+$/.test(x);
const wallet=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/.test(x)&&!/^0x0+$/.test(x);
const uint=(x,bits=64)=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&
  BigInt(x)<(1n<<BigInt(bits));
function exact(x,names){
  if(!x||typeof x!=='object'||Array.isArray(x)||
    Object.keys(x).length!==names.length||names.some(n=>!Object.hasOwn(x,n)))error('invalid-input');
}
const locator=x=>{
  exact(x,['accountId','gameId','migrationId','claimId']);
  if(!opaque(x.accountId)||!hash(x.gameId)||!opaque(x.migrationId)||!uint(x.claimId)||x.claimId==='0')error('invalid-input');
  return x;
};
const normalize=e=>{
  if(e?.code&&typeof e.code==='string'&&e.code.startsWith('migration-'))return e;
  if(['40001','40P01','55P03'].includes(e?.code))return Object.assign(new Error('migration-retry'),{code:'migration-retry'});
  if(['23505','23503','23514','42501','22003'].includes(e?.code))
    return Object.assign(new Error('migration-conflict'),{code:'migration-conflict'});
  return Object.assign(new Error('migration-storage-unavailable'),{code:'migration-storage-unavailable'});
};
const now='gaming_datastore.now_seconds()';
export class DurableMigrationCoordinator420 {
  #pool; #binding; #receipt;
  constructor({operatorPool,verifyBoundClaim,verifyReceipt}={}){
    if(typeof operatorPool?.connect!=='function'||typeof verifyBoundClaim!=='function'||typeof verifyReceipt!=='function')
      error('migration-invalid-configuration');
    this.#pool=operatorPool;this.#binding=verifyBoundClaim;this.#receipt=verifyReceipt;
  }
  async #transaction(callback){
    let c;
    try{
      c=await this.#pool.connect();
      await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      await c.query("SET LOCAL statement_timeout='10s'");
      await c.query("SET LOCAL lock_timeout='3s'");
      const role=(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS allowed")).rows[0];
      if(!role?.allowed)error('migration-operator-denied');
      await c.query('SET LOCAL ROLE gaming_datastore_migrator');
      const state=(await c.query('SELECT version,digest FROM gaming_datastore.migration_application_schema')).rows;
      if(state.length!==1||state[0].version!==3||state[0].digest!==migrationRuntimeDigest)error('migration-schema-drift');
      const policy=(await c.query(`SELECT c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='gaming_datastore'
        AND c.relname=ANY($1::text[])`,
        [['migration_applications','migration_outbox','migration_receipt_history']])).rows;
      if(policy.length!==3||policy.some(p=>!p.relrowsecurity||!p.relforcerowsecurity||p.owner!=='gaming_datastore_migrator'))
        error('migration-unsafe-policy');
      const result=await callback(c);
      await c.query('COMMIT');return result;
    }catch(e){
      if(c)try{await c.query('ROLLBACK');}catch{}
      throw normalize(e);
    }finally{c?.release();}
  }
  // Operator input supplies only identifiers. The trusted canonical verifier supplies the
  // immutable payload, source proof, destination save and finality decision.
  async apply(input){
    locator(input);
    let v;
    try{v=await this.#binding(Object.freeze({...input}));}catch{error('migration-binding-unavailable');}
    const required=['accountId','gameId','migrationId','claimId','chainId','registry',
      'sourceCommitment','sourceRevision','payloadHash','rulesetId','policyHash',
      'targetWallet','targetGrower','evidenceDigest','save','saveConsentId'];
    exact(v,required);
    const saveNames=['schemaLabel','stateHash','providerId','objectRef','byteLength'];
    exact(v.save,saveNames);
    if(v.accountId!==input.accountId||v.gameId!==input.gameId||v.migrationId!==input.migrationId||
      v.claimId!==input.claimId||!uint(v.chainId)||v.chainId==='0'||!wallet(v.registry)||
      !hash(v.sourceCommitment)||!uint(v.sourceRevision)||!hash(v.payloadHash)||!hash(v.rulesetId)||
      !hash(v.policyHash)||!wallet(v.targetWallet)||!uint(v.targetGrower)||v.targetGrower==='0'||
      !hash(v.evidenceDigest)||!opaque(v.saveConsentId)||!opaque(v.save.schemaLabel)||
      !hash(v.save.stateHash)||!opaque(v.save.providerId)||!opaque(v.save.objectRef)||
      !uint(v.save.byteLength)||BigInt(v.save.byteLength)>67108864n)
      error('migration-invalid-proof');
    // The verifier's contract is to prove actual canonical consumption, binding and finality.
    // Neither a caller-supplied finalized:true nor an indexer projection qualifies.
    return this.#transaction(async c=>{
      const args=[v.accountId,v.gameId,v.migrationId];
      const m=(await c.query(`SELECT * FROM gaming_datastore.migration_records
        WHERE account_id=$1 AND game_id=$2 AND migration_id=$3 FOR UPDATE`,args)).rows[0];
      if(!m||m.status!=='PREPARED'||m.chain_id!==v.chainId||m.registry!==v.registry||
        m.source_commitment!==v.sourceCommitment||m.source_revision!==v.sourceRevision||
        m.payload_hash!==v.payloadHash||m.policy_hash!==v.policyHash||m.ruleset_id!==v.rulesetId||
        m.target_wallet!==v.targetWallet||m.target_grower!==v.targetGrower)
        error('migration-intent-mismatch');
      const prior=(await c.query(`SELECT * FROM gaming_datastore.migration_applications
        WHERE account_id=$1 AND game_id=$2 AND migration_id=$3`,args)).rows[0];
      if(prior){
        if(prior.claim_id!==v.claimId||prior.evidence_digest!==v.evidenceDigest||
          prior.source_state_hash!==v.save.stateHash)error('migration-conflict');
        return {migrationId:v.migrationId,revision:prior.destination_revision,duplicate:true};
      }
      const account=(await c.query(`SELECT * FROM gaming_datastore.accounts
        WHERE account_id=$1 FOR SHARE`,[v.accountId])).rows[0];
      if(!account||account.status!=='ACTIVE')error('migration-account-revoked');
      const consent=(await c.query(`SELECT * FROM gaming_datastore.consents WHERE
        account_id=$1 AND game_id=$2 AND consent_id=$3 FOR SHARE`,
        [...args.slice(0,2),m.consent_id])).rows[0];
      if(!consent||consent.revoked_at!==null||BigInt(consent.expires_at)<=
        BigInt((await c.query('SELECT gaming_datastore.now_seconds() AS n')).rows[0].n)||
        consent.purpose!=='SAVE_MIGRATION'||consent.context_hash!==m.request_digest||
        consent.policy_hash!==m.policy_hash)error('migration-consent-denied');
      const saveConsent=(await c.query(`SELECT * FROM gaming_datastore.consents WHERE
        account_id=$1 AND game_id=$2 AND consent_id=$3 FOR SHARE`,
        [v.accountId,v.gameId,v.saveConsentId])).rows[0];
      if(!saveConsent||saveConsent.purpose!=='CLOUD_SAVE'||saveConsent.revoked_at!==null||
        BigInt(saveConsent.expires_at)<=BigInt((await c.query('SELECT gaming_datastore.now_seconds() AS n')).rows[0].n))
        error('migration-save-consent-denied');
      const w=(await c.query(`SELECT wallet,chain_id FROM gaming_datastore.wallet_links
        WHERE account_id=$1 AND game_id=$2 AND unlinked_at IS NULL FOR SHARE`,
        [v.accountId,v.gameId])).rows[0];
      if(!w||w.wallet!==v.targetWallet||w.chain_id!==v.chainId)error('migration-wallet-revoked');
      const p=(await c.query(`SELECT * FROM gaming_datastore.game_profiles WHERE
        account_id=$1 AND game_id=$2 FOR UPDATE`,[v.accountId,v.gameId])).rows[0];
      if(!p||p.ruleset_id!==v.rulesetId||p.save_revision==='18446744073709551615')
        error('migration-profile-invalid');
      const old=BigInt(p.save_revision??'0'),revision=String(old+1n);
      const schema=(await c.query(`SELECT schema_label FROM gaming_datastore.save_schemas
        WHERE game_id=$1 AND schema_label=$2`,[v.gameId,v.save.schemaLabel])).rows[0];
      if(!schema)error('migration-save-schema-invalid');
      await c.query(`INSERT INTO gaming_datastore.save_references
        (account_id,game_id,revision,schema_label,ruleset_id,state_hash,provider_id,object_ref,byte_length,consent_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [v.accountId,v.gameId,revision,v.save.schemaLabel,v.rulesetId,v.save.stateHash,
          v.save.providerId,v.save.objectRef,v.save.byteLength,v.saveConsentId]);
      await c.query(`UPDATE gaming_datastore.game_profiles SET save_revision=$3,version=version+1,
        updated_at=gaming_datastore.now_seconds() WHERE account_id=$1 AND game_id=$2`,
        [v.accountId,v.gameId,revision]);
      await c.query(`INSERT INTO gaming_datastore.migration_applications
        (account_id,game_id,migration_id,chain_id,registry,claim_id,source_commitment,source_revision,
        payload_hash,target_wallet,target_grower,source_state_hash,destination_revision,evidence_digest)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [v.accountId,v.gameId,v.migrationId,v.chainId,v.registry,v.claimId,v.sourceCommitment,
          v.sourceRevision,v.payloadHash,v.targetWallet,v.targetGrower,v.save.stateHash,revision,v.evidenceDigest]);
      await c.query(`INSERT INTO gaming_datastore.migration_outbox(account_id,game_id,migration_id)
        VALUES($1,$2,$3)`,args);
      return {migrationId:v.migrationId,revision,duplicate:false};
    });
  }
  async lease({max=1}={}){
    if(!Number.isInteger(max)||max<1||max>20)error('migration-invalid-input');
    return this.#transaction(async c=>{
      const due=(await c.query(`SELECT o.* FROM gaming_datastore.migration_outbox o
        JOIN gaming_datastore.migration_applications a USING(account_id,game_id,migration_id)
        WHERE ((o.status IN ('PENDING','SUBMITTED') AND o.next_attempt_at<=${now}) OR
          (o.status='LEASED' AND o.lease_until<=${now}))
          AND o.attempts<12
        ORDER BY o.next_attempt_at,o.account_id,o.migration_id
        FOR UPDATE OF o SKIP LOCKED LIMIT $1`,[max])).rows;
      const rows=[];
      for(const x of due){
        const token=randomUUID();
        const updated=(await c.query(`UPDATE gaming_datastore.migration_outbox
          SET status='LEASED',attempts=attempts+1,lease_token=$4,lease_until=${now}+60,changed_at=${now}
          WHERE account_id=$1 AND game_id=$2 AND migration_id=$3
          RETURNING account_id,game_id,migration_id,attempts,lease_token,lease_until,receipt_tx,receipt_block,receipt_digest`,
          [x.account_id,x.game_id,x.migration_id,token])).rows[0];
        const app=(await c.query(`SELECT chain_id,registry,claim_id,source_commitment,source_revision,
          payload_hash,target_wallet,target_grower,evidence_digest FROM gaming_datastore.migration_applications
          WHERE account_id=$1 AND game_id=$2 AND migration_id=$3`,
          [x.account_id,x.game_id,x.migration_id])).rows[0];
        rows.push({...updated,...app});
      }
      return rows;
    });
  }
  async reconcile({accountId,gameId,migrationId,leaseToken}){
    if(!opaque(accountId)||!hash(gameId)||!opaque(migrationId)||!opaque(leaseToken))
      error('migration-invalid-input');
    const key={accountId,gameId,migrationId};
    let observed;
    try{observed=await this.#receipt(Object.freeze({...key}));}
    catch{error('migration-receipt-unavailable');}
    exact(observed,['state','txHash','blockHash','receiptDigest']);
    if(!['PENDING','FINALIZED','REORG','MISMATCH','RETRY'].includes(observed.state)||
      (observed.state!=='RETRY'&&observed.state!=='PENDING'&&
        (![observed.txHash,observed.blockHash,observed.receiptDigest].every(hash)))||
      (['RETRY','PENDING'].includes(observed.state)&&
        [observed.txHash,observed.blockHash,observed.receiptDigest].some(v=>v!==null)))
      error('migration-invalid-receipt');
    return this.#transaction(async c=>{
      const vals=[accountId,gameId,migrationId];
      const lease=(await c.query(`SELECT * FROM gaming_datastore.migration_outbox WHERE
        account_id=$1 AND game_id=$2 AND migration_id=$3 FOR UPDATE`,vals)).rows[0];
      if(!lease||lease.status!=='LEASED'||lease.lease_token!==leaseToken||
        BigInt(lease.lease_until)<=BigInt((await c.query('SELECT gaming_datastore.now_seconds() AS n')).rows[0].n))
        error('migration-lease-invalid');
      const app=(await c.query(`SELECT * FROM gaming_datastore.migration_applications
        WHERE account_id=$1 AND game_id=$2 AND migration_id=$3`,vals)).rows[0];
      if(!app)error('migration-application-missing');
      const state=observed.state==='FINALIZED'?'RECONCILED':
        observed.state==='REORG'||observed.state==='MISMATCH'?'QUARANTINED':
        observed.state==='PENDING'?'SUBMITTED':
        lease.attempts>=12?'DEAD_LETTER':'PENDING';
      const next=state==='PENDING'?
        String(BigInt(lease.attempts)*BigInt(lease.attempts)*10n):'0';
      const row=(await c.query(`UPDATE gaming_datastore.migration_outbox
        SET status=$4,lease_token=NULL,lease_until=NULL,
          next_attempt_at=${now}+$5::numeric,
          receipt_tx=coalesce($6,receipt_tx),
          receipt_block=coalesce($7,receipt_block),
          receipt_digest=coalesce($8,receipt_digest),
          changed_at=${now}
        WHERE account_id=$1 AND game_id=$2 AND migration_id=$3 RETURNING status,attempts`,
        [...vals,state,next,observed.txHash,observed.blockHash,observed.receiptDigest])).rows[0];
      const sequence=(await c.query(`SELECT coalesce(max(sequence),0)+1 AS n FROM
        gaming_datastore.migration_receipt_history WHERE account_id=$1 AND game_id=$2 AND migration_id=$3`,
        vals)).rows[0].n;
      await c.query(`INSERT INTO gaming_datastore.migration_receipt_history
        (account_id,game_id,migration_id,sequence,event,tx_hash,block_hash,receipt_digest)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [...vals,sequence,observed.state==='FINALIZED'?'FINALIZED':
          observed.state==='PENDING'?'SUBMITTED':state==='DEAD_LETTER'?'DEAD_LETTER':
          observed.state==='RETRY'?'RETRY':observed.state,
          observed.txHash,observed.blockHash,observed.receiptDigest]);
      return {migrationId,status:row.status,attempts:row.attempts};
    });
  }
}
