// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library ExchangeTypes420 {
    enum AssetCategory {
        NONE,
        NATIVE_420,
        CANNABIS,
        MAJOR,
        STABLECOIN,
        COUNTERCULTURE,
        SCIENCE_COMPUTE,
        MEME_WEIRD,
        ECOSYSTEM,
        OTHER
    }

    enum AssetStatus {
        NONE,
        PLACEHOLDER,
        PENDING,
        VERIFIED,
        SUSPENDED,
        DELISTING,
        DELISTED,
        UNVERIFIED
    }

    enum MarketStatus {
        NONE,
        PLACEHOLDER,
        PENDING,
        ACTIVE,
        SUSPENDED,
        DELISTING,
        DELISTED
    }

    enum ModerationReason {
        NONE,
        SPAM,
        IMPERSONATION,
        MALICIOUS_TRANSFER,
        HONEYPOT,
        ABANDONED,
        BROKEN_BRIDGE,
        FAKE_ASSET,
        SECURITY_INCIDENT,
        LIQUIDITY_FAILURE,
        PROVENANCE_UNRESOLVED,
        OTHER
    }
}
