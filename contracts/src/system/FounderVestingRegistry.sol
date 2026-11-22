// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Three founder grants share one million native $420: half liquid directly
/// at Genesis, half held at this immutable 0x0427 predeploy for 13 biweekly releases.
/// @dev This contract must hold 500,000 native $420 at Genesis; liquid founder shares
/// are distributed separately to the same independently verified founder wallets.
contract FounderVestingRegistry is SystemAccess, I420System {
    uint256 public constant FOUNDER_COUNT = 3;
    uint256 public constant TOTAL_FOUNDER_ALLOCATION = 1_000_000 ether;
    uint256 public constant TOTAL_LOCKED_ALLOCATION = 500_000 ether;
    uint256 public constant TOTAL_LIQUID_ALLOCATION = 500_000 ether;
    uint256 public constant RELEASES = 13;
    uint256 public constant INTERVAL = 14 days;

    struct Grant { address beneficiary; uint64 startTime; uint256 claimed; }
    Grant[3] public grants;
    uint256 public totalLockedClaimed;

    error InvalidFounderWallet();
    error InvalidGenesisStartTime();
    error DirectDepositDisabled();
    error InvalidFounderIndex();
    error UnauthorizedBeneficiary();
    error NothingClaimable();
    error TransferFailed();
    event FounderVestClaimed(uint256 indexed index, address indexed beneficiary, uint256 amount, uint256 cumulativeClaimed);

    constructor(address timelock_, address[3] memory beneficiaries, uint64 startTime)
        SystemAccess(timelock_)
    {
        // A forgotten or backdated start would allow funds to unlock before
        // the actual 182-day Genesis vesting window. The release verifier
        // additionally pins this timestamp to the signed network Genesis.
        if (startTime == 0 || uint256(startTime) < block.timestamp) revert InvalidGenesisStartTime();
        for (uint256 i; i < FOUNDER_COUNT; ++i) {
            address wallet = beneficiaries[i];
            if (wallet == address(0)) revert InvalidFounderWallet();
            for (uint256 j; j < i; ++j) if (beneficiaries[j] == wallet) revert InvalidFounderWallet();
            uint160 raw = uint160(wallet);
            if ((raw >= 0x041f && raw <= 0x04ff) || raw == type(uint160).max - 1)
                revert InvalidFounderWallet();
            grants[i] = Grant(wallet, startTime, 0);
        }
    }

    // Genesis funding is an allocation at the exact 0x0427 predeploy, not an
    // application-revenue deposit. Runtime native contributions fail closed.
    receive() external payable { revert DirectDepositDisabled(); }
    function systemName() external pure returns (string memory) { return "FounderVestingRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    /// @notice 0=administrator (50%), 1=Andrew (25%), 2=Janet (25%).
    function lockedAllocation(uint256 index) public pure returns (uint256) {
        if (index >= FOUNDER_COUNT) revert InvalidFounderIndex();
        return index == 0 ? 250_000 ether : 125_000 ether;
    }
    function liquidGenesisAllocation(uint256 index) external pure returns (uint256) {
        if (index >= FOUNDER_COUNT) revert InvalidFounderIndex();
        return index == 0 ? 250_000 ether : 125_000 ether;
    }
    function vested(uint256 index, uint256 timestamp) public view returns (uint256) {
        if (index >= FOUNDER_COUNT) revert InvalidFounderIndex();
        Grant memory g = grants[index];
        if (timestamp < uint256(g.startTime) + INTERVAL) return 0;
        uint256 releases = (timestamp - uint256(g.startTime)) / INTERVAL;
        uint256 amount = lockedAllocation(index);
        if (releases >= RELEASES) return amount;
        return amount * releases / RELEASES;
    }
    function claimable(uint256 index) public view returns (uint256) {
        uint256 v = vested(index, block.timestamp);
        uint256 paid = grants[index].claimed;
        return v > paid ? v - paid : 0;
    }
    function claim(uint256 index) external {
        if (index >= FOUNDER_COUNT) revert InvalidFounderIndex();
        Grant storage g = grants[index];
        if (msg.sender != g.beneficiary) revert UnauthorizedBeneficiary();
        uint256 amount = claimable(index);
        if (amount == 0) revert NothingClaimable();
        g.claimed += amount;
        totalLockedClaimed += amount;
        (bool ok,) = payable(g.beneficiary).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit FounderVestClaimed(index, g.beneficiary, amount, g.claimed);
    }
}
