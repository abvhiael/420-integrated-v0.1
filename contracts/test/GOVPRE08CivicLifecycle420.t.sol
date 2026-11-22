// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

// GOV-PRE-08 Step 3: exercise actual Civic and Treasury contracts within the
// qualified 14-module funded local graph. The electorate source and actors are
// deliberately synthetic; this is NOT founder approval or live V4 activation.
import "./GOVPRE08LocalFunding420.t.sol";
import "../src/governance/CivicIds420.sol";
import "../src/governance/CivicElectorateRegistry420.sol";
import "../src/governance/CivicConstitution420.sol";
import "../src/governance/CivicProposalRegistry420.sol";
import "../src/governance/CivicVoting420.sol";
import "../src/governance/ICivicElectorateSource420.sol";

interface VmPre08Civic {
    function roll(uint256 newHeight) external;
}

contract GOVPRE08LocalElectorateSource420 is ICivicElectorateSource420 {
    bytes32 public immutable electorateRoot;
    uint256 public immutable totalWeight;
    mapping(address => uint256) public weights;

    constructor(bytes32 root_, uint256 total_) {
        require(root_ != bytes32(0) && total_ > 0, "fixture electorate");
        electorateRoot = root_;
        totalWeight = total_;
    }
    function sourceType() external pure returns (bytes32) {
        return keccak256("GOV-PRE-08/SYNTHETIC/LOCAL-ELECTORATE");
    }
    function setWeight(address account, uint256 weight) external {
        weights[account] = weight;
    }
    function snapshotAt(uint64) external view returns (bytes32, uint256) {
        return (electorateRoot, totalWeight);
    }
    function votingWeight(bytes32 root_, address voter, bytes calldata)
        external view returns (uint256) {
        return root_ == electorateRoot ? weights[voter] : 0;
    }
}

