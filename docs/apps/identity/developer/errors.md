# Identity errors and retries

Typical failures include unauthorized controller/issuer action, duplicate profile ID, inactive profile/issuer, invalid trust class, expired/unknown credential and already revoked/rejected state.

Do not blindly retry deterministic policy failures. Retry transient transport/indexing errors with bounded backoff and re-read canonical state.