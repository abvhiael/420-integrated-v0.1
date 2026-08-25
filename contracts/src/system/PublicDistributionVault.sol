
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Holds the 12.6M 420 public/liquidity allocation.
/// Release schedule is immutable: 4.2M genesis tranche, 4.2M after 180 days,
/// 4.2M after 365 days. Sale-eligible release is capped at 100,000 420/day.
contract PublicDistributionVault is SystemAccess, I420System {
    uint256 public constant TOTAL = 12_600_000 ether;
    uint256 public constant TRANCHE = 4_200_000 ether;
    uint256 public constant DAILY_CAP = 100_000 ether;

    uint64 public immutable genesisTime;
    uint256 public released;
    mapping(uint64 => uint256) public releasedByDay;

    event DistributionReleased(address indexed to,uint256 amount,uint64 dayIndex);

    constructor(address timelock_,uint64 genesisTime_) SystemAccess(timelock_) {
        genesisTime=genesisTime_;
    }

    receive() external payable {}

    function systemName() external pure returns (string memory) { return "PublicDistributionVault"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function unlockedAt(uint256 timestamp) public view returns(uint256) {
        uint256 unlocked=TRANCHE;
        if (timestamp>=uint256(genesisTime)+180 days) unlocked+=TRANCHE;
        if (timestamp>=uint256(genesisTime)+365 days) unlocked+=TRANCHE;
        return unlocked;
    }

    function release(address payable to,uint256 amount) external onlyGovernance {
        require(to!=address(0)&&amount!=0,"invalid");
        uint256 unlocked=unlockedAt(block.timestamp);
        require(released+amount<=unlocked,"tranche locked");
        uint64 dayIndex=uint64((block.timestamp-genesisTime)/1 days);
        require(releasedByDay[dayIndex]+amount<=DAILY_CAP,"daily cap");
        require(address(this).balance>=amount,"insufficient");
        released+=amount;
        releasedByDay[dayIndex]+=amount;
        (bool ok,)=to.call{value:amount}("");
        require(ok,"transfer");
        emit DistributionReleased(to,amount,dayIndex);
    }
}