contract GOVPRE08CivicLifecycle420Test is GOVPRE08LocalFunding420Test {
    VmPre08Civic private constant civicVm =
        VmPre08Civic(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant POLICY_ASSET = address(0xD00D);

    function _configureActualCivicGraph()
        private returns (CivicVoting420 voting, CivicProposalRegistry420 proposalRegistry) {
        CivicConstitution420 constitution = civic.constitution();
        proposalRegistry = civic.proposalRegistry();
        CivicElectorateRegistry420 electors = civic.electorateRegistry();
        voting = civic.voting();
        GOVPRE08LocalElectorateSource420 community =
            new GOVPRE08LocalElectorateSource420(keccak256("LOCAL/COMMUNITY"), 100);
        GOVPRE08LocalElectorateSource420 validators =
            new GOVPRE08LocalElectorateSource420(keccak256("LOCAL/VALIDATORS"), 10);
        community.setWeight(ADMIN, 60);
        validators.setWeight(ANDREW, 7);

        vm.prank(TIME);
        electors.setHouseSource(CivicIds420.House.COMMUNITY, address(community));
        vm.prank(TIME);
        electors.setHouseSource(CivicIds420.House.VALIDATOR, address(validators));
        vm.prank(TIME);
        constitution.setRule(CivicIds420.ProposalClass.G1, 5, 7 days, 5000, 6000, 5000, 6000, true);
        vm.prank(TIME);
        proposalRegistry.bindProposalAuthority(address(civic));
        vm.prank(TIME);
        electors.bindSnapshotAuthority(address(civic));
        require(!timelock.civicAuthorityActivated(), "test must start from unactivated Genesis");
    }

    function _actions() private view returns (CivicGovernor420.Action[] memory a) {
        a = new CivicGovernor420.Action[](1);
        a[0] = CivicGovernor420.Action({
            target: address(policy), value: 0,
            data: abi.encodeCall(policy.setAssetPolicy, (POLICY_ASSET, true, uint128(123), uint128(456), uint64(1 days)))
        });
    }

    function _proposal(CivicGovernor420.Action[] memory a) private returns (bytes32 id) {
        civicVm.roll(100);
        vm.prank(ADMIN);
        id = civic.createProposal(CivicIds420.ProposalClass.G1, keccak256("PRE08/LOCAL/POLICY"),
                                  civic.hashActions(a));
    }

    function _rejected(address target, bytes memory calldata_) private {
        (bool ok,) = target.call(calldata_);
        require(!ok, "unauthorized or premature operation succeeded");
    }

    function testRealDualHouseVoteTimelockTreasuryPolicyAndReplayDenial() public {
        (CivicVoting420 voting, CivicProposalRegistry420 proposals) = _configureActualCivicGraph();
        CivicGovernor420.Action[] memory actions = _actions();
        bytes32 id = _proposal(actions);

        require(!policy.isAllowed(POLICY_ASSET, 1), "policy must be default deny");
        require(graphDigest != bytes32(0), "fourteen-source contract graph not constructed");
        _rejected(address(voting),
            abi.encodeCall(voting.castVote, (id, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, bytes(""))));

        civicVm.roll(101);
        vm.prank(ADMIN);
        require(voting.castVote(id, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "") == 60,
                "real local founder-community ballot rejected");
        vm.prank(ANDREW);
        require(voting.castVote(id, CivicIds420.House.VALIDATOR, CivicVoting420.Support.FOR, "") == 7,
                "real local founder-validator ballot rejected");
        vm.prank(ADMIN);
        _rejected(address(voting),
            abi.encodeCall(voting.castVote, (id, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, bytes(""))));
        _rejected(address(civic), abi.encodeCall(civic.finalize, (id)));

        civicVm.roll(106);
        require(civic.finalize(id), "two-house proposal should pass");
        (,,,,,,, CivicIds420.ProposalState state,) = proposals.proposals(id);
        require(state == CivicIds420.ProposalState.PASSED, "proposal not in PASSED state");
        _rejected(address(civic), abi.encodeCall(civic.queue, (id, actions)));
        vm.prank(BOOTSTRAP_GOVERNOR);
        timelock.activateCivicAuthority(address(civic));
        require(timelock.scheduler() == address(civic), "Civic did not receive scheduler authority");
        CivicGovernor420.Action[] memory wrong = _actions();
        wrong[0].data = abi.encodeCall(policy.setAssetPolicy, (POLICY_ASSET, false, uint128(123), uint128(456), uint64(1 days)));
        _rejected(address(civic), abi.encodeCall(civic.queue, (id, wrong)));
        require(civic.queue(id, actions) == 0, "nonzero Treasury policy action value");
        _rejected(address(timelock), abi.encodeCall(timelock.execute, (id)));

        vm.warp(block.timestamp + 7 days + 1);
        timelock.execute(id);
        require(policy.isAllowed(POLICY_ASSET, 123), "Treasury policy not changed by actual Civic dispatch");
        require(!policy.isAllowed(POLICY_ASSET, 124), "policy cap was bypassed");
        TreasuryPolicyRegistry420.AssetPolicy memory actual = policy.assetPolicy(POLICY_ASSET);
        require(actual.revision == 1 && actual.maxEpochDisbursement == 456,
                "Treasury policy state not committed");
        (,,,,,,, state,) = proposals.proposals(id);
        require(state == CivicIds420.ProposalState.EXECUTED, "Civic proposal not executed");
        require(civic.dualHouseExecutedCount() == 1, "dual-house execution evidence missing");
        require(!civic.activeDualHouseExecution(), "transient Civic authority leaked across transaction");
        _rejected(address(timelock), abi.encodeCall(timelock.execute, (id)));
        _rejected(address(civic), abi.encodeCall(civic.queue, (id, actions)));
        require(address(opsVault).balance == 4_200_000 ether
                && address(contingencyVault).balance == 840_000 ether,
                "Civic vote silently changed Genesis Vault custody");
    }

    function testFailedValidatorHouseCannotMutateTreasuryOrQueue() public {
        (CivicVoting420 voting, CivicProposalRegistry420 proposals) = _configureActualCivicGraph();
        CivicGovernor420.Action[] memory actions = _actions();
        bytes32 id = _proposal(actions);
        civicVm.roll(101);
        vm.prank(ADMIN);
        voting.castVote(id, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
        vm.prank(ANDREW);
        voting.castVote(id, CivicIds420.House.VALIDATOR, CivicVoting420.Support.AGAINST, "");
        civicVm.roll(106);
        require(!civic.finalize(id), "validator veto should fail proposal");
        (,,,,,,, CivicIds420.ProposalState state,) = proposals.proposals(id);
        require(state == CivicIds420.ProposalState.FAILED, "failed proposal state drift");
        vm.prank(BOOTSTRAP_GOVERNOR);
        timelock.activateCivicAuthority(address(civic));
        _rejected(address(civic), abi.encodeCall(civic.queue, (id, actions)));
        require(!policy.isAllowed(POLICY_ASSET, 1) && civic.dualHouseExecutedCount() == 0,
                "failed proposal moved Treasury or execution count");
    }
}
