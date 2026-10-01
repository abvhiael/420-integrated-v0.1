import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {inspectRequestSecurity,responseSecurityHeaders,HttpSecurityError} from '../../shared/http-security.mjs';
import {redact} from '../../quote-service/src/redaction.js';

const origin='https://exchange.420integrated.org';
test('exact HTTPS origin policy allows configured origin and rejects substitution',()=>{
  const ok=inspectRequestSecurity({url:'/x',headers:{origin}},{allowedOrigins:[origin]});
  assert.equal(ok.origin,origin);
  assert.throws(()=>inspectRequestSecurity({url:'/x',headers:{origin:'https://evil.example'}},{allowedOrigins:[origin]}),e=>e instanceof HttpSecurityError&&e.code==='ORIGIN_FORBIDDEN');
  assert.throws(()=>inspectRequestSecurity({url:'/x',headers:{origin:'https://exchange.420integrated.org.evil.example'}},{allowedOrigins:[origin]}),/origin/i);
});

test('credential-bearing browser requests fail closed',()=>{
  for(const headers of [{authorization:'Bearer x'},{cookie:'sid=x'},{'x-api-key':'x'}]){
    assert.throws(()=>inspectRequestSecurity({url:'/x',headers},{allowedOrigins:[]}),e=>e.code==='CREDENTIALS_FORBIDDEN');
  }
  const h=responseSecurityHeaders({origin});
  assert.equal(h['access-control-allow-origin'],origin);
  assert.equal('access-control-allow-credentials' in h,false);
});

test('oversized request targets fail closed before route handling',()=>{
  assert.throws(()=>inspectRequestSecurity({url:'/'+('x'.repeat(5000)),headers:{}},{maxTargetBytes:4096}),e=>e.code==='REQUEST_TARGET_TOO_LARGE'&&e.status===414);
});

test('redaction removes credential material and bounds hostile logs',()=>{
  const r=redact({authorization:'Bearer secret',cookie:'a=b',nested:{privateKey:'0x123'},message:'x'.repeat(1000)});
  const encoded=JSON.stringify(r);
  assert.equal(encoded.includes('Bearer secret'),false);
  assert.equal(encoded.includes('a=b'),false);
  assert.equal(encoded.includes('0x123'),false);
  assert.match(encoded,/REDACTED/);
  assert.match(encoded,/TRUNCATED/);
});

test('browser CSP is restrictive and does not allow unsafe eval',()=>{
  const repo=path.resolve(import.meta.dirname,'../../..');
  const headers=JSON.parse(fs.readFileSync(path.join(repo,'exchange/web/security-headers.json'),'utf8'));
  const csp=headers['Content-Security-Policy'];
  assert.match(csp,/default-src 'self'/);assert.match(csp,/object-src 'none'/);assert.match(csp,/frame-ancestors 'none'/);
  assert.equal(csp.includes("'unsafe-eval'"),false);
});
