import assert from "node:assert/strict";
import {retailerStatus} from "../retailer.mjs";
const expected=retailerStatus();
for(const input of [null,{licence:"self-reported",verified:true},{order:{paid:true},dispatch:"READY"},
  {exception:"RESOLVED",proof:"forged",customerAddress:"private"}]){
 const actual=retailerStatus(input);
 assert.deepEqual(actual,expected);
 assert.equal(actual.intake,"CLOSED");
 assert.equal(actual.dispatch,"DISABLED");
 assert.ok(!("customerAddress" in actual));
 assert.ok(!("proof" in actual));
}
console.log("R03.6 retailer public intake and dispatch fail-closed PASS");
