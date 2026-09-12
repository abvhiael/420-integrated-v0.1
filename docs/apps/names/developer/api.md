# Names API and resolution

Derived APIs may expose name records for convenience, but clients should retain chain/record provenance and refresh near expiry or before value-sensitive actions.

A resolver should return no authoritative result for expired records. Reverse resolution must be revalidated against current forward resolution.