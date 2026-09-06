# 420 execution genesis

The canonical execution genesis is `execution-genesis.json`.

Current fork posture:
- chain ID = 420;
- Shanghai active at genesis;
- Cancun active at genesis;
- Prague deliberately deferred so Engine V3 remains valid;
- terminal total difficulty = 0;
- gas limit = 30,000,000;
- initial base fee = 1 gwei = 1 dab/gas.

## 420-native P-256 rule

node420 additionally enables the pinned go-ethereum v1.17.5 `p256Verify` native precompile at `0x0000000000000000000000000000000000000100` under Cancun rules. Upstream v1.17.5 contains this implementation but normally activates it only in the Osaka precompile table. The maintained 420 execution patch moves only that verifier forward and also keeps it present if Prague is later activated; it does not activate Prague or Osaka generally.

`0x0100` is a native precompile, not a genesis account predeploy. It MUST NOT receive `alloc.code`. The node420 release gate proves the consensus-visible precompile activation against the exact pinned upstream commit.

Release qualification still requires pinned go-ethereum v1.17.5 to accept this exact file with `geth init` and pass the maintained node420 execution patch gate.
