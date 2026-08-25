
# S5.2 Canary Operations Runbook

Start only after `canary-preflight.py` passes. Run `canary-controller.py start`, then collect real
health snapshots for the entire canary window.

Required deliberate tests:
- primary miss -> FB1;
- primary + FB1 miss -> FB2;
- exactly 11 live validators -> certification possible;
- 10 live validators -> no certification;
- restart validator/execution pairs -> state recovery;
- zero 420ai providers -> consensus liveness unaffected.

Hold for sustained Engine errors, peer collapse, or readiness falling below launch requirements.
Fail immediately for conflicting valid QCs, finalized-history inconsistency, unauthorized quorum
threshold reduction, or consensus progression through a required SAFETY_HALT condition.

After at least 24 hours, run `evaluate-canary.py`. All checks must PASS before
`canary-controller.py complete`, then `canary-controller.py promote` may enter S5-OBSERVATION.
