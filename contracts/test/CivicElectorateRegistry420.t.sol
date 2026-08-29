// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/SystemAccess.sol";
import "../src/governance/CivicIds420.sol";
import "../src/governance/ICivicElectorateSource420.sol";
import "../src/governance/CivicElectorateRegistry420.sol";

interface VmCivicElectorate420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function roll(uint256) external;
}

contract MockElectorateSource420 is ICivicElectorateSource420 {
    bytes32 private immutable _type;
    bytes32 public root;
    uint256 public totalWeight;
    mapping(bytes32 => mapping(address => uint256)) public weights;

    constructor(bytes32 type_) {
        _type = type_;
    }

    function sourceType() external pure returns (bytes32) {
        return keccak256("MOCK_ELECTORATE_SOURCE_V1");
    }

    function setSnapshot(bytes32 root_, uint256 totalWeight_) external {
        root = root_;
        totalWeight = totalWeight_;
    }

    function setWeight(bytes32 root_, address voter, uint256 weight) external {
        weights[root_][voter] = weight;
    }

    function snapshotAt(uint64) external view returns (bytes32 electorateRoot, uint256 totalWeight_) {
        return (root, totalWeight);
    }

    function votingWeight(bytes32 electorateRoot, address voter, bytes calldata)
        external
        view
        returns (uint256 weight)
    {
        return weights[electorateRoot][voter];
    }
}

