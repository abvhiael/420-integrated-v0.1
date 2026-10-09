import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

// One service process per database. WAL readers may run concurrently; writes
// serialize with BEGIN IMMEDIATE and optimistic entity versions.
export class Database {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000;');
    this.db.exec('CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY)');
    const version = this.get('SELECT MAX(version) AS version FROM migrations').version ?? 0;
    if (version > 6) throw new Error('unsupported database schema');
    if (version === 0) this.transaction(() => this.db.exec(readFileSync(new URL('../sql/001-commerce.sql', import.meta.url), 'utf8')));
    if (version < 2) this.transaction(() => this.db.exec(readFileSync(new URL('../sql/002-store-releases.sql', import.meta.url), 'utf8')));
    if (version < 3) this.transaction(() => this.db.exec(readFileSync(new URL('../sql/003-refund-requests.sql', import.meta.url), 'utf8')));
    if (version < 4) this.transaction(() => this.db.exec(readFileSync(new URL('../sql/004-dispute-requests.sql', import.meta.url), 'utf8')));
    if (version < 5) this.transaction(() => this.db.exec(readFileSync(new URL('../sql/005-arbitration-case-bindings.sql', import.meta.url), 'utf8')));
    if (version < 6) this.transaction(() => this.db.exec(readFileSync(new URL('../sql/006-merchant-notifications.sql', import.meta.url), 'utf8')));
  }
  get(sql, ...args) { return this.db.prepare(sql).get(...args); }
  all(sql, ...args) { return this.db.prepare(sql).all(...args); }
  run(sql, ...args) { return this.db.prepare(sql).run(...args); }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      if (result?.then) throw new Error('async work prohibited inside database transaction');
      this.db.exec('COMMIT');
      return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  audit(actor, store, operation, object, now) {
    this.run('INSERT INTO audit_log(actor,store_id,operation,object_id,occurred_at) VALUES(?,?,?,?,?)', actor, store, operation, object, now);
  }
  close() { this.db.close(); }
}
