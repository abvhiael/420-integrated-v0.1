import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {validateRequest} from '../src/validation.js';
const vector=JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname,'../fixtures/pre04-vector-v1.json'),'utf8'));
test('PRE-04 request schema is exact, bounded and canonicalized',()=>{
 const request=validateRequest(vector.request);
 assert.equal(request.account,vector.request.account);
 for(const body of [
  {...vector.request,schema:'future-v2'},
  {...vector.request,extra:true},
  {...vector.request,tokenOut:vector.request.tokenIn},
  {...vector.request,recipient:'0x0'},
  {...vector.request,amountInRaw:'1.5'},
  {...vector.request,minimumOutputRaw:'0'},
 ])assert.throws(()=>validateRequest(body));
 assert.throws(()=>validateRequest({...vector.request,amountInRaw:'9'.repeat(9000)},{maxBodyBytes:8192}),e=>e.code==='REQUEST_TOO_LARGE');
});
