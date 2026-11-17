import { Pool, type PoolConfig } from 'pg';
import type { SqlExecutor420, TransactionalSql420 } from './core-projections.js';

// Each projection, lifecycle decode, history row and checkpoint shares one
// connection/transaction. A disconnected worker cannot publish a partial batch.
export class PostgresSql420 implements TransactionalSql420 {
  readonly pool: Pool;
  constructor(config: PoolConfig) { this.pool = new Pool(config); }
  async query(sql: string, params: readonly unknown[] = []): Promise<unknown> {
    return this.pool.query(sql, [...params]);
  }
  async transaction<T>(work: (tx: SqlExecutor420) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await work({ query: (sql, params = []) => client.query(sql, [...params]) });
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally { client.release(); }
  }
  async close(): Promise<void> { await this.pool.end(); }
}
