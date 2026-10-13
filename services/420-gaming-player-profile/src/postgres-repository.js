import { createHash } from 'node:crypto';
import { migrationDigest } from './schema-migrations.js';
import { walletSchemaDigest } from './wallet-link-migrations.js';

export class DatastoreError extends Error {
  constructor(code) { super(code); this.name = 'DatastoreError'; this.code = code; }
}
const fail = code => { throw new DatastoreError(code); };
const opaque = x => typeof x === 'string' && /^[A-Za-z0-9:_-]{1,128}$/.test(x);
const hash = x => typeof x === 'string' && /^0x[0-9a-f]{64}$/.test(x) && !/^0x0+$/.test(x);
const wallet = x => typeof x === 'string' && /^0x[0-9a-f]{40}$/.test(x) && !/^0x0+$/.test(x);
export function decimal(value, bits = 64, positive = false) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)
    || value.length > 20 || BigInt(value) >= 2n ** BigInt(bits)
    || (positive && value === '0')) fail('invalid-input');
  return value;
}
function fields(value, required) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(k => !required.includes(k))
    || required.some(k => !Object.hasOwn(value, k))) fail('invalid-input');
}
function requireOpaque(...values) { if (!values.every(opaque)) fail('invalid-input'); }
function requireHashes(...values) { if (!values.every(hash)) fail('invalid-input'); }
const digest = values => '0x' + createHash('sha256').update(JSON.stringify(values)).digest('hex');
// Private storage integrity digests. Never substitutes for canonical keccak/ABI commitments or wallet signatures.
export const saveScopeDigest = (accountId, gameId, rulesetId) => {
  requireOpaque(accountId); requireHashes(gameId, rulesetId);
  return digest(['420.GAMING.SAVE_SCOPE.V1', accountId, gameId, rulesetId]);
};
const migrationFields = ['migrationId','consentId','sourceCommitment','sourceRevision','payloadHash',
  'policyHash','rulesetId','claimSchemaVersion','chainId','registry','targetWallet','targetGrower'];
