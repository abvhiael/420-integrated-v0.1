# EXP-1.9 — CI and qualification automation

EXP-1.9 turns the EXP-1 qualification process into an enforceable CI contract rather than relying on operator convention.

## Exact-head enforcement

The three required retained gates—420Indexer, 420Docs Qualification, and 420 Integrated Qualification—now explicitly check out `github.event.pull_request.head.sha || github.sha`. Each gate asserts `git rev-parse HEAD` equals that expected SHA before qualification commands execute.

This removes ambiguity around GitHub's synthetic pull-request merge ref. A green qualification result therefore proves the workflow ran against the exact candidate commit identified by the PR head.

The primary 420Indexer gate and the dedicated EXP-1.9 automation gate also trigger on qualifying changes pushed to `main`, providing automatic post-merge requalification rather than stopping at PR evidence.

## Queue and permission controls

All required PR gates use concurrency groups with `cancel-in-progress: true`, so superseded candidate SHAs do not remain authoritative qualification surfaces. The workflows use read-only repository contents permission for qualification.

## Retained qualification chain

420Indexer remains the primary Explorer source/integration gate and retains EXP-1.1 through EXP-1.9. EXP-1.9 emits machine-readable exact-head evidence and a dedicated CI-automation artifact. A focused EXP-1.9 workflow separately checks the automation contract itself.

## Qualification boundary

This step qualifies repository CI and exact-head evidence automation. It does not convert source CI into deployment or live-testnet evidence. Approved live execution/consensus/Explorer targets remain governed by their separate manual/live qualification workflows.

EXP-1.9 is complete only when the dedicated gate, 420Indexer, 420Docs Qualification, and all four 420 Integrated jobs are green on the same exact head.
