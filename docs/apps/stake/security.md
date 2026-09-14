# 420 Stake security

Never disclose validator signing keys, Wallet private keys, recovery secrets or remote-signer credentials. Keep validator signing authority separate from ordinary frontend/session credentials.

Do not rely on a cached Stake/Indexer state for safety-critical signing or withdrawal decisions. Recheck canonical validator lifecycle and consensus state.