contract CivicElectorateRegistry420Test {
    VmCivicElectorate420 constant vm =
        VmCivicElectorate420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant GOVERNOR = address(0x0437);
    bytes32 constant COMMUNITY_TYPE = keccak256("COMMUNITY_CHECKPOINT_V1");
    bytes32 constant VALIDATOR_TYPE = keccak256("VALIDATOR_SET_V1");
    bytes32 constant ROOT_A = keccak256("ROOT_A");
    bytes32 constant ROOT_B = keccak256("ROOT_B");

    function _source(bytes32, bytes32 root_, uint256 totalWeight_) private returns (MockElectorateSource420 s) {
        s = new MockElectorateSource420(keccak256("MOCK_ELECTORATE_SOURCE_V1"));
        s.setSnapshot(root_, totalWeight_);
    }

    function testOnlyGovernanceCanSetHouseSourceAndRevisionIncrements() public {
        CivicElectorateRegistry420 registry = new CivicElectorateRegistry420(address(this));
        MockElectorateSource420 a = _source(COMMUNITY_TYPE, ROOT_A, 100);
        MockElectorateSource420 b = _source(COMMUNITY_TYPE, ROOT_B, 200);

        vm.prank(ALICE);
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        registry.setHouseSource(CivicIds420.House.COMMUNITY, address(a));

        registry.setHouseSource(CivicIds420.House.COMMUNITY, address(a));
        CivicElectorateRegistry420.SourceConfig memory first = registry.sourceFor(CivicIds420.House.COMMUNITY);
        require(first.source == address(a), "source a");
        require(first.revision == 1, "revision one");

        registry.setHouseSource(CivicIds420.House.COMMUNITY, address(b));
        CivicElectorateRegistry420.SourceConfig memory second = registry.sourceFor(CivicIds420.House.COMMUNITY);
        require(second.source == address(b), "source b");
        require(second.revision == 2, "revision two");
    }

    function testSnapshotFailsClosedWithoutCommunitySource() public {
        CivicElectorateRegistry420 registry = new CivicElectorateRegistry420(address(this));
        registry.bindSnapshotAuthority(GOVERNOR);
        vm.roll(100);

        vm.prank(GOVERNOR);
        vm.expectRevert(CivicElectorateRegistry420.SourceNotConfigured.selector);
        registry.snapshotProposal(keccak256("P1"), 99, false);
    }

    function testSnapshotIsImmutableAcrossSourceUpgrade() public {
        CivicElectorateRegistry420 registry = new CivicElectorateRegistry420(address(this));
        MockElectorateSource420 a = _source(COMMUNITY_TYPE, ROOT_A, 100);
        MockElectorateSource420 b = _source(COMMUNITY_TYPE, ROOT_B, 200);
        a.setWeight(ROOT_A, ALICE, 10);
        b.setWeight(ROOT_B, ALICE, 99);

        registry.setHouseSource(CivicIds420.House.COMMUNITY, address(a));
        registry.bindSnapshotAuthority(GOVERNOR);
        vm.roll(100);

        bytes32 p1 = keccak256("P1");
        vm.prank(GOVERNOR);
        registry.snapshotProposal(p1, 99, false);

        registry.setHouseSource(CivicIds420.House.COMMUNITY, address(b));

        CivicElectorateRegistry420.ProposalSnapshot memory snap = registry.proposalSnapshot(p1);
        require(snap.community.source == address(a), "frozen source");
        require(snap.community.sourceRevision == 1, "frozen revision");
        require(snap.community.electorateRoot == ROOT_A, "frozen root");
        require(snap.community.totalWeight == 100, "frozen total");
        require(registry.votingWeight(p1, CivicIds420.House.COMMUNITY, ALICE, "") == 10, "old source weight");

        vm.prank(GOVERNOR);
        vm.expectRevert(CivicElectorateRegistry420.SnapshotExists.selector);
        registry.snapshotProposal(p1, 99, false);
    }

    function testDualHouseRequiresAndFreezesValidatorElectorate() public {
        CivicElectorateRegistry420 registry = new CivicElectorateRegistry420(address(this));
        MockElectorateSource420 community = _source(COMMUNITY_TYPE, ROOT_A, 1000);
        MockElectorateSource420 validators = _source(VALIDATOR_TYPE, ROOT_B, 30);

        registry.setHouseSource(CivicIds420.House.COMMUNITY, address(community));
        registry.bindSnapshotAuthority(GOVERNOR);
        vm.roll(200);

        bytes32 p1 = keccak256("DUAL");
        vm.prank(GOVERNOR);
        vm.expectRevert(CivicElectorateRegistry420.SourceNotConfigured.selector);
        registry.snapshotProposal(p1, 199, true);

        registry.setHouseSource(CivicIds420.House.VALIDATOR, address(validators));
        vm.prank(GOVERNOR);
        registry.snapshotProposal(p1, 199, true);

        CivicElectorateRegistry420.ProposalSnapshot memory snap = registry.proposalSnapshot(p1);
        require(snap.dualHouseRequired, "dual house");
        require(snap.community.totalWeight == 1000, "community total");
        require(snap.validator.totalWeight == 30, "validator total");
        require(snap.validator.electorateRoot == ROOT_B, "validator root");
    }

    function testSingleHouseProposalRejectsValidatorWeightQuery() public {
        CivicElectorateRegistry420 registry = new CivicElectorateRegistry420(address(this));
        MockElectorateSource420 community = _source(COMMUNITY_TYPE, ROOT_A, 1000);
        registry.setHouseSource(CivicIds420.House.COMMUNITY, address(community));
        registry.bindSnapshotAuthority(GOVERNOR);
        vm.roll(50);

        bytes32 p1 = keccak256("COMMUNITY_ONLY");
        vm.prank(GOVERNOR);
        registry.snapshotProposal(p1, 49, false);

        vm.expectRevert(CivicElectorateRegistry420.HouseNotRequired.selector);
        registry.votingWeight(p1, CivicIds420.House.VALIDATOR, ALICE, "");
    }

    function testSnapshotRejectsFutureBlockAndEmptyElectorate() public {
        CivicElectorateRegistry420 registry = new CivicElectorateRegistry420(address(this));
        MockElectorateSource420 community = _source(COMMUNITY_TYPE, bytes32(0), 0);
        registry.setHouseSource(CivicIds420.House.COMMUNITY, address(community));
        registry.bindSnapshotAuthority(GOVERNOR);
        vm.roll(100);

        vm.prank(GOVERNOR);
        vm.expectRevert(CivicElectorateRegistry420.InvalidSnapshot.selector);
        registry.snapshotProposal(keccak256("FUTURE"), 100, false);

        vm.prank(GOVERNOR);
        vm.expectRevert(CivicElectorateRegistry420.InvalidSnapshot.selector);
        registry.snapshotProposal(keccak256("EMPTY"), 99, false);
    }
}
