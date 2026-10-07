#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
api=(ROOT/"puffbuddies/api/hardening.py").read_text()
wsgi=(ROOT/"puffbuddies/api/wsgi.py").read_text()
web=(ROOT/"puffbuddies/web/api-client.js").read_text()
mobile=(ROOT/"puffbuddies/mobile/core/api-client.js").read_text()
doc=(ROOT/"docs/puffbuddies/PB-14-BACKEND-API-HARDENING.md").read_text()

def need(ok,msg):
    if not ok: raise SystemExit("FAIL: "+msg)

need('API_BASE = "/api/puffbuddies/v1"' in api,"canonical API base drift")
for route in ["/session","/eligibility","/profile","/profile/media","/discovery",
              "/relationships/action","/matches","/messenger/entry","/notifications",
              "/notifications/device","/safety/action","/profile/visibility","/lifecycle",
              "/deletion/status","/verification","/premium/entitlements"]:
    need(route in api,f"missing API route {route}")
for phrase in ["idempotency-key","content-length","sec-fetch-site","authorization",
               "no-store, max-age=0","X-Frame-Options","authority_generation",
               "rate_limiter","replay_guard","allowed_hosts"]:
    need(phrase.lower() in api.lower(),f"missing hardening primitive {phrase}")
need("X-Forwarded" in wsgi and "does not interpret" in wsgi,"forwarded-header trust boundary missing")
need('headers["Idempotency-Key"]=mutationKey()' in web,"web mutation replay key missing")
need('headers["Idempotency-Key"]=mutationKey()' in mobile,"mobile mutation replay key missing")
for forbidden in ["FORCE_MATCH","FORCE_UNBLOCK","ADMIN_MATCH","BLOCK_OVERRIDE","UNSUSPEND","UNBAN"]:
    need(forbidden not in api,f"forbidden API authority route/token {forbidden}")
for forbidden in ["private_key","mnemonic","seed_phrase","government_id","date_of_birth","wallet_address"]:
    need(re.search(rf"\b{forbidden}\b",api,re.I) is None,f"protected field leaked into API transport: {forbidden}")
need("Level 1 exact-head qualification" in doc,"qualification policy drift")
need("PB-15" in doc and "PB-16" in doc,"next-phase ownership missing")
print("PASS: PuffBuddies PB-14 backend/API hardening verifier")
