# EXP-NEXT.1 — Registry ABI/descriptor release provenance

Status: **IMPLEMENTED_PENDING_EXACT_HEAD_QUALIFICATION**

Canonical definition: `docs/audit/EXP-2R.5-authoritative-next-phase-roadmap.json`.

This step pins the repository release descriptor used for ProtocolRegistry event decoding without claiming live Registry authority. The descriptor is bound to ProtocolRegistry v4 source blob `9ab3d53a68b6533978f41e0202e5268f1d615c19`, frozen repository address `0x0000000000000000000000000000000000000434`, and SHA-256 `0bb8d571d38eeb66d7b277253cdae65b6b14c7538f95dc809db6818c8a79db81`.

The TypeScript decoder now rejects a matching event topic emitted by a different contract address. Tests cover known ServiceVersionPublished and ServiceRegistrationProfilePublished vectors, descriptor hash drift, address drift, and wrong-emitter rejection. Existing Go Registry catalogue/ABI tests retain activation, replacement/deprecation and malformed-log coverage.

Live ProtocolRegistry deployment/publication, target-network eth_getCode evidence, deployed Explorer UI, and Genesis readiness remain explicitly outside EXP-NEXT.1.


> REG-AUDIT-7 reconciliation: the descriptor was refreshed after REG-AUDIT-5/6 qualified the final ProtocolRegistry source. The prior descriptor identity remains preserved in the machine-readable EXP-NEXT.1 evidence as historical provenance.
