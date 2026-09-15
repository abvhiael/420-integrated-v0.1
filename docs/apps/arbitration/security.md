# 420 Arbitration security and privacy

Evidence commitments may reference encrypted/access-controlled off-chain payloads. Do not publish private evidence merely because the chain stores its hash. Define authorized viewers, storage/retention and encryption handling explicitly.

Never treat a finalized ruling as blanket authority over unrelated protocol state. Consuming protocols must recheck domain, origin, finality, replay and their own authorization/accounting rules.