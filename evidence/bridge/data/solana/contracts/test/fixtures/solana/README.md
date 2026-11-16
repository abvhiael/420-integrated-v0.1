# Solana evidence provenance

Captured 2026-11-14 from https://api.mainnet-beta.solana.com (JSON-RPC). `rpc-observations.zip` preserves raw responses, without treating RPC as finality authority. Requests used getGenesisHash, getAgGenesisCert, getEpochInfo, getBlock(459652999, base64, maxSupportedTransactionVersion=1), getTransaction(base64, maxSupportedTransactionVersion=1), getSignaturesForAddress, getVoteAccounts and getMultipleAccounts(jsonParsed/base64).

The block contains 1,051 transactions: 730 legacy, 190 v0 and 131 v1. Two additional genuine RAY/EURC transactions are identified in historical-expected.json. Independent OpenSSL Ed25519 verification and Solidity decoding/signature verification cover all 1,053. RPC execution status, loaded addresses, bank hashes and finality remain unauthenticated observations. These transactions do not call the new gateway and do not qualify historical bridge finality.

`observed-stake-candidate.json` contains 699 RPC-observed staked vote accounts and membership paths. Its root is UNTRUSTED: no authenticated epoch bank, consensus-eligible stake map or validator authorization accompanies it. Do not install it. `network.json` inside the archive contains an unverified native Alpenglow certificate; the historical active-set RPC returned Method not found (error -32601, captured in solana-epoch1064.json). The public Pipe certificate index returned an upstream reset (solana-certs-index.json). Neither is accepted evidence.

`spl_token.so` is the RPC-observed Tokenkeg ProgramData executable, address 3gvYRKWyXRR9xKWe1ZjPhLY5ZJRN7KDB4rFZFGoJfFk2, removing the 45-byte upgradeable-loader metadata. Its bytes are checked against the archived account. RPC provenance does not independently authenticate account state. SVM tests execute these exact bytes and the built gateway.

Controlled fixtures use deterministic PUBLIC TEST-ONLY seeds in scripts/solana/make_controlled.py. Four synthetic vote accounts with stake 40/30/20/10 are not mainnet validators. The controlled code hash is the checked-in compiled gateway artifact. No deployment keypair is included. crypto-vectors.bin contains 20 independent OpenSSL Ed25519/SHA-512 vectors, including packet/signature boundaries.

Reproduce offline from repository root:

```sh
python -m pip install -r scripts/solana/requirements.txt
python scripts/solana/verify_history.py
python scripts/solana/observe_stake.py
python scripts/solana/make_controlled.py
sha256sum -c contracts/test/fixtures/solana/SHA256SUMS
```

SHA256SUMS covers all evidence and generated vectors, except this manifest itself. Reproduction must leave every digest unchanged. These checks prove signature/wire facts, not execution or finality.
