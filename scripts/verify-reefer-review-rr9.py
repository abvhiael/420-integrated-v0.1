#!/usr/bin/env python3
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[1]
checks={
"reefer-review/http.go":["securityResponseHeaders","sessionMiddleware"],
"reefer-review/http_security.go":["X-Content-Type-Options","X-Frame-Options","Referrer-Policy","Content-Security-Policy","Cache-Control"],
"reefer-review/http_rate_limit.go":["apiRateLimiter","Retry-After","StatusTooManyRequests","RemoteAddr"],
"reefer-review/http_security_test.go":["TestRR9SecurityHeadersOnPublicAndDeniedResponses","TestRR9NoImplicitCORSOptIn","TestRR9RateLimitIgnoresSpoofedForwardedHeader"],
"reefer-review/web/index.html":["skip-link","main-content","viewport"],
"reefer-review/web/app.js":["textContent","replaceChildren"],
"docs/reefer-review/RR-9-WEB-UX-DEPLOYMENT.md":["fail-closed","backup","browser","rate limit"],
"docs/reefer-review/RR-ROADMAP.md":["RR-9 — Web UX & Deployment","RR-10 — Repository Level 3 Closeout"],
}
errors=[]
for path,tokens in checks.items():
 p=root/path
 if not p.is_file():errors.append("missing "+path);continue
 value=p.read_text()
 for token in tokens:
  if token not in value: errors.append(path+" missing "+token)
for error in errors:print("ERROR:",error)
if errors:sys.exit(1)
print("Reefer Review RR-9 verifier: PASS")
