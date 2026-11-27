# WS-1 qualification evidence

PR #1451. Baseline tested commit `5919d02fefd451707f4ba2e922f31d6aacc4ed34`.

Backend run: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45937482667 (job 140303919063). All ten reported workflows passed on this baseline.

## Original complete-game log extract

```text
2026-11-27T04:05:28.8340638Z === RUN   TestBC42WordSaladAlternatingProductionTurns
2026-11-27T04:05:28.8341379Z === RUN   TestBC42WordSaladAlternatingProductionTurns/easy
2026-11-27T04:05:28.8344223Z     classic_word_salad_bots_integration_test.go:106: natural completion: scoreless scores=[990 145] winners=[0]
2026-11-27T04:05:28.8345662Z     classic_word_salad_bots_integration_test.go:110: production dictionary: human=47 computer=46 human placements=42 final sequence=94
2026-11-27T04:05:28.8346391Z === RUN   TestBC42WordSaladAlternatingProductionTurns/medium
2026-11-27T04:05:28.8347222Z     classic_word_salad_bots_integration_test.go:106: natural completion: scoreless scores=[633 693] winners=[1]
2026-11-27T04:05:28.8348314Z     classic_word_salad_bots_integration_test.go:110: production dictionary: human=30 computer=30 human placements=25 final sequence=61
2026-11-27T04:05:28.8349097Z === RUN   TestBC42WordSaladAlternatingProductionTurns/hard
2026-11-27T04:05:28.8349828Z     classic_word_salad_bots_integration_test.go:106: natural completion: scoreless scores=[652 664] winners=[1]
2026-11-27T04:05:28.8351513Z     classic_word_salad_bots_integration_test.go:110: production dictionary: human=30 computer=29 human placements=27 final sequence=60
2026-11-27T04:05:28.8352353Z --- PASS: TestBC42WordSaladAlternatingProductionTurns (59.54s)
2026-11-27T04:05:28.8352940Z     --- PASS: TestBC42WordSaladAlternatingProductionTurns/easy (23.70s)
2026-11-27T04:05:28.8353649Z     --- PASS: TestBC42WordSaladAlternatingProductionTurns/medium (15.80s)
2026-11-27T04:05:28.8354338Z     --- PASS: TestBC42WordSaladAlternatingProductionTurns/hard (16.91s)
```

## Scope and limitations

The test driver uses a policy for the human seat; these are PostgreSQL integration games, not live browser games. The new independent score auditor at commit `924ead3546c6df600ce7359d242b3bc35e10563e` enumerates board runs and terminal rack adjustments independently of the engine scoring functions, sharing canonical tile/premium tables and dictionary. Its qualification is pending and is not represented by the baseline logs above. Live authenticated browser qualification remains outstanding.

## Independent scoring results (passed)

Exact tested HEAD: `053dbc4351d15a8ff31b540e6b3203bc55f8d213`. Run https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45944091293, job 140324730335.

```text
2026-11-27T05:12:09.7377906Z     classic_word_salad_bots_integration_test.go:111: independent score audit: [990 145]
2026-11-27T05:12:09.7378884Z     classic_word_salad_bots_integration_test.go:112: natural completion: scoreless scores=[990 145] winners=[0]
2026-11-27T05:12:09.7379640Z     classic_word_salad_bots_integration_test.go:116: production dictionary: human=47 computer=46 human placements=42 final sequence=94
2026-11-27T05:12:09.7380954Z     classic_word_salad_bots_integration_test.go:111: independent score audit: [633 693]
2026-11-27T05:12:09.7381561Z     classic_word_salad_bots_integration_test.go:112: natural completion: scoreless scores=[633 693] winners=[1]
2026-11-27T05:12:09.7382552Z     classic_word_salad_bots_integration_test.go:116: production dictionary: human=30 computer=30 human placements=25 final sequence=61
2026-11-27T05:12:09.7383887Z     classic_word_salad_bots_integration_test.go:111: independent score audit: [652 664]
2026-11-27T05:12:09.7384566Z     classic_word_salad_bots_integration_test.go:112: natural completion: scoreless scores=[652 664] winners=[1]
2026-11-27T05:12:09.7385403Z     classic_word_salad_bots_integration_test.go:116: production dictionary: human=30 computer=29 human placements=27 final sequence=60
2026-11-27T05:12:09.7386003Z --- PASS: TestBC42WordSaladAlternatingProductionTurns (46.99s)
2026-11-27T05:12:09.7386561Z     --- PASS: TestBC42WordSaladAlternatingProductionTurns/easy (18.48s)
2026-11-27T05:12:09.7387012Z     --- PASS: TestBC42WordSaladAlternatingProductionTurns/medium (13.16s)
2026-11-27T05:12:09.7387616Z     --- PASS: TestBC42WordSaladAlternatingProductionTurns/hard (13.13s)
```

All 212 turns matched; all three games ended scoreless. Tile-out adjustment branch was not exercised by these games. Shared race run 45944091211 hit the package-wide 600-second limit while entering TestBC42WordSaladConcurrentIntegrity (reported elapsed 0s), with active JSON replay, not evidence of a deadlock. The full unfiltered race suite is retained with explicit 24-minute Go and 30-minute job bounds and verbose per-test diagnostics; requalification pending.
