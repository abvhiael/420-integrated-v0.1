import test from 'node:test';
import assert from 'node:assert/strict';
import {parseExternalLink,isSafeDiagnostic,requireFreshRecovery,safeResumeState} from '../src/hardening-policy.mjs';
test('accepts only bounded identity callbacks without authority claims',()=>{
 assert.equal(parseExternalLink('liftd-preview://callback?code=ok&state=nonce').kind,'identity-callback');
 for(const input of ['https://example.org/driver','liftd-preview://driver?role=driver','liftd-preview://callback?code=a&state=b&role=driver','liftd-preview://callback?code=a&code=b&state=s','liftd-preview://callback?code=a','liftd-preview://callback?code=a&state=s#x','liftd-preview://callback?code=a&state=s&payment=true','liftd-preview://callback?code=a&state=s&error=no','liftd-preview://callback?code=a&state=s&state=x','liftd-preview://callback?code=a&state=s&authority=https://evil.example', 'liftd-preview://callback?code=a&state=s&token=x'])assert.equal(parseExternalLink(input),null,input);
});
test('resume fails closed and requires fresh acknowledged command',()=>{
 assert.deepEqual(safeResumeState(),{role:null,availability:false,tripAuthorized:false,paymentAuthorized:false,requiresServerRevalidation:true});
 for(const input of [{},{foreground:true,sessionVerified:true,serverConfirmed:false,commandId:'x',confirmedCommandId:'x'},{foreground:true,sessionVerified:true,serverConfirmed:true,commandId:'x',confirmedCommandId:'y'}])assert.throws(()=>requireFreshRecovery(input));
 assert.equal(requireFreshRecovery({foreground:true,sessionVerified:true,serverConfirmed:true,commandId:'x',confirmedCommandId:'x'}).status,'server-confirmed');
});
test('diagnostic guard denies credentials and private data labels',()=>{
 assert.equal(isSafeDiagnostic('MBL6_POLICY_DENIED'),true);
 for(const value of ['Bearer secret','refresh_token','latitude','payment_intent','incident document','privateKey'])assert.equal(isSafeDiagnostic(value),false);
});
