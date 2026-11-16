# Upstream guest and consensus source provenance

`helios.elf`, `program`, `primitives`, Cargo.toml and Cargo.lock are a snapshot
from Across Protocol's MIT-licensed SP1-Helios workspace at commit
`8e5573b20540f281c058c9a7ac6339113c92dc00`:
https://github.com/across-protocol/sp1-helios.
The upstream workspace names authors xavierdmello and ratankaliani, and derives
from https://github.com/succinctlabs/sp1-helios. The ELF was obtained from its
`elf/sp1-helios-elf` artifact. See ../sources.json for its checksum and derived key.

`helios-consensus-core` is an audit source snapshot from a16z Helios 0.9.4,
commit `3686d998e1e87c840ca04d3bea9c7386bbace6cb`, the exact dependency locked
by the guest. Its original license is included in that directory.

The guest workspace declares MIT licensing. The MIT permission and warranty
terms are included in the production vendored verifier NOTICE.md and apply to
this MIT source snapshot as well. The local snapshot does not contain the
entire upstream build workspace; follow ../README.md to rebuild at its pinned
revision rather than silently modifying workspace membership or dependencies.
