function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
}

export function queryCacheKey({ surface, schema = '14.0', subjectId = '', cursor = '', filters = {} }) {
  if (!surface) throw new Error('cache surface required');
  return [schema, surface, subjectId, cursor, stable(filters)].join('|');
}

export class QueryCache {
  constructor() {
    this.entries = new Map();
  }
  get(key) { return this.entries.get(key) ?? null; }
  set(key, value) { this.entries.set(key, value); return value; }
  delete(key) { this.entries.delete(key); }
  clear() { this.entries.clear(); }
}
