// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./StakeValidatorGenesis420.t.sol";

// Deliberately reuse the qualified setup and lifecycle helpers. The security driver
// selects only testSecurity*; the original owner remains qualified separately.
contract SecurityWithdrawalReceiver420 {
    ValidatorRegistry public registry;
    bytes32 public id;
    bool public replaySucceeded;
    uint256 public received;
    function withdraw(ValidatorRegistry r, bytes32 validatorId) external {
        registry=r; id=validatorId; r.withdrawBond(validatorId);
    }
    receive() external payable {
        received += msg.value;
        (replaySucceeded,) = address(registry).call(abi.encodeWithSelector(registry.withdrawBond.selector,id));
    }
}
contract StakeFinalSecurity420Test is StakeValidatorGenesis420Test {
    function testSecurityGovernanceAndOutsidersCannotForgeRewardOrSlash() public {
        (bytes32 id,) = _registerSelfFunded("security-authority", 41);
        address[] memory participants = new address[](0);
        for (uint256 i; i < 2; ++i) {
            address actor = i == 0 ? address(this) : address(0xBAD);
            vm.prank(actor);
            (bool reward,) = address(rewards).call(abi.encodeWithSelector(rewards.applyConsensusReward.selector, uint64(block.number), actor, participants, 1, 2, 3, 4));
            require(!reward, "forged reward");
            vm.prank(actor);
            (bool slash,) = address(registry).call(abi.encodeWithSelector(registry.applySlash.selector, id, ValidatorRegistry.SlashOffense.FINALITY_EQUIVOCATION, uint8(0), 42_000 ether, 0, keccak256("forged"), ValidatorRegistry.Status.SUSPENDED));
            require(!slash, "forged slash");
            vm.prank(actor);
            (bool exit,) = address(registry).call(abi.encodeWithSelector(registry.applyExitNotice.selector, id, uint64(1)));
            require(!exit, "forged exit notice");
        }
        require(registry.getValidator(id).ownedBond == 42_000 ether, "collateral moved");
        require(rewards.validatorAccrued(address(this)) == 0, "reward accrued");
        require(!registry.slashEvidenceApplied(keccak256("forged")), "evidence consumed");
    }
    function testSecurityOutsiderCannotSpendReserveOrChangeBindings() public {
        uint256 beforeBalance = address(reserve).balance;
        vm.prank(address(0xBAD));
        (bool spend,) = address(reserve).call(abi.encodeWithSelector(reserve.treasuryTransfer.selector, payable(address(0xBAD)), 1 ether, bytes32(0)));
        require(!spend && address(reserve).balance == beforeBalance, "reserve stolen");
        vm.prank(address(0xBAD));
        (bool bind,) = address(registry).call(abi.encodeWithSelector(registry.bindConsensusSystemCaller.selector, address(0xBAD)));
        require(!bind, "binding changed");
    }
    function testSecurityWithdrawalCallbackCannotWithdrawTwice() public {
        SecurityWithdrawalReceiver420 receiver = new SecurityWithdrawalReceiver420();
        bytes32 id = keccak256("security-reentrant-withdrawal");
        vm.deal(address(this), 42_000 ether);
        bytes memory pubkey = new bytes(48); pubkey[0]=bytes1(uint8(1));
        registry.register{value:42_000 ether}(id,pubkey,address(receiver),bytes32(0));
        vm.prank(SYSTEM_CALLER);
        registry.applyConsensusState(id,ValidatorRegistry.Status.PROBATION,1,0,0,0);
        vm.roll(uint256(registry.getValidator(id).registrationBlock)+registry.ACTIVATION_DELAY_BLOCKS());
        vm.prank(SYSTEM_CALLER);
        registry.applyConsensusState(id,ValidatorRegistry.Status.ELIGIBLE,2,1,0,0);
        vm.prank(SYSTEM_CALLER); registry.applyExitNotice(id,1);
        vm.prank(SYSTEM_CALLER); registry.applyRotationSnapshot(2,1);
        vm.prank(SYSTEM_CALLER);
        registry.applyConsensusState(id,ValidatorRegistry.Status.WITHDRAWAL_HOLD,3,1,0,0);
        vm.roll(registry.getValidator(id).withdrawableBlock);
        vm.prank(SYSTEM_CALLER);
        registry.applyConsensusState(id,ValidatorRegistry.Status.WITHDRAWABLE,4,1,0,0);
        receiver.withdraw(registry,id);
        require(!receiver.replaySucceeded(),"withdrawal reentered");
        require(receiver.received()==42_000 ether,"incorrect payout");
        require(registry.totalOwnedCustody()==0 && registry.totalOwnedWithdrawn()==42_000 ether,"custody totals");
        require(registry.getValidator(id).status==ValidatorRegistry.Status.EXITED,"not exited");
    }

    function testSecurityOnlyRegisteredRecipientCanWithdraw() public {
        (bytes32 id,address owner)=_registerSelfFunded("recipient-authority",42);
        _state(id,ValidatorRegistry.Status.PROBATION,1,0,0,0);
        _rollPastActivation(id);
        _state(id,ValidatorRegistry.Status.ELIGIBLE,2,1,0,0);
        vm.prank(SYSTEM_CALLER); registry.applyExitNotice(id,1);
        vm.prank(SYSTEM_CALLER); registry.applyRotationSnapshot(2,1);
        _state(id,ValidatorRegistry.Status.WITHDRAWAL_HOLD,3,1,0,0);
        vm.roll(registry.getValidator(id).withdrawableBlock);
        _state(id,ValidatorRegistry.Status.WITHDRAWABLE,4,1,0,0);
        address withdrawal=registry.getValidator(id).withdrawal;
        for (uint256 i;i<3;++i) {
            address actor=i==0 ? owner : i==1 ? address(this) : address(0xBAD);
            vm.prank(actor);
            (bool ok,)=address(registry).call(abi.encodeCall(registry.withdrawBond,(id)));
            require(!ok,"unauthorized withdrawal");
        }
        require(registry.totalOwnedCustody()==42_000 ether && address(registry).balance==42_000 ether,"collateral moved");
        uint256 beforeBalance=withdrawal.balance;
        vm.prank(withdrawal); registry.withdrawBond(id);
        require(withdrawal.balance==beforeBalance+42_000 ether,"recipient not paid");
    }

}