function validateMigration(x) {
  fields(x, migrationFields); requireOpaque(x.migrationId, x.consentId);
  requireHashes(x.sourceCommitment, x.payloadHash, x.policyHash, x.rulesetId);
  decimal(x.sourceRevision); decimal(x.claimSchemaVersion, 32, true);
  decimal(x.chainId, 64, true); decimal(x.targetGrower, 64, true);
  if (!wallet(x.registry) || !wallet(x.targetWallet)) fail('invalid-input');
}
export const migrationIntentDigest = (accountId, gameId, x) => {
  requireOpaque(accountId); requireHashes(gameId); validateMigration(x);
  // ID and nonce/consent do not permit an alternate economic request for the same source revision.
  return digest(['420.GAMING.MIGRATION_INTENT.V1', accountId, gameId,
    ...migrationFields.filter(k => !['migrationId','consentId'].includes(k)).map(k => x[k])]);
};
const normalize = error => {
  if (error instanceof DatastoreError) return error;
  if (['40001','40P01','55P03'].includes(error?.code)) return new DatastoreError('retry-required');
  if (['23505','23503','23514','22003'].includes(error?.code)) return new DatastoreError('conflict-or-invalid-record');
  if (error?.code === '42501') return new DatastoreError('scope-denied');
  return new DatastoreError('storage-unavailable');
};
class ScopedTransaction {
  #client; #scope; #open = true;
  constructor(client, scope) { this.#client = client; this.#scope = scope; }
  close() { this.#open = false; }
  async #query(sql, values = []) {
    if (!this.#open) fail('transaction-closed');
    return this.#client.query(sql, values);
  }
  #ids() { return [this.#scope.accountId, this.#scope.gameId]; }
  async account() {
    return (await this.#query('SELECT account_id,issuer_ref,auth_epoch,status,created_at FROM gaming_datastore.accounts WHERE account_id=$1',
      [this.#scope.accountId])).rows[0] ?? null;
  }
  async profile() {
    return (await this.#query('SELECT * FROM gaming_datastore.game_profiles WHERE account_id=$1 AND game_id=$2', this.#ids())).rows[0] ?? null;
  }
  async createProfile(x) {
    fields(x, ['profileId','rulesetId']); requireOpaque(x.profileId); requireHashes(x.rulesetId);
    const row = (await this.#query(`INSERT INTO gaming_datastore.game_profiles(account_id,game_id,profile_id,ruleset_id)
      VALUES($1,$2,$3,$4) ON CONFLICT(account_id,game_id) DO NOTHING RETURNING *`, [...this.#ids(),x.profileId,x.rulesetId])).rows[0];
    if (row) return row;
    const prior = await this.profile();
    if (!prior || prior.profile_id !== x.profileId || prior.ruleset_id !== x.rulesetId) fail('profile-conflict');
    return prior;
  }
  async recordConsent(x) {
    fields(x, ['consentId','purpose','policyHash','contextHash','nonceCommitment','expiresAt']);
    requireOpaque(x.consentId); requireHashes(x.policyHash,x.contextHash,x.nonceCommitment); decimal(x.expiresAt);
    if (!['CLOUD_SAVE','WALLET_LINK','SAVE_MIGRATION','OBJECT_CANONICALIZATION'].includes(x.purpose)) fail('invalid-input');
    const row = (await this.#query(`INSERT INTO gaming_datastore.consents
      (account_id,game_id,consent_id,purpose,policy_hash,context_hash,nonce_commitment,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(account_id,game_id,consent_id) DO NOTHING RETURNING *`,
      [...this.#ids(),x.consentId,x.purpose,x.policyHash,x.contextHash,x.nonceCommitment,x.expiresAt])).rows[0];
    if (row) return row;
    const prior = await this.consent(x.consentId);
    if (!prior || prior.purpose !== x.purpose || prior.policy_hash !== x.policyHash || prior.context_hash !== x.contextHash
      || prior.nonce_commitment !== x.nonceCommitment || prior.expires_at !== x.expiresAt) fail('consent-conflict');
    return prior;
  }
  async consent(id) {
    requireOpaque(id);
    return (await this.#query('SELECT * FROM gaming_datastore.consents WHERE account_id=$1 AND game_id=$2 AND consent_id=$3',
      [...this.#ids(),id])).rows[0] ?? null;
  }
  async revokeConsent(id) {
    requireOpaque(id);
    const row = (await this.#query(`UPDATE gaming_datastore.consents SET revoked_at=gaming_datastore.now_seconds()
      WHERE account_id=$1 AND game_id=$2 AND consent_id=$3 AND revoked_at IS NULL RETURNING *`, [...this.#ids(),id])).rows[0];
    return row ?? await this.consent(id);
  }
  async #activeConsent(id, purpose, context) {
    const c = (await this.#query(`SELECT * FROM gaming_datastore.consents
      WHERE account_id=$1 AND game_id=$2 AND consent_id=$3 AND purpose=$4 AND context_hash=$5
      AND revoked_at IS NULL AND expires_at>gaming_datastore.now_seconds() FOR SHARE`, [...this.#ids(),id,purpose,context])).rows[0];
    if (!c) fail('consent-denied');
    return c;
  }
  async publishSaveReference(x) {
    fields(x, ['expectedRevision','schemaLabel','rulesetId','stateHash','providerId','objectRef','byteLength','consentId']);
    decimal(x.expectedRevision); decimal(x.byteLength);
    requireOpaque(x.schemaLabel,x.providerId,x.objectRef,x.consentId); requireHashes(x.rulesetId,x.stateHash);
    if (BigInt(x.byteLength)>67108864n || x.expectedRevision==='18446744073709551615') fail('invalid-input');
    const p = (await this.#query('SELECT * FROM gaming_datastore.game_profiles WHERE account_id=$1 AND game_id=$2 FOR UPDATE',this.#ids())).rows[0];
    if (!p || p.ruleset_id !== x.rulesetId || (p.save_revision ?? '0') !== x.expectedRevision) fail('revision-conflict');
    await this.#activeConsent(x.consentId,'CLOUD_SAVE',saveScopeDigest(...this.#ids(),x.rulesetId));
    const revision = String(BigInt(x.expectedRevision)+1n);
    const row = (await this.#query(`INSERT INTO gaming_datastore.save_references
      (account_id,game_id,revision,schema_label,ruleset_id,state_hash,provider_id,object_ref,byte_length,consent_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [...this.#ids(),revision,x.schemaLabel,x.rulesetId,x.stateHash,x.providerId,x.objectRef,x.byteLength,x.consentId])).rows[0];
    await this.#query(`UPDATE gaming_datastore.game_profiles SET save_revision=$3,version=version+1,
      updated_at=gaming_datastore.now_seconds() WHERE account_id=$1 AND game_id=$2`, [...this.#ids(),revision]);
    return row;
  }
  async saveReference(revision = null) {
    if (revision !== null) decimal(revision,64,true);
    return (await this.#query(`SELECT r.* FROM gaming_datastore.save_references r
      JOIN gaming_datastore.game_profiles p USING(account_id,game_id)
      WHERE r.account_id=$1 AND r.game_id=$2 AND r.revision=coalesce($3::numeric,p.save_revision)`,
      [...this.#ids(),revision])).rows[0] ?? null;
  }
  async prepareMigration(x) {
    validateMigration(x); const context = migrationIntentDigest(...this.#ids(),x);
    const profile = await this.profile();
    if (!profile || profile.ruleset_id !== x.rulesetId) fail('migration-conflict');
    const prior = (await this.#query(`SELECT * FROM gaming_datastore.migration_records
      WHERE account_id=$1 AND game_id=$2 AND source_commitment=$3 AND source_revision=$4 FOR UPDATE`,
      [...this.#ids(),x.sourceCommitment,x.sourceRevision])).rows[0];
    if (prior) {
      if (prior.request_digest !== context) fail('migration-conflict');
      return prior; // Durable retry, including cancelled history; never reactivate it.
    }
    const c = await this.#activeConsent(x.consentId,'SAVE_MIGRATION',context);
    if (c.policy_hash !== x.policyHash) fail('consent-denied');
    return (await this.#query(`INSERT INTO gaming_datastore.migration_records
      (account_id,game_id,migration_id,source_commitment,source_revision,payload_hash,policy_hash,ruleset_id,
       claim_schema_version,chain_id,registry,target_wallet,target_grower,consent_id,request_digest)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [...this.#ids(),x.migrationId,x.sourceCommitment,x.sourceRevision,x.payloadHash,x.policyHash,x.rulesetId,
        x.claimSchemaVersion,x.chainId,x.registry,x.targetWallet,x.targetGrower,x.consentId,context])).rows[0];
  }
  async migration(id) {
    requireOpaque(id);
    return (await this.#query('SELECT * FROM gaming_datastore.migration_records WHERE account_id=$1 AND game_id=$2 AND migration_id=$3',
      [...this.#ids(),id])).rows[0] ?? null;
  }

  async #walletGuard() {
    const v=(await this.#query('SELECT version,digest FROM gaming_datastore.wallet_link_schema')).rows;
    if(v.length!==1||v[0].version!==2||v[0].digest!==walletSchemaDigest)fail('wallet-schema-drift');
    const t=(await this.#query(`SELECT c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='gaming_datastore' AND c.relname=ANY($1::text[])`,
      [['wallet_challenges','wallet_links']])).rows;
    if(t.length!==2||t.some(x=>!x.relrowsecurity||!x.relforcerowsecurity||x.owner!=='gaming_datastore_migrator'))
      fail('unsafe-wallet-policy');
  }
  async issueWalletChallenge(x) {
    await this.#walletGuard();
    fields(x,['challengeId','wallet','chainId','domain','nonce','consentId','policyHash','contextHash','issuedAt','expiresAt']);
    requireOpaque(x.challengeId,x.domain,x.consentId);
    requireHashes(x.policyHash,x.contextHash);
    decimal(x.chainId,64,true);decimal(x.issuedAt);decimal(x.expiresAt);
    if(!wallet(x.wallet)||!/^([0-9a-f]{64})$/.test(x.nonce))fail('invalid-input');
    const now=(await this.#query('SELECT gaming_datastore.now_seconds() AS now')).rows[0].now;
    if(BigInt(x.issuedAt)>BigInt(now)+5n||BigInt(x.issuedAt)+5n<BigInt(now)||BigInt(x.expiresAt)<=BigInt(now)||BigInt(x.expiresAt)>BigInt(x.issuedAt)+600n)fail('challenge-expiry-invalid');
    const profile=await this.profile();
    if(!profile)fail('profile-not-found');
    const nonceCommitment='0x'+createHash('sha256').update(x.nonce,'utf8').digest('hex');
    await this.recordConsent({consentId:x.consentId,purpose:'WALLET_LINK',policyHash:x.policyHash,
      contextHash:x.contextHash,nonceCommitment,expiresAt:x.expiresAt});
    return (await this.#query(`INSERT INTO gaming_datastore.wallet_challenges
      (account_id,game_id,challenge_id,wallet,chain_id,domain,nonce,consent_id,issued_at,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING challenge_id,wallet,chain_id,domain,nonce,issued_at,expires_at`,
      [...this.#ids(),x.challengeId,x.wallet,x.chainId,x.domain,x.nonce,x.consentId,x.issuedAt,x.expiresAt])).rows[0];
  }
  async walletChallenge(challengeId) {
    await this.#walletGuard();
    requireOpaque(challengeId);
    return (await this.#query(`SELECT challenge_id,wallet,chain_id,domain,nonce,issued_at,expires_at,used_at,consent_id
      FROM gaming_datastore.wallet_challenges WHERE account_id=$1 AND game_id=$2 AND challenge_id=$3`,
      [...this.#ids(),challengeId])).rows[0]??null;
  }
  async completeWalletChallenge(challengeId,contextHash,expected) {
    await this.#walletGuard();
    requireOpaque(challengeId);requireHashes(contextHash);
    const challenge=(await this.#query(`SELECT * FROM gaming_datastore.wallet_challenges
      WHERE account_id=$1 AND game_id=$2 AND challenge_id=$3 FOR UPDATE`,[...this.#ids(),challengeId])).rows[0];
    if(!challenge||challenge.used_at!==null||BigInt(challenge.expires_at)<=
      BigInt((await this.#query('SELECT gaming_datastore.now_seconds() AS now')).rows[0].now))
      fail('challenge-invalid-or-replayed');
    if(challenge.wallet!==expected.wallet||challenge.domain!==expected.domain||
      challenge.chain_id!==expected.chainId||challenge.nonce!==expected.nonce||
      challenge.issued_at!==expected.issuedAt||challenge.expires_at!==expected.expiresAt)
      fail('challenge-changed');
    await this.#activeConsent(challenge.consent_id,'WALLET_LINK',contextHash);
    const active=(await this.#query(`SELECT 1 FROM gaming_datastore.wallet_links
      WHERE account_id=$1 AND game_id=$2 AND unlinked_at IS NULL FOR UPDATE`,this.#ids())).rows;
    if(active.length)fail('wallet-link-conflict');
    await this.#query(`UPDATE gaming_datastore.wallet_challenges SET used_at=gaming_datastore.now_seconds()
      WHERE account_id=$1 AND game_id=$2 AND challenge_id=$3`,[...this.#ids(),challengeId]);
    const row=(await this.#query(`INSERT INTO gaming_datastore.wallet_links
      (account_id,game_id,chain_id,wallet,challenge_id,linked_at)
      VALUES($1,$2,$3,$4,$5,gaming_datastore.now_seconds())
      RETURNING chain_id,wallet,linked_at`,[...this.#ids(),challenge.chain_id,challenge.wallet,challengeId])).rows[0];
    return row;
  }
  async unlinkWallet() {
    await this.#walletGuard();
    const rows=(await this.#query(`UPDATE gaming_datastore.wallet_links
      SET unlinked_at=gaming_datastore.now_seconds()
      WHERE account_id=$1 AND game_id=$2 AND unlinked_at IS NULL
      RETURNING chain_id,wallet,unlinked_at`,this.#ids())).rows;
    return rows[0]??null;
  }
  async activeWallet() {
    await this.#walletGuard();
    return (await this.#query(`SELECT chain_id,wallet,linked_at FROM gaming_datastore.wallet_links
      WHERE account_id=$1 AND game_id=$2 AND unlinked_at IS NULL`,this.#ids())).rows[0]??null;
  }

  async cancelMigration(id) {
    requireOpaque(id);
    const row = (await this.#query(`UPDATE gaming_datastore.migration_records SET status='CANCELLED',
      cancelled_at=gaming_datastore.now_seconds() WHERE account_id=$1 AND game_id=$2 AND migration_id=$3
      AND status='PREPARED' RETURNING *`, [...this.#ids(),id])).rows[0];
    return row ?? await this.migration(id);
  }
}

export class PostgresGamingRepository420 {
  #pool; #scope;
  constructor({ pool, accountId, gameId, expectedEpoch, expectedIssuerRef }) {
    if (typeof pool?.connect !== 'function') fail('invalid-configuration');
    requireOpaque(accountId,expectedIssuerRef); requireHashes(gameId); decimal(expectedEpoch);
    this.#pool=pool; this.#scope=Object.freeze({ accountId,gameId,expectedEpoch,expectedIssuerRef });
  }
  async transaction(callback) {
    if (typeof callback !== 'function') fail('invalid-input');
    let client,tx;
    try {
      client=await this.#pool.connect();
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      await client.query("SET LOCAL statement_timeout='10s'");
      await client.query("SET LOCAL lock_timeout='3s'");
      const principal=(await client.query(`SELECT s.account_id,s.game_id,r.rolsuper,r.rolbypassrls,
        pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS migrator,
        pg_has_role(current_user,'gaming_datastore_runtime','MEMBER') AS runtime
        FROM gaming_datastore.runtime_scopes s JOIN pg_roles r ON r.rolname=current_user WHERE s.role_name=current_user`)).rows[0];
      if (!principal || principal.rolsuper || principal.rolbypassrls || principal.migrator || !principal.runtime
        || principal.account_id!==this.#scope.accountId || principal.game_id!==this.#scope.gameId) fail('scope-denied');
      const extra=(await client.query(`SELECT 1 FROM pg_roles WHERE rolname NOT IN (current_user,'gaming_datastore_runtime')
        AND pg_has_role(current_user,oid,'MEMBER') LIMIT 1`)).rows;
      if(extra.length)fail('scope-denied');
      const schema=(await client.query('SELECT version,digest FROM gaming_datastore.schema_migrations ORDER BY version')).rows;
      if (schema.length!==1 || schema[0].version!==1 || schema[0].digest!==migrationDigest) fail('schema-mismatch');
      const tables=(await client.query(`SELECT c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='gaming_datastore' AND c.relname=ANY($1::text[])`,
        [['accounts','runtime_scopes','game_profiles','save_schemas','consents','save_references','migration_records']])).rows;
      if (tables.length!==7 || tables.some(t=>!t.relrowsecurity || !t.relforcerowsecurity || t.owner!=='gaming_datastore_migrator')) fail('unsafe-database-policy');
      const a=(await client.query('SELECT status,auth_epoch,issuer_ref FROM gaming_datastore.accounts WHERE account_id=$1 FOR SHARE',
        [this.#scope.accountId])).rows[0];
      if (!a || a.status!=='ACTIVE' || a.auth_epoch!==this.#scope.expectedEpoch
        || a.issuer_ref!==this.#scope.expectedIssuerRef) fail('account-revoked');
      tx=new ScopedTransaction(client,this.#scope);
      const result=await callback(tx);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      if (client) { try { await client.query('ROLLBACK'); } catch { /* Original error remains sanitized. */ } }
      throw normalize(e);
    } finally { tx?.close(); client?.release(); }
  }
}

export async function createPostgresGamingPlayerProfileService420({ authority, token, poolForPrincipal }) {
  if (typeof authority?.registeredPrincipal!=='function' || typeof authority?.verifyToken!=='function'
    || typeof poolForPrincipal!=='function') fail('invalid-configuration');
  const claims=authority.verifyToken(token);
  const accountId=await authority.registeredPrincipal(token);
  if (accountId!==claims.sub || claims.game!==authority.gameId || !Number.isSafeInteger(claims.epoch) || claims.epoch<0) fail('scope-denied');
  const pool=await poolForPrincipal(Object.freeze({ accountId,gameId:authority.gameId }));
  const repository=new PostgresGamingRepository420({ pool,accountId,gameId:authority.gameId,
    expectedEpoch:String(claims.epoch),expectedIssuerRef:claims.iss });
  // Reauthenticate every operation, including already-open connections after revocation/expiry.
  return Object.freeze({ transaction: async callback => {
    const c=authority.verifyToken(token),p=await authority.registeredPrincipal(token);
    if (p!==accountId || c.sub!==accountId || c.game!==authority.gameId || c.epoch!==claims.epoch) fail('scope-denied');
    return repository.transaction(async transaction => {
      const result=await callback(transaction);
      const current=authority.verifyToken(token),principal=await authority.registeredPrincipal(token);
      if (principal!==accountId || current.sub!==accountId || current.game!==authority.gameId
        || current.epoch!==claims.epoch) fail('scope-denied');
      return result;
    });
  } });
}
