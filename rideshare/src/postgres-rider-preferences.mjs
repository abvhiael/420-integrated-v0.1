import { validatePreferences } from './rider-preferences.mjs';
// PostgreSQL executes UPSERT conflicts atomically; no read/then-write race.
export function createPostgresRiderPreferenceStore(pool) {
  if(!pool || typeof pool.query !== 'function')throw Error('DATABASE_UNAVAILABLE');
  return Object.freeze({
    async read(accountId) {
      const {rows} = await pool.query(
        'SELECT revision, preferences FROM liftd.rider_preferences WHERE account_id=$1',
        [accountId]);
      if(!rows.length)return null;
      const revision=Number(rows[0].revision);
      if(!Number.isSafeInteger(revision)||revision<1)throw Error('INVALID_STORED_REVISION');
      return {revision,preferences:validatePreferences(rows[0].preferences)};
    },
    async compareAndSwap(accountId,expectedRevision,preferences) {
      const valid=validatePreferences(preferences);
      const {rowCount}=expectedRevision===0
        ? await pool.query(
          "INSERT INTO liftd.rider_preferences(account_id,revision,preferences) VALUES($1,1,$2::jsonb) ON CONFLICT(account_id) DO NOTHING",
          [accountId,JSON.stringify(valid)])
        : await pool.query(
          "UPDATE liftd.rider_preferences SET revision=revision+1,preferences=$3::jsonb,updated_at=now() WHERE account_id=$1 AND revision=$2::bigint",
          [accountId,expectedRevision,JSON.stringify(valid)]);
      return rowCount===1;
    },
    async delete(accountId){
      // Preserve revision tombstone to reject stale replay after privacy erasure.
      await pool.query(
        `INSERT INTO liftd.rider_preferences(account_id,revision,preferences)
         VALUES($1,1,'{}'::jsonb)
         ON CONFLICT(account_id) DO UPDATE
           SET revision=liftd.rider_preferences.revision+1,
               preferences='{}'::jsonb,updated_at=now()`,
        [accountId]);
    }
  });
}
