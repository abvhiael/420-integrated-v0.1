# 420 Bridge troubleshooting

For a pending transfer, identify its canonical transfer ID and inspect source-finality, proof, route, destination and risk state separately.

If a proof is valid but execution is blocked, check direction, canonical asset/route eligibility and risk limits. Valid proof does not override policy.

If accounting is unhealthy, do not request manual balance repair; follow incident/reconciliation procedures.
