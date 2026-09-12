# 420 Stake troubleshooting

If validator status differs between services, prefer canonical ValidatorRegistry/consensus state and refresh derived projections. If activation or withdrawal appears delayed, verify the canonical lifecycle timers and current finalized chain position.

If a reward display differs from protocol state, re-read RewardController/canonical accounting rather than treating the UI total as authoritative.