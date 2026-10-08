#!/usr/bin/env python3
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[1]
required={
"reefer-review/news_operations.go":["PollDue","Run(","FeedSourceHealth","CircuitOpenUntil","ConsecutiveFailures","NextAttempt","LastModified","ETag","os.Rename","Sync()"],
"reefer-review/news_feed.go":["FetchConditional","If-None-Match","If-Modified-Since","StatusNotModified","validateFeedEndpoint"],
"reefer-review/news_operations_test.go":["TestRR8ConditionalCheckpointAndRecovery","TestRR8BackoffAndCircuitBreaker"],
"docs/reefer-review/RR-8-FEED-OPERATIONS.md":["scheduler","checkpoint","operator"],
"docs/reefer-review/RR-ROADMAP.md":["RR-8 — Feed Operations","RR-9 — Web UX & Deployment"],
}
errors=[]
for filename,markers in required.items():
 p=root/filename
 if not p.is_file():
  errors.append("missing "+filename)
  continue
 text=p.read_text()
 for marker in markers:
  if marker not in text: errors.append(filename+" missing "+marker)
for err in errors: print("ERROR:",err)
sys.exit(1 if errors else 0)
