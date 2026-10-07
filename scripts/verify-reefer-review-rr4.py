#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
errors=[]

def req(ok,msg):
    if not ok: errors.append(msg)

def read(rel):
    p=ROOT/rel
    req(p.exists(),f"missing {rel}")
    return p.read_text() if p.exists() else ""

session=read("reefer-review/session.go")
http=read("reefer-review/http.go")
client=read("reefer-review/client/client.go")
client_test=read("reefer-review/client/client_test.go")
session_test=read("reefer-review/session_test.go")
http_test=read("reefer-review/http_test.go")
index=read("reefer-review/web/index.html")
js=read("reefer-review/web/app.js")
doc=read("docs/reefer-review/RR-4-IDENTITY-PERMISSIONS.md")
roadmap=read("docs/reefer-review/RR-ROADMAP.md")

for marker in [
    "CapabilityAuthor", "CapabilityPublisher", "CapabilityModerator",
    "SessionClaims", "SessionVerifier", "SessionSecurity",
    "ErrSessionExpired", "ErrSessionRevoked", "ErrSessionScope",
    "Audience", "ChainID", "Network", "ExpiresAt", "Revoked", "Capabilities",
    "VisibilityGrants", "NewIdentityBoundHTTP", "SessionIdentity", "SessionAuthorizer",
]:
    req(marker in session,f"session authority missing {marker}")

for marker in [
    'const prefix = "Bearer "', "Authorization", "sessionRequirements",
    "actorFromContext", "WithSessionClaims", "SESSION_EXPIRED",
    "SESSION_REVOKED", "CAPABILITY_DENIED",
]:
    req(marker in http,f"HTTP session boundary missing {marker}")

req('Header.Get("X-420-Actor")' not in http, "HTTP still trusts X-420-Actor")
req('"X-420-Actor"' not in client, "typed client still sends X-420-Actor")
req("SessionTokenProvider" in client and '"Authorization", "Bearer "+token' in client,
    "typed client bearer session provider missing")

for marker in [
    "ReeferReviewWalletSession", "requestSession", "Authorization",
    "Bearer ", "sessionToken", "clearSession(", "endSession",
]:
    req(marker in js,f"web session boundary missing {marker}")
req("sessionStorage." not in js and "localStorage." not in js,
    "browser persists session credential")
req("X-420-Actor" not in js, "browser still sends X-420-Actor")
req('id="session-actor"' not in index, "arbitrary actor input remains")
req('id="session-connect"' in index and 'id="session-disconnect"' in index,
    "Wallet session controls missing")

for marker in [
    "TestRR4SessionValidationBoundaries",
    "TestRR4SessionAuthorizerScopesCapabilities",
    "TestRR4VisibilityGrantIsSessionDerived",
]:
    req(marker in session_test,f"session test missing {marker}")
for marker in [
    "TestRR4SpoofedActorHeaderDoesNotAuthenticate",
    "TestRR4CapabilityBoundaryAtHTTP",
    "TestRR4RevokedAndExpiredSessionsFailClosed",
]:
    req(marker in http_test,f"HTTP adversarial test missing {marker}")
for marker in [
    "TestRR4ClientBearerSessionParity",
    "TestRR4ClientProtectedMethodsFailWithoutSession",
]:
    req(marker in client_test,f"client test missing {marker}")

for i in range(1,18):
    req(f"{i}." in doc,f"RR-4 security invariant {i} missing")
req("RR-4 — Identity & Permissions" in roadmap,"canonical RR-4 roadmap entry missing")
req("RR-5 — Durable Storage & Rights" in roadmap,"next canonical step missing")

if errors:
    for e in errors: print("ERROR:",e)
    sys.exit(1)
print("Reefer Review RR-4 verifier: PASS")
