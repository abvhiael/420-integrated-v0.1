# Native PotCoin evidence

`genesis-header.bin`, `genesis-transaction.bin` and `genesis-bootstrap.dat` reproduce the actual current native source genesis at potcoin/PotCoin commit `24b987951186417af909a9cf1ea4da736e782c0f`. The upstream X13 implementation and released v2.0.1 daemon independently recognize this genesis. Bootstrap framing is native MOTA magic, little-endian block length and full block serialization. This is the 2026 native chain, not the legacy 2014 chain or an SPL token.

`controlled-*` and `controlled.json` are **controlled test material only**: invented stake origin, transactions, height, modifier, trust and checkpoint, with public test key 1. The header X13 and ECDSA signature are real computations, but this is NOT a valid historical chain, not native full replay evidence, and never a production trust root. Regenerate with `scripts/potcoin/generate_controlled.py --x13 /path/to/libpot-x13.so` after installing the pinned Python requirements and building the pinned upstream helper (`native_hash.build`).

The complete post-bootstrap raw mainnet corpus has NOT been acquired. See `docs/audit/potcoin-qualification/acquisition.json`. No historical post-500 proof is qualified by these fixtures.
