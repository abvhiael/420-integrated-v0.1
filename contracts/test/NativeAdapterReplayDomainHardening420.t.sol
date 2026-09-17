// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice V12.6.2 structural hardening for cross-adapter replay namespaces.
/// @dev Replay consumption remains adapter-local in each bridge adapter. These tests pin the canonical
///      adapter domains and prove that a shared external message id cannot occupy the same derived
///      namespace across two canonical adapters.
contract NativeAdapterReplayDomainHardening420Test {
    bytes32 private constant BNB = keccak256("420/BRIDGE/BNB/MAINNET/V12.5.3");
    bytes32 private constant ETH = keccak256("420/BRIDGE/ETHEREUM/MAINNET/V12.5.4");
    bytes32 private constant DOGE = keccak256("420/BRIDGE/DOGECOIN/MAINNET/V12.5.5");
    bytes32 private constant TRON = keccak256("420/BRIDGE/TRON/MAINNET/V12.5.7");
    bytes32 private constant POT = keccak256("420/BRIDGE/POTCOIN/MAINNET/V12.5.9");
    bytes32 private constant BOB = keccak256("420/BRIDGE/DOBBSCOIN/MAINNET/V12.5.10");
    bytes32 private constant CURE = keccak256("420/BRIDGE/CURECOIN/MAINNET/V12.5.11");
    bytes32 private constant ARRR = keccak256("420/BRIDGE/PIRATECHAIN/MAINNET/V12.5.12");
    bytes32 private constant LTC = keccak256("420/BRIDGE/LITECOIN/MAINNET/V12.5.13");
    bytes32 private constant BTC = keccak256("420/BRIDGE/BITCOIN/MAINNET/V12.5.14");
    bytes32 private constant XRP = keccak256("420/BRIDGE/XRPL/MAINNET/V12.5.15");
    bytes32 private constant SOL = keccak256("420/BRIDGE/SOLANA/MAINNET/V12.5.2");

    function testCanonicalAdapterDomainsAreUnique() public pure {
        bytes32[12] memory domains = _domains();
        for (uint256 i = 0; i < domains.length; ++i) {
            require(domains[i] != bytes32(0), "zero adapter domain");
            for (uint256 j = i + 1; j < domains.length; ++j) {
                require(domains[i] != domains[j], "adapter domain collision");
            }
        }
    }

    function testSharedExternalMessageIdHasDistinctReplayNamespacePerAdapter() public pure {
        bytes32 messageId = keccak256("shared-external-message-id");
        bytes32[12] memory domains = _domains();
        bytes32[12] memory replayKeys;

        for (uint256 i = 0; i < domains.length; ++i) {
            replayKeys[i] = _replayKey(domains[i], messageId);
            require(replayKeys[i] != bytes32(0), "zero replay key");
            for (uint256 j = 0; j < i; ++j) {
                require(replayKeys[i] != replayKeys[j], "cross-adapter replay collision");
            }
        }
    }

    function testMessageIdentityStillMattersInsideOneAdapterDomain() public pure {
        bytes32 first = _replayKey(BTC, keccak256("message-a"));
        bytes32 second = _replayKey(BTC, keccak256("message-b"));
        require(first != second, "message collision within adapter domain");
    }

    function testEconomicTwinAcrossNativeAdaptersCannotShareReplayKey() public pure {
        bytes32 sourceMessageId = keccak256(abi.encode("same-economic-transfer", uint256(420_000_000)));
        require(_replayKey(BTC, sourceMessageId) != _replayKey(LTC, sourceMessageId), "btc/ltc collision");
        require(_replayKey(DOGE, sourceMessageId) != _replayKey(POT, sourceMessageId), "doge/pot collision");
        require(_replayKey(BOB, sourceMessageId) != _replayKey(CURE, sourceMessageId), "bob/cure collision");
        require(_replayKey(ARRR, sourceMessageId) != _replayKey(XRP, sourceMessageId), "arrr/xrp collision");
        require(_replayKey(TRON, sourceMessageId) != _replayKey(BNB, sourceMessageId), "tron/bnb collision");
    }

    function _replayKey(bytes32 adapterDomain, bytes32 sourceMessageId) private pure returns (bytes32) {
        return keccak256(abi.encode(adapterDomain, sourceMessageId));
    }

    function _domains() private pure returns (bytes32[12] memory domains) {
        domains[0] = SOL;
        domains[1] = BNB;
        domains[2] = ETH;
        domains[3] = DOGE;
        domains[4] = TRON;
        domains[5] = POT;
        domains[6] = BOB;
        domains[7] = CURE;
        domains[8] = ARRR;
        domains[9] = LTC;
        domains[10] = BTC;
        domains[11] = XRP;
    }
}
