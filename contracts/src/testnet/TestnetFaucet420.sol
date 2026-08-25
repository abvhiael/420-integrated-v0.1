
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice TESTNET ONLY. Testnet 420 has no monetary value.
contract TestnetFaucet420 {
    uint256 public constant AMOUNT = 42 ether;
    uint256 public constant COOLDOWN = 24 hours;
    address public immutable operator;
    bool public paused;
    mapping(address=>uint256) public lastClaim;

    event Claimed(address indexed account,uint256 amount);
    event Paused(bool paused);

    constructor(address operator_) {
        require(operator_!=address(0),"operator");
        operator=operator_;
    }

    receive() external payable {}

    function setPaused(bool value) external {
        require(msg.sender==operator,"operator");
        paused=value;emit Paused(value);
    }

    function claim() external {
        require(!paused,"paused");
        require(block.timestamp>=lastClaim[msg.sender]+COOLDOWN,"cooldown");
        require(address(this).balance>=AMOUNT,"empty");
        lastClaim[msg.sender]=block.timestamp;
        (bool ok,)=payable(msg.sender).call{value:AMOUNT}("");
        require(ok,"transfer");
        emit Claimed(msg.sender,AMOUNT);
    }
}
