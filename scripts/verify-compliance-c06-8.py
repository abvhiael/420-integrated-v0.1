#!/usr/bin/env python3
"""C06.8 static browser and accessible-failure controls; real device AT remains distinct."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
pages=[
"services/complianceauth/authorweb/workspace.html",
"services/complianceauth/reviewerweb/console.html",
"services/complianceauth/operatorweb/dashboard.html",
"compliance/web/index.html",
]
for name in pages:
 p=ROOT/name
 if not p.exists():
  if name.startswith("compliance/web/"):continue
  raise SystemExit(f"missing browser surface {p}")
 s=p.read_text()
 for pattern in (r'<html[^>]+lang=',r'<meta[^>]+viewport',r'<main\b',r'<h1\b',r'focus-visible|style.css'):
  if not re.search(pattern,s,re.I):raise SystemExit(f"missing accessible structure {name}: {pattern}")
 if "private/" in name:
  if 'href="#main"' not in s:raise SystemExit(f"missing skip navigation: {name}")
  if 'role="status"' not in s and 'aria-live=' not in s:raise SystemExit(f"missing live feedback: {name}")
print("C06.8 browser semantic accessibility structure PASS (not equivalent to screen-reader qualification)")
