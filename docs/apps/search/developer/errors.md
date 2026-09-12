# Search integration errors

Important error classes include wrong network, stale index, unsupported result domain, malformed query/identifier, source unavailable, ambiguous resolution and provenance unavailable.

For exact canonical identifiers, ambiguous or provenance-less results should fail closed rather than silently selecting a ranked guess.

Retry transient source/index availability failures. Do not retry a wrong-chain condition without changing configuration.
