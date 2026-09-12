# 420 Registry developer integration

Developers should resolve canonical services through `ProtocolRegistry`, validate expected interface/profile commitments and treat inactive versions as unusable for new security-sensitive work.

Use derived APIs for convenience, but recheck canonical state before privileged/value-sensitive interactions. Do not hard-code a service address when the Registry is intended to provide versioned discovery.