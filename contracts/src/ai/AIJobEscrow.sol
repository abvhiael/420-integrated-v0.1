
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

contract AIJobEscrow is SystemAccess, I420System {
    struct Escrow {
        address payer;
        bytes32 providerId;
        uint256 amount;
        bool released;
    }
    mapping(bytes32 => Escrow) public escrows;

    event Funded(bytes32 indexed jobId, address indexed payer, bytes32 indexed providerId, uint256 amount);
    event Released(bytes32 indexed jobId, address indexed to, uint256 amount);
    event Refunded(bytes32 indexed jobId, address indexed to, uint256 amount);

    constructor(address timelock_) SystemAccess(timelock_) {}
    function systemName() external pure returns (string memory) { return "AIJobEscrow"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function fund(bytes32 jobId, bytes32 providerId) external payable {
        require(msg.value > 0 && escrows[jobId].amount == 0, "invalid");
        escrows[jobId] = Escrow(msg.sender, providerId, msg.value, false);
        emit Funded(jobId, msg.sender, providerId, msg.value);
    }

    function release(bytes32 jobId, address payable to) external onlyGovernance {
        Escrow storage e=escrows[jobId];
        require(!e.released && e.amount != 0, "closed");
        e.released=true;
        uint256 amount=e.amount;
        (bool ok,)=to.call{value:amount}("");
        require(ok,"transfer");
        emit Released(jobId,to,amount);
    }

    function refund(bytes32 jobId) external onlyGovernance {
        Escrow storage e=escrows[jobId];
        require(!e.released && e.amount != 0, "closed");
        e.released=true;
        uint256 amount=e.amount;
        (bool ok,)=payable(e.payer).call{value:amount}("");
        require(ok,"transfer");
        emit Refunded(jobId,e.payer,amount);
    }
}
