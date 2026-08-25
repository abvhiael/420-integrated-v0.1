
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

contract GovernanceTimelock {
    enum Class { G1, G2, G3, G4 }

    address public immutable bootstrapGovernor;
    uint64 public constant G1_DELAY = 7 days;
    uint64 public constant G2_DELAY = 14 days;
    uint64 public constant G3_DELAY = 14 days;
    uint64 public constant G4_DELAY = 42 days;

    struct Operation {
        address target;
        uint256 value;
        bytes data;
        uint64 executeAfter;
        Class class_;
        bool executed;
        bool cancelled;
    }

    mapping(bytes32=>Operation) public operations;

    event Scheduled(bytes32 indexed id,address indexed target,Class class_,uint64 executeAfter);
    event Executed(bytes32 indexed id);
    event Cancelled(bytes32 indexed id);

    constructor(address bootstrapGovernor_) {
        require(bootstrapGovernor_!=address(0),"zero governor");
        bootstrapGovernor=bootstrapGovernor_;
    }

    modifier onlyBootstrapGovernor() {
        require(msg.sender==bootstrapGovernor,"unauthorized");
        _;
    }

    function delayFor(Class c) public pure returns(uint64) {
        if (c==Class.G1) return G1_DELAY;
        if (c==Class.G2) return G2_DELAY;
        if (c==Class.G3) return G3_DELAY;
        return G4_DELAY;
    }

    function schedule(bytes32 id,address target,uint256 value,bytes calldata data,Class class_)
        external
        onlyBootstrapGovernor
    {
        require(operations[id].target==address(0),"exists");
        require(target!=address(0),"target");
        uint64 executeAfter=uint64(block.timestamp)+delayFor(class_);
        operations[id]=Operation(target,value,data,executeAfter,class_,false,false);
        emit Scheduled(id,target,class_,executeAfter);
    }

    function cancel(bytes32 id) external onlyBootstrapGovernor {
        Operation storage op=operations[id];
        require(op.target!=address(0)&&!op.executed,"invalid");
        op.cancelled=true;
        emit Cancelled(id);
    }

    function execute(bytes32 id) external payable returns(bytes memory result) {
        Operation storage op=operations[id];
        require(op.target!=address(0),"unknown");
        require(!op.executed&&!op.cancelled,"closed");
        require(block.timestamp>=op.executeAfter,"timelocked");
        op.executed=true;
        (bool ok,bytes memory out)=op.target.call{value:op.value}(op.data);
        require(ok,"execution failed");
        emit Executed(id);
        return out;
    }

    receive() external payable {}
}
