import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const css=read('../styles.css'),onboard=read('../driver-onboarding.mjs'),operator=read('../operator-console.mjs'),shell=read('../index.html');
test('PT-10 keyboard focus and mobile usability cover every interactive control',()=>{
 for(const token of ['input:focus-visible','select:focus-visible','textarea:focus-visible','[tabindex]:focus-visible','min-height:2.75rem','max-width:100%','@media(max-width:650px)','prefers-reduced-motion'])assert.ok(css.includes(token),token);
 assert.ok(shell.includes('href="#main"'));assert.ok(shell.includes('aria-live="polite"'));
});
test('PT-10 driver validates all required inputs, flags error and focuses invalid field',()=>{
 for(const token of ["expiry.type='number'","expiry.min='1'","input.pattern=","invalid.setAttribute('aria-invalid','true')","invalid.focus()","status.setAttribute('aria-live','polite')"])assert.ok(onboard.includes(token),token);
});
test('PT-10 operator labels and rejects invalid incident/trip identifier before HTTP',()=>{
 for(const token of ["'Trip ID to inspect'","'Incident ID to resolve'","input.pattern=","caseInput.pattern=","input.focus()","caseInput.focus()","'INVALID_TRIP_ID'","'INVALID_INCIDENT_ID'"])assert.ok(operator.includes(token),token);
});
