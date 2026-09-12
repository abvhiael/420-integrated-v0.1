# 420 AI troubleshooting

If no provider matches, verify model/workload/resource/privacy/deadline constraints rather than widening them silently. If a provider disappears, use the defined rematch/expiry/failure path.

If a result is missing or malformed, do not treat the job as verified. If verification fails, follow the canonical dispute/refund path. If settlement infrastructure is unavailable, preserve verified entitlement and do not mark the job settled early.

When worker queues or dashboards disagree with chain state, prefer canonical request/job/settlement state.