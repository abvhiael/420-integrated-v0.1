# 420 Registry concepts

A **service ID** is the stable identity of a protocol service. A **service version** binds that identity to an implementation address and commitments such as runtime/code hash, metadata and registration-profile fields.

Versions advance monotonically and history is append-only. **Active** means the current version is intended for use; **deprecated/inactive** means consumers should stop treating it as the current operational target.

Registry legitimacy is bounded: being registered proves canonical discovery status, not universal safety, endorsement, wallet authority or governance power.