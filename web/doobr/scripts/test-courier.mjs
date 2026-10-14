import assert from 'node:assert/strict';
import {courierStatus,COURIER_STATES} from '../courier.mjs';
assert.deepEqual(courierStatus(),{...COURIER_STATES,reason:'Courier enrollment is closed pending independently verified credentials, policy approval, and operational authorization.'});
for(const malicious of [{approved:true,available:true},{carrierClass:'COMMON_CARRIER',credentials:['training','vehicle'],availability:'ONLINE'},{status:'ACTIVE',gps:{lat:49.2,lng:-123.1}},{ageVerified:true,walletConnected:true}]){
  const result=courierStatus(malicious);
  assert.equal(result.enrollment,'CLOSED');assert.equal(result.credentials,'UNVERIFIED');assert.equal(result.availability,'OFFLINE');
  assert.ok(!('gps' in result));assert.ok(!('credentialsEvidence' in result));
}
console.log('R03.4 public courier enrollment and availability fail-closed PASS');
