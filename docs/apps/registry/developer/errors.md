# Registry errors and retries

Common failures include wrong network, unknown service ID, inactive current service, non-sequential version, unauthorized publication, missing implementation code and commitment mismatch.

Retry read failures when transport/indexing is transient. Do not retry an authorization or validation failure blindly; correct the underlying state/input first.