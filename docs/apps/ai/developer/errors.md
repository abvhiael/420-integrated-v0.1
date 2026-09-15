# 420 AI errors and retries

Common failures include inactive provider, unsupported workload/model version, invalid privacy/resource constraint, spend/deadline violation, invalid lifecycle transition, verification failure, duplicate settlement and unavailable settlement infrastructure.

Do not retry deterministic policy failures by broadening user constraints. Retry transient provider/RPC/indexing failures with bounded backoff and re-read canonical state.