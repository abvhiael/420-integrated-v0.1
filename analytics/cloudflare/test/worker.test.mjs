import test from "node:test";
import assert from "node:assert/strict";
import worker, { validOrigin } from "../src/worker.mjs";

test("validOrigin accepts production https and rejects unsafe origins", () => {
  assert.equal(validOrigin("https://analytics-origin.example.org"), true);
  assert.equal(validOrigin("http://analytics-origin.example.org"), false);
  assert.equal(validOrigin("https://localhost:8424"), false);
  assert.equal(validOrigin("not-a-url"), false);
});

test("API fails closed when ANALYTICS_ORIGIN is absent", async () => {
  const response = await worker.fetch(
    new Request("https://analytics.420integrated.org/v1/status"),
    { ASSETS: { fetch: async () => new Response("asset") } }
  );
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error, "ORIGIN_NOT_CONFIGURED");
  assert.equal(body.canonical, false);
});

test("static assets remain available without a backend", async () => {
  const response = await worker.fetch(
    new Request("https://analytics.420integrated.org/"),
    { ASSETS: { fetch: async () => new Response("<html></html>", { headers: { "content-type": "text/html" } }) } }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
});
