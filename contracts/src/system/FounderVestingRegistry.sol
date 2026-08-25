
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Immutable founder vesting schedule.
/// Ten grants of 100,000 420 are expected at genesis. Each grant has 50,000 liquid at genesis
/// outside this contract and 50,000 vested here over 13 releases / 182 days.
/// Beneficiary addresses are supplied only at deployment/genesis and cannot be changed.
contract FounderVestingRegistry is SystemAccess, I420System {
    uint256 public constant FOUNDER_COUNT = 10;
    uint256 public constant LOCKED_PER_FOUNDER = 50_000 ether;
    uint256 public constant RELEASES = 13;
    uint256 public constant INTERVAL = 14 days;

    struct Grant {
        address beneficiary;
        uint64 startTime;
        uint256 claimed;
    }

    Grant[10] public grants;

    constructor(address timelock_, address[10] memory beneficiaries, uint64 startTime)
        SystemAccess(timelock_)
    {
        for (uint256 i; i < FOUNDER_COUNT; ++i) {
            require(beneficiaries[i] != address(0), "zero beneficiary");
            grants[i] = Grant(beneficiaries[i], startTime, 0);
        }
    }

    receive() external payable {}

    function systemName() external pure returns (string memory) { return "FounderVestingRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function vested(uint256 index, uint256 timestamp) public view returns (uint256) {
        Grant memory g = grants[index];
        if (timestamp < g.startTime + INTERVAL) return 0;
        uint256 elapsedReleases = (timestamp - g.startTime) / INTERVAL;
        if (elapsedReleases > RELEASES) elapsedReleases = RELEASES;
        if (elapsedReleases == RELEASES) return LOCKED_PER_FOUNDER;
        return (LOCKED_PER_FOUNDER / RELEASES) * elapsedReleases;
    }

    function claimable(uint256 index) public view returns (uint256) {
        uint256 v = vested(index, block.timestamp);
        return v > grants[index].claimed ? v - grants[index].claimed : 0;
    }

    function claim(uint256 index) external {
        Grant storage g = grants[index];
        require(msg.sender == g.beneficiary, "beneficiary only");
        uint256 amount = claimable(index);
        require(amount != 0, "nothing claimable");
        g.claimed += amount;
        (bool ok,) = payable(g.beneficiary).call{value: amount}("");
        require(ok, "transfer failed");
    }
}
