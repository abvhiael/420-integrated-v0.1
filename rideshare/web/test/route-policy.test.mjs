import { test } from "node:test";
import assert from "node:assert/strict";
import { routeDecision, normalizePath, sanitizeReturnPath, ROUTES, AVAILABILITY } from "../route-policy.mjs";
test("all canonical routes are explicit and non-live", () => {
  assert.deepEqual(Object.keys(ROUTES), ["/", "/rider", "/driver", "/operator"]);
  assert.equal(AVAILABILITY.state, "not_live");
  assert.equal(AVAILABILITY.payments, "Payments are not enabled");
});
test("public status remains readable without credentials", () => {
  assert.equal(routeDecision("/", null).kind, "public");
});
for (const role of ["rider", "driver", "operator"]) {
  const path = "/" + role;
  test(role + " denies absent, loading, failed, revoked and malformed sessions", () => {
    assert.equal(routeDecision(path, null).kind, "loading");
    assert.equal(routeDecision(path, {status:"loading"}).kind, "loading");
    assert.equal(routeDecision(path, {status:"error"}).kind, "error");
    assert.equal(routeDecision(path, {status:"unauthenticated"}).kind, "sign-in");
    assert.equal(routeDecision(path, {status:"authenticated",subject:"s",roles:[role],revoked:true}).kind, "sign-in");
    assert.equal(routeDecision(path, {status:"authenticated",subject:"",roles:[role]}).kind, "sign-in");
    assert.equal(routeDecision(path, {status:"authenticated",subject:"s",roles:role}).kind, "sign-in");
    assert.equal(routeDecision(path, {status:"authenticated",subject:"s",roles:["other"]}).kind, "forbidden");
  });
  test(role + " permits only verified role assignment", () => {
    assert.equal(routeDecision(path,{status:"authenticated",subject:"sub123",roles:[role]}).kind,"protected");
  });
}
test("reject path escapes and user-supplied redirect injection", () => {
  for (const p of ["//evil.example", "/%2Foperator", "/operator\\..", "/unknown", "https://evil.example", "/operator?role=operator"]) {
    assert.equal(normalizePath(p), null);
    assert.equal(sanitizeReturnPath(p), "/");
  }
  assert.equal(normalizePath("/operator/"), "/operator");
});
