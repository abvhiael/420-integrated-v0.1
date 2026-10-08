#!/usr/bin/env python3
"""GROW-08 clean checkout app-scoped static/security invariants."""
from pathlib import Path
import json
import re

root=Path(__file__).resolve().parents[1]
def read(s):return (root/s).read_text(encoding="utf8")
def check(v, msg):
    if not v:raise AssertionError(msg)

app=read("grow/web/app.js")
html=read("grow/web/index.html")
config=read("grow/web/runtime-config.js")
headers=read("grow/web/_headers")
service=read("grow/service/handler.go")
server=read("grow/cmd/server/main.go")
workflow=read(".github/workflows/420grow-fast.yml")
package=json.loads(read("grow/web/package.json"))
check(package["scripts"].get("qualify") and package["scripts"].get("build"), "missing fresh build/qualification target")
for name in ("index.html","styles.css","app.js","runtime-config.js","favicon.svg","_headers"):
    check((root/"grow/web"/name).stat().st_size>0,"missing bundled web asset "+name)
check("enabled:false" in config, "unexpected live runtime endpoint")
check("innerHTML" not in app and "textContent" in app,"unsafe DOM mutation")
check('credentials:"omit"' in app and 'redirect:"error"' in app, "browser source credentials/redirect policy changed")
check("https:" in app and "configOrigin" in app, "trusted HTTPS source restriction missing")
check("Content-Security-Policy" in headers and "frame-ancestors 'none'" in headers, "site CSP or anti-framing missing")
check("geolocation=()" in headers, "privacy permissions policy missing")
check('http.MethodGet' in service and 'http.StatusMethodNotAllowed' in service, "read-only API gate missing")
check('"no-store"' in service and 'http.StatusBadGateway' in service, "cache/fail-closed policy missing")
check('grow.Read(ctx, source)' in service, "canonical public projection bypassed")
check('endpoint.Scheme != "https"' in server, "TLS upstream requirement missing")
check('http.ErrUseLastResponse' in server, "upstream redirect policy missing")
check("go test -race -count=1" in workflow and "go build ./grow/" in workflow, "clean/race checks missing")
check("scripts/verify-grow-07.py" in workflow, "cross-app guard missing")
check(not list((root/"grow").rglob("*.sol")), "unexpected Grow-owned contract")
print("GROW-08 static/security qualification: PASS")
