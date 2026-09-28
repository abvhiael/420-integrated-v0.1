# EXP-NEXT.1 — Registry ABI/descriptor release provenance

Status: **IMPLEMENTED_PENDING_EXACT_HEAD_QUALIFICATION**

Canonical definition: `docs/audit/EXP-2R.5-authoritative-next-phase-roadmap.json`.

This step pins the repository release descriptor used for ProtocolRegistry event decoding without claiming live Registry authority. The descriptor is bound to ProtocolRegistry v4 source blob `0ad7967d9ac805dd819101955c10233ff3d19325`, frozen repository address `0x0000000000000000000000000000000000000434`, and SHA-256 `56dd77bb98971368ecf14748b08793f7c6e04cdd5feb8ebdeecf278b606ff6da`.

The TypeScript decoder now rejects a matching event topic emitted by a different contract address. Tests cover known ServiceVersionPublished and ServiceRegistrationProfilePublished vectors, descriptor hash drift, address drift, and wrong-emitter rejection. Existing Go Registry catalogue/ABI tests retain activation, replacement/deprecation and malformed-log coverage.

Live ProtocolRegistry deployment/publication, target-network eth_getCode evidence, deployed Explorer UI, and Genesis readiness remain explicitly outside EXP-NEXT.1.
