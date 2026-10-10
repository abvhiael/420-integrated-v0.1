import test from "node:test";
import assert from "node:assert/strict";
import {renderHistorySvg} from "./chart.mjs";

test("renders bounded UTC historical chart without untrusted labels", () => {
  const svg=renderHistorySvg([
    {Value:22,MeasuredAt:"2026-10-08T12:02:00Z",Source:'<script>alert("x")</script>'},
    {Value:20,MeasuredAt:"2026-10-08T12:01:00Z"}
  ]);
  assert.match(svg, /role="img"/);
  assert.match(svg, /path d="M/);
  assert.match(svg, /UTC • 2 readings/);
  assert.doesNotMatch(svg, /script|alert/);
});
test("rejects nonfinite readings, invalid times and limits", () => {
  assert.throws(()=>renderHistorySvg([{Value:Infinity,MeasuredAt:"2026-10-08T12:00:00Z"}]),RangeError);
  assert.throws(()=>renderHistorySvg([{Value:5,MeasuredAt:"not-a-date"}]),RangeError);
  assert.throws(()=>renderHistorySvg(Array(501).fill({Value:1,MeasuredAt:"2026-10-08T12:00:00Z"})),RangeError);
  assert.throws(()=>renderHistorySvg([],{width:-3}),RangeError);
});
test("empty history has accessible empty state", () => {
  assert.match(renderHistorySvg([]),/No readings for this period/);
});
