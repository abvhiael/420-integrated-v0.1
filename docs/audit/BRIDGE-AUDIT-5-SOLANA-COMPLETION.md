# BRIDGE-AUDIT-5 — Solana and SPL completion

Baseline main: `5524e46400be4fa85400a48a03099310731a7bc7`. Exact published source and integration status are reported by the associated PR; current input manifests bind the qualified source bytes.

## Original requirements

| Requirement | Local implementation and qualification |
| --- | --- |
| SolanaBridgeAdapter420 | Existing concrete verifier integration; approved program/mint/route mapping, source-owner preservation and source-message replay; affected adapter, token/router and hardening regressions |
| Production finality verifier integration | Concrete SolanaFinalityVerifier420 and SolanaValidatorQuorum420, strict Ed25519 quorum against governance-authenticated epoch stake/voter roots, signed committed-execution witnesses and program code/instruction binding; RPC-only assertions rejected |
| Cluster and finalized commitment | Exact canonical mainnet genesis; epoch, slot/bank, transaction and execution records bound in bridge-specific certificate; conflicting certified slots cannot replace accepted banks |
| Gateway program and SPL mints | Approved gateway program and code hash, committed vault/PDA and instruction effects, canonical classic Tokenkeg mint profiles; RAY/EURC map through approved unique destination representations and checked conversion |
| 32-byte recipient encoding | Exact outbound width; every pubkey byte preserved in typed request and binary message, including high-bit and off-curve/PDA keys. No address-to-20-byte truncation or curve-based restriction is introduced |
| Outbound message interface | ISolanaOutboundMessage420 typed lookup, persistent payload/nonce, canonical 420SREQ1 public message data and strict Python codec; existing native/SPL digests and event preserved |
| Wire amount width | Native SOL now rejects source amounts above uint64 before consuming nonce, matching SPL policy; full source nonce remains uint256 and is never silently truncated |
| Source uniqueness/replay | Existing authenticated deposit message ID, full primary-signature digest and persistent consumption remain authoritative; successive outbound requests remain distinct and failed outer transactions roll back payload and nonce |
| Malformed/wrong cluster/program/asset/route | Retained genuine cryptographic corpus and scoped current adapter/hardening/token/router rejection tests; no caller transport field grants finality or gateway authority |
| Emergency and rotation | Governance-only setter/rotation and emergency isolation preserved; relevant unauthorized/invalid verifier, new verifier proof authority, halt, direction independence and replay/nonce preservation cases qualified |

## Finality trust boundary and deferred live source qualification

The implemented finality path is the existing stake-weighted bridge-domain attestation oracle, not a native Tower/Alpenglow light client. Approved signers must independently authenticate finalized banks and committed execution against an independently established epoch stake/authorized-voter snapshot. Historical signatures, ordinary consensus votes, RPC `finalized` and `err:null` do not create those certificates. No genuine source root, validator authorization or deployed gateway is invented.

Live source qualification is explicitly deferred by the supplied task. The original 53 Solidity cases, six compiled SBF execution cases, 1,053 genuine transaction-signature checks and repaired SDK normal/optimized evidence remain pinned to their original source commits. The finality/quorum/Ed25519/parser and SBF program sources are unchanged; their heavy historical/native qualifications are not rerun for a public outbound transport addition. SOL remains explicitly short of full source-finality qualification in the authoritative inventory and no production approval is installed.

## Public outbound transport

The typed payload binds source chain/router/adapter, message ID, route/asset, sender, all 32 recipient bytes, local amount, uint64 lamport/token amount, native sentinel or complete mint, full uint256 nonce and public extra bytes. `outboundMessage` and `outboundMessageData` reject unknown IDs. The latter encodes:

| Byte range (end exclusive) | Encoding |
| --- | --- |
| 0–8 | ASCII `420SREQ1` |
| 8–40 | source chain ID, uint256 big endian |
| 40–80 | source router and adapter, 20 bytes each |
| 80–176 | message, route and asset IDs, 32 bytes each |
| 176–196 | sender, 20 bytes |
| 196–228 | recipient, full 32-byte public key |
| 228–260 | local amount, uint256 big endian |
| 260–268 | Solana amount, uint64 little endian |
| 268–300 | native sentinel or SPL mint, 32 bytes |
| 300–332 | source nonce, uint256 big endian |
| 332–336 | extra length, uint32 little endian |
| 336 onward | exact extra bytes; no trailing bytes |

The stdlib Python encoder/decoder strictly checks widths, integers, lengths, version, canonical framing and allowed public fields, also under Python optimization. It does not sign, establish trust, access credentials or authenticate a caller's message claims. A Python-generated golden vector is independently compared with the production Solidity encoder, including a high-bit recipient and nonce above uint64.

This is a public request format, **not an executable release instruction for the existing deposit-only SBF gateway**. A source custody provider must authenticate finalized 420 representation burn/escrow backing, the approved source chain/router/adapter and gateway-program domain, message/route/mint/amount/recipient and replay state before constructing an authorized release. Native SOL account ownership/writability and classic SPL recipient ATA/mint/Tokenkeg/vault/PDA identities and authority must match the actual approved program. A 32-byte key being format-valid is not an account-eligibility or ownership proof; PDA recipients are not rejected merely for being off curve. Auxiliary bytes are public and must contain no credentials. Request construction cannot complete settlement or release custody.

Native SOL retains its existing lamport-denominated amount contract; SPL local quantities use the exact approved destination-decimal conversion. Neither amount nor nonce is truncated to fit the wire.

No release opcode, unapproved signer, arbitrary RPC authority or custody shortcut is added to the source program. Its existing init/deposit profile and compiled execution qualification remain unchanged. Authenticated custody/release and live authority deployment remain on the existing testnet roadmap.

## Evidence preservation and actual diagnostics

Current qualification: **77 passing Foundry cases, 15,000 fuzz inputs, 128 invariant runs / 8,192 calls / zero handler reverts**. Nine SDK tests pass in normal and optimized Python. The adapter runtime is **8,542 bytes**, below EIP-170. Both approved SPL profiles retain their exact amounts, all mint bytes and existing digests.

Current results, commands, source hashes, runtime-size assertions and SDK logs are in `solana-completion-qualification/`. The authoritative inventory explicitly links superseded source inputs and qualified descendants, preserving the V.22 and Ethereum extension evidence without rewriting their manifests. The validator follows only source transitions backed by current executed qualification records; unrelated drift still fails.

The first native batch passed 21 cases and failed only the golden-vector read because its isolated runner did not copy the new fixture. After adding that fixture path, the same case exposed a trailing newline rejected by Foundry's strict hex parser. The fixture is now canonical newline-free hex. Only this failed case reran; all passing native, fuzz and invariant evidence is retained. Both diagnostic logs remain recorded. Assertions and compiler settings were not weakened.

The shared recipient fuzz fixture also still assumed every 20-byte Ethereum address was valid, contradicting BRIDGE-AUDIT-4’s qualified zero-address rejection. Its Ethereum-only predicate now distinguishes nonzero addresses, with a deterministic zero-address regression. The existing Solana fuzz methods and other hardening cases are unchanged and retain their passing evidence. A helper initially attempted an internal memory-to-calldata call; the compiler diagnostic is retained and an external ABI call fixes the test harness. No production Ethereum source is changed.

The existing testnet roadmap owns genuine epoch stake/validator authority, source gateway deployment/code identities, live SOL/SPL deposits and finalized 420-backed release/custody evidence. Current local completion does not remove those dependencies or activate a route. The next available canonical action is that existing live source/testnet qualification; no new audit phase or successor title is invented.
