import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AuthError} from './auth.mjs';
const hash=sql=>createHash('sha256').update(sql).digest('hex');
const fail=(code,status)=>{throw new AuthError(code,status);};
export async function checkSchema(client) {
  const folder = new URL('../migrations/', import.meta.url);
  const files = readdirSync(folder).filter(name => /^\d{3}_.+\.sql$/.test(name)).sort();
  const result = await client.query('SELECT version,checksum FROM liftd.migrations ORDER BY version');
  if (result.rows.length !== files.length || files.some((file, i) => result.rows[i].version !== file ||
    result.rows[i].checksum !== hash(readFileSync(new URL(file, folder), 'utf8')))) fail('MIGRATION_CHECKSUM_MISMATCH', 503);
}
