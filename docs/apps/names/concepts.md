# 420 Names concepts

A **name record** contains owner, pending owner, resolved address, optional Identity profile ID, optional Registry service ID, expiry and label length.

Ownership is lease-based. An expired record is not authoritative even if an old cache still displays it.

**Forward resolution** maps name to address/context. **Reverse resolution** provides a preferred display name for an address, but only when canonical forward state still points back to that address.

Commit/reveal reduces front-running risk during registration.