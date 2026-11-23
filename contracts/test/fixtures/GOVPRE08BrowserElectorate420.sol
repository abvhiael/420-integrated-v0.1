// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

// GOVERNANCE QUALIFICATION ONLY: deterministic source for a disposable local
// EVM account trie, never a production electorate or live Genesis component.
import "../../src/governance/ICivicElectorateSource420.sol";

contract GOVPRE08BrowserElectorate420 is ICivicElectorateSource420 {
    bytes32 public immutable electorateRoot;
    bytes32 public immutable electorateKind;
    uint256 public immutable totalWeight;
    address public immutable primaryVoter;
    address public immutable secondaryVoter;
    uint256 public immutable primaryWeight;
    uint256 public immutable secondaryWeight;

    constructor(
        bytes32 kind_, bytes32 root_, address first_, uint256 firstWeight_,
        address second_, uint256 secondWeight_
    ) {
        require(kind_!=bytes32(0) && root_!=bytes32(0) &&
            first_!=address(0) && second_!=first_ && firstWeight_>0 &&
            firstWeight_+secondWeight_>0,"invalid local electorate");
        electorateKind=kind_;
        electorateRoot=root_;
        primaryVoter=first_;
        secondaryVoter=second_;
        primaryWeight=firstWeight_;
        secondaryWeight=secondWeight_;
        totalWeight=firstWeight_+secondWeight_;
    }

    function sourceType() external view returns (bytes32) {return electorateKind;}
    function snapshotAt(uint64) external view returns (bytes32,uint256) {
        return (electorateRoot,totalWeight);
    }
    function votingWeight(bytes32 root_, address voter, bytes calldata proof)
        external view returns (uint256) {
        require(root_==electorateRoot && keccak256(proof)==keccak256(bytes("")),"wrong proof");
        if(voter==primaryVoter)return primaryWeight;
        if(voter==secondaryVoter)return secondaryWeight;
        return 0;
    }
}
