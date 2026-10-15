import test from 'node:test';import assert from 'node:assert/strict';
import {createHighCountryRoutineJournal420} from '../src/highcountry-r066-routine-journal.js';
test('parameterized durable at-most-once operation identity and outage fail closed',async()=>{
 const seen=new Set();let queryText;
 const journal=createHighCountryRoutineJournal420({pool:{query:async(sql,args)=>{
  queryText=sql;const key=args.join('/');if(seen.has(key))return {rowCount:0};seen.add(key);return {rowCount:1};
 }}});
 const req={principal:'p',sessionId:'s',operation:'o',action:'a'};
 assert.equal(await journal.claim(req),true);
 assert.equal(await journal.claim(req),false);
 assert.match(queryText,/ON CONFLICT/);assert.match(queryText,/\$1/);
 const offline=createHighCountryRoutineJournal420({pool:{query:async()=>{throw Error('connection');}}});
 await assert.rejects(offline.claim(req),/r066-journal-unavailable/);
});
