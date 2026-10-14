import test from 'node:test';import assert from 'node:assert/strict';
import {checkRiderPreferences,DEFAULT_RIDER_PREFERENCES} from '../preference-policy.mjs';
import {validatePreferences} from '../../src/rider-preferences.mjs';
test('browser and server enforce identical default-off controls',()=>{
  assert.deepEqual(checkRiderPreferences({}),DEFAULT_RIDER_PREFERENCES);
  assert.deepEqual(checkRiderPreferences({}),validatePreferences({}));
});
test('browser/server parity for opt-ins and denials',()=>{
  for(const x of [{largeText:true,reducedMotion:true},{contactMethod:'sms',tripNotifications:true},{marketingConsent:true,locationHistoryConsent:true},{}])assert.deepEqual(checkRiderPreferences(x),validatePreferences(x));
  for(const x of [{contactMethod:'none',tripNotifications:true},{marketingConsent:'yes'},{locationHistoryConsent:null},{other:true},{contactMethod:'whatsapp'}]){
    assert.throws(()=>checkRiderPreferences(x));assert.throws(()=>validatePreferences(x));
  }
});
