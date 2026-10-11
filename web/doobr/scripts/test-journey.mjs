import assert from 'node:assert/strict';
import {courierJourney} from '../journey.mjs';
const initial=courierJourney();
for(const attempt of [null,{offerAccepted:true},{gps:[49,-123],address:'private'},
  {delivered:true,recipientName:'private',signature:'forged'}]){
  const state=courierJourney(attempt);
  assert.deepEqual(state,initial);
  assert.equal(state.offers,'UNAVAILABLE');
  assert.equal(state.proofOfDelivery,'NOT_AVAILABLE');
  assert.ok(!('gps' in state)&&!('signature' in state)&&!('address' in state));
}
console.log('R03.5 public journey denial and no-private-proof PASS');
