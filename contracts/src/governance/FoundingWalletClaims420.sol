// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Public-wallet identity claims for the three founder seats, not custody of keys or funds.
/// @dev A successful on-chain claim transaction proves control of the designated EOA/smart-account
/// on THAT chain. A signed off-chain Genesis proof must independently pin chain/plan/recipient.
contract FoundingWalletClaims420 {
    address public immutable administrator;
    address public immutable andrew;
    address public immutable janet;
    bytes32 public immutable genesisPlanCommitment;
    uint256 public immutable deploymentChainId;

    mapping(address => bool) public claimed;
    uint8 public claimedCount;

    error InvalidFounderWallet();
    error UnrecognizedFounder();
    error AlreadyClaimed();
    error WrongDeploymentChain();

    event FounderWalletClaimed(uint8 indexed role, address indexed wallet, bytes32 indexed genesisPlanCommitment);

    constructor(
        address administrator_,
        address andrew_,
        address janet_,
        bytes32 plan_
    ) {
        if (
            administrator_ == address(0) || andrew_ == address(0) || janet_ == address(0) || administrator_ == andrew_
                || administrator_ == janet_ || andrew_ == janet_ || plan_ == bytes32(0) || _reserved(administrator_)
                || _reserved(andrew_) || _reserved(janet_)
        ) {
            revert InvalidFounderWallet();
        }
        administrator = administrator_;
        andrew = andrew_;
        janet = janet_;
        genesisPlanCommitment = plan_;
        deploymentChainId = block.chainid;
    }

    function claimFounderWallet() external {
        // Reject a fork/migration that changes chain ID after this Genesis-bound deployment.
        if (block.chainid != deploymentChainId) revert WrongDeploymentChain();
        uint8 role = roleFor(msg.sender);
        if (role == 0) revert UnrecognizedFounder();
        if (claimed[msg.sender]) revert AlreadyClaimed();
        claimed[msg.sender] = true;
        ++claimedCount;
        emit FounderWalletClaimed(role, msg.sender, genesisPlanCommitment);
    }

    function roleFor(
        address wallet
    ) public view returns (uint8) {
        if (wallet == administrator) return 1;
        if (wallet == andrew) return 2;
        if (wallet == janet) return 3;
        return 0;
    }

    function allFoundersClaimed() external view returns (bool) {
        return claimedCount == 3;
    }

    function _reserved(
        address wallet
    ) private pure returns (bool) {
        uint160 addr = uint160(wallet);
        return addr >= 0x041f && addr <= 0x04ff || uint160(wallet) == type(uint160).max - 1;
    }
}
