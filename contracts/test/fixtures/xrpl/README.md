# Genuine XRPL native validated-ledger evidence

Captured 2026-11-14 (America/Regina) from public mainnet services. No JSON `validated` flag supplies finality authority. The retained binary validation messages and cryptographic roots are independently verified offline and in Solidity.

| File | Source / purpose |
| --- | --- |
| `ripple-vl.json` | Raw signed validator list from `https://vl.ripple.com` |
| `foundation-vl.json` | Raw signed validator list from `https://vl.xrplf.org` |
| `upstream-validators-example.txt` | Pinned `XRPLF/rippled@3c72fb540d239463d2a4e071d6f71200c3abb5f4`, `cfg/validators-example.txt`; authentic mainnet publisher-key configuration |
| `validations.json` | 105 captured public messages for one ledger from `wss://s1.ripple.com`; subscribe request `{"id":1,"command":"subscribe","streams":["validations"],"validation_full":true}`. Native canonical `data` bytes are retained. Duplicate and unlisted messages are not counted as quorum. |
| `ledger.json` | Raw `https://xrplcluster.com` JSON-RPC `ledger` request with `ledger_index:"validated", transactions:true, expand:true, binary:true`; exact returned ledger fixed below and verified by hash |
| `historical-*.bin` | Deterministic native/ABI fixtures generated from the above signed evidence |
| `expected.json` | Independent publisher/quorum/hash/root/payment/account/tag results |
| `controlled-*.bin` | Explicit PUBLIC TEST-ONLY native validations/payments and malicious cases; deterministic test seeds in `make_controlled.py`; not mainnet evidence |
| `sha512half-vectors.bin` | 21 independent Python/OpenSSL SHA-512Half vectors, including padding boundaries and 4,096-byte input |

Ledger **108335815**, hash `57AAE73205466CC58B797BA8BE06286D5B7A26DADD7F990C6782DA7C259D669E`, has transaction root `E1207021132D869E0742C02C1C966712686F70049E3669FC85AE2B58454BAD33`. Both independently authenticated publisher lists agree on 35 trusted masters and their signed current manifest bindings. There are **34 distinct trusted native full validations**, exceeding the **28-of-35** quorum. Publisher manifests, publisher list signatures, validator manifest master/signing signatures and native full-validation signatures are checked independently. The proof does not infer a UNL from recovered keys.

Publisher master pins, matching the pinned upstream mainnet configuration:

- Ripple: `ED2677ABFFD1B33AC6FBC3062B71F1E8397C1505E1C42C64D11AD1B28FF73F4734`.
- XRPL Foundation: `ED42AEC58B701EEBB77356FFFEC26F83C1F0407263530F068C7C73D392C7E06FD1`.

All 74 full transaction+metadata leaves are used to reconstruct the actual 16-way SHAMap root. The selected successful native payment has transaction hash `F3F79B9F3230A7823BE46802A433ABA2AD046262811C9655D7E909DCF88A5399`, **24,809,848 drops**, and explicit destination tag **282161781**. Its destination AccountID is `CFA3536F5D67DD960240D14D9AF13517551E57FF`; source `D528B62DC7AF16417C9F44AAD8C04D920A3A705F`. Offline verification independently checks `tesSUCCESS` and the recipient's committed balance increase. Solidity verifies native full-validation quorum, ledger hash, two-level SHAMap path, transaction/metadata interpretation, accounts, drops and tag. The ordinary historical payment has no bridge memo and is rejected as a 420Bridge deposit.

`historical-profile.bin`: ABI `XrplFinalityVerifier420.ProfileInput`. `historical-header.bin`: native 118-byte ledger header. `historical-validations.bin`: ABI `(bytes[])` of 34 unique trusted full native validation messages, ordered by the profile's signing keys. `historical-payment.bin`: ABI `(bytes transaction,bytes metadata,bytes32[16][] nodes)`; nodes are full inner-node child hashes in root-to-leaf order.

Offline reproduction:

```sh
python -m pip install -r scripts/xrpl/requirements.txt
python scripts/xrpl/verify_history.py
python scripts/xrpl/make_controlled.py
sha256sum -c contracts/test/fixtures/xrpl/SHA256SUMS
```

Online acquisition is separate: `scripts/xrpl/fetch_history.py` preserves the existing corpus and uses only public read-only endpoints. A new capture in a fresh output folder is a new evidence set requiring its own signature/roster/quorum verification; it does not silently replace this qualified ledger. A current publisher list must never be treated as authority for an unrelated historical or future validator roster.
