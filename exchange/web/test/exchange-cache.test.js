import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryCache, queryCacheKey } from '../core/exchange-cache.js';

test('cache key binds schema, subject, cursor and complete filters', () => {
  const a=queryCacheKey({surface:'history',subjectId:'m1',cursor:'c1',filters:{activeOnly:true,kind:'TRADE'}});
  const b=queryCacheKey({surface:'history',subjectId:'m1',cursor:'c1',filters:{kind:'TRADE',activeOnly:true}});
  assert.equal(a,b);
  assert.notEqual(a,queryCacheKey({surface:'history',subjectId:'m1',cursor:'c2',filters:{kind:'TRADE',activeOnly:true}}));
});

test('query cache does not synthesize misses', () => {
  const cache=new QueryCache();
  assert.equal(cache.get('missing'),null);
  cache.set('k',{value:1});
  assert.deepEqual(cache.get('k'),{value:1});
});
