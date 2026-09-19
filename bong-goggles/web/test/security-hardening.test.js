import test from 'node:test';
import assert from 'node:assert/strict';
import {safeExternalHref,linkButton,canonicalHandoffs} from '../core/design-system.js';
import {redactTelemetry,createTelemetrySink} from '../core/telemetry.js';

const ATTACKS=['javascript:alert(1)','data:text/html,<script>alert(1)</script>','//evil.example/','http://wallet.example/','https://user:pass@wallet.example/','https://wallet.example/\n" onmouseover="alert(1)','https://wallet.example\\@evil.example/','https://wallet.example/\u0000','/redirect?to=https://evil.example'];
test('BG-19.12 rejects active-content, relative, credential and malformed handoff URLs',()=>{
  for(const attack of ATTACKS){
    assert.equal(safeExternalHref(attack),null,attack);
    assert.doesNotMatch(linkButton({label:'Wallet',href:attack}),/<a\b/i,attack);
  }
  assert.equal(safeExternalHref('https://wallet.example/connect'),'https://wallet.example/connect');
});
test('BG-19.12 escapes URL attribute content and ignores untrusted attributes',()=>{
  const markup=linkButton({label:'<Wallet>',href:'https://wallet.example/?q=%22hello%22',attrs:'onclick="alert(1)" target="_self"'});
  assert.doesNotMatch(markup,/onclick=/);
  assert.match(markup,/rel="noopener noreferrer" target="_blank"/);
  assert.match(markup,/&lt;Wallet&gt;/);
  const handoffs=canonicalHandoffs({walletHref:'javascript:alert(1)',explorerHref:'https://explorer.example/'});
  assert.doesNotMatch(handoffs,/href="javascript:/);
  assert.match(handoffs,/https:\/\/explorer.example\//);
});
test('BG-19.12 never emits free-form error strings, URLs, account or nested secrets',()=>{
  const leak='private message with bearer secret';
  const redacted=redactTelemetry({ok:true,code:400,message:leak,error:{stack:leak},nested:{note:leak,url:'https://example.com/?token=abc'},array:[leak]});
  assert.equal(redacted.ok,true);
  assert.equal(redacted.code,400);
  assert.doesNotMatch(JSON.stringify(redacted),/private message|bearer secret|token=abc/);
  const events=[];
  const sink=createTelemetrySink({emit:event=>events.push(event)});
  sink.event('wallet_connect_failed',{reason:leak,meta:{sessionKey:leak},ok:false});
  sink.event(leak,{value:leak});
  assert.equal(events[1].name,'redacted_event');
  assert.doesNotMatch(JSON.stringify(events),/private message|bearer secret/);
});
test('BG-19.12 bounds telemetry depth, arrays and unexpected inputs',()=>{
  const a={};a.nested=a;
  assert.doesNotThrow(()=>redactTelemetry(a));
  assert.equal(redactTelemetry(['secret'].concat(Array(40).fill('private'))).length,20);
  assert.equal(redactTelemetry(Symbol('secret')),'[REDACTED]');
});
