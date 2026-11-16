# Genuine TRON historical evidence

Captured from the public mainnet endpoint `https://api.trongrid.io/wallet/` on 2026-11-14 (America/Regina). Raw JSON responses are preserved byte-for-byte. Retrieval labels are not finality authority: signatures, canonical ancestry, genesis SR membership and native solidification are independently checked offline and in Solidity.

| Capture | Request |
| --- | --- |
| `genesis.json` | `getblockbynum?num=0` |
| `blocks-1-100.json` | `getblockbylimitnext?startNum=1&endNum=101` |
| `blocks-N-(N+100).json`, N=100,200,...,1000 | `getblockbylimitnext?startNum=N&endNum=N+100` |

The overlap at height 100 is checked for exact equality. The resulting corpus has 1,099 unique consecutive headers, heights 1–1099, and two native transactions. No transaction changes SR votes, witness membership or permissions. All heights are before the first six-hour maintenance boundary after bootstrap. Genesis is independently serialized and hashed to `00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc`.

`java-tron-mainnet-config.conf` is the unchanged upstream genesis configuration from `tronprotocol/java-tron` commit `b33eed89a6a424c498d4fb1b03ca2c86eddf4840`, `framework/src/main/resources/config.conf` (upstream GPL-3.0 project). The 27 genesis witnesses are listed in decreasing initial vote order. The config SHA-256 is `fb51f5ee508cefb4e0d4b0c1868029e385a997ee9b7468875c9d781d77b0ea2a`. Independent secp256k1 recovery verifies native block signatures against these identities, rather than deriving a trusted roster from arbitrary recovered keys. Bootstrap block 2 uses the protocol's two maintenance skip slots; block 3 onwards uses the ordinary absolute-slot schedule. The Solidity profile starts at the independently authenticated block-2 checkpoint; the offline check anchors that checkpoint back to genesis.

`historical-profile.bin` is ABI-encoded `TronFinalityVerifier420.ProfileInput`. `historical-headers.bin` is `(bytes[] rawHeaders, bytes[] signatures)` for heights 3–1099. `historical-transaction.bin` is the full native protobuf transaction at height 1045. `expected.json` records independently calculated raw-header SHA-256 hashes, block IDs, timestamps, schedule ranks and roots. No fabricated signatures, receipts or bridge memos appear in these files.

The genuine height-1045 payment has transaction ID `21b97f0cdebc560c8533bc532252d0eef8247c3b59e8dfb1c40a2dbb6c8dd3db`, amount 580,000,000,000 sun, and full-transaction leaf/root `3dd7af634513924b570fd8f06d9677411ae4a73e98af4717cd04873f179baade`. Solidity checks the native signed ancestry and 19-distinct-SR finality, then authenticates the transfer against that root. The genuine payment has no bridge memo and is explicitly rejected as a 420Bridge deposit. Controlled bridge-memo deposits live only in Solidity tests and are separately labelled.

Offline reproduction (no network or node authority required):

```sh
python -m pip install -r scripts/tron/requirements.txt
python scripts/tron/verify_history.py
sha256sum -c contracts/test/fixtures/tron/SHA256SUMS
```

`scripts/tron/fetch_history.py` is the explicit online acquisition helper and preserves existing captures. It is not called by qualification. Regeneration must preserve all generated fixture digests; API formatting may differ on a later fresh capture, which requires independent verification and a new provenance record rather than silently replacing this corpus.
