# 420 AI user guide

Typical flow: select a model version and workload, attach or reference inputs, set privacy and provider constraints, cap spend, set a deadline, choose/accept the verification policy, fund the job, monitor matching/execution, inspect the committed result and verification state, then allow settlement or follow the failure/dispute/refund path.

Lifecycle is bounded: `CREATED -> FUNDED -> MATCHED -> ACCEPTED -> RUNNING -> RESULT_COMMITTED -> VERIFIED -> SETTLED`, with terminal recovery states such as cancelled, expired, failed, disputed and refunded.

A terminal job cannot reopen or regain spend authority.