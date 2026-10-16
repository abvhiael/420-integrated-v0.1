import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('quote UI renders full financial terms and explicit opt-in without unsafe HTML',()=>{
 const v=readFileSync(new URL('../quote-view.mjs',import.meta.url),'utf8');
 for(const word of ['fare','currency','baseCents','distanceCents','durationCents','minimumAdjustmentCents','transportationCents','bookingFeeCents','surgeCents','taxes','passThrough','expiresAt','cancellationPolicy','preTripRiderFeeCents','noShowFeeCents','waitingFeeCents','payment','consent','tick.checked']) assert.ok(v.toLowerCase().includes(word.toLowerCase()),word);
 assert.ok(!v.includes('innerHTML'));assert.ok(!v.includes('localStorage'));assert.ok(v.includes('request.disabled=true'));
});
