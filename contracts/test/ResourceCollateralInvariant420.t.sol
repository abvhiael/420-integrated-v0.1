// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./ResourceProviderCollateral420.t.sol";

// The handler is the sole fuzz target. Independent ghost balances are updated
// only after successful calls, and every action checks exact conservation.
contract ResourceCollateralInvariant420Test is ResourceProviderCollateralFixture420 {
    bytes32 constant SECOND = keccak256("invariant-second");
    uint256[2] private funded;
    uint256[2] private paid;
    uint256[2] private confiscated;
    bytes32[][2] private refs;
    uint256[][2] private amounts;
    bytes32[][2] private penalties;
    uint256 private sequence;
    address[] private targets;
    struct FuzzSelector { address addr; bytes4[] selectors; }
    FuzzSelector[] private selectors;

    function setUp() public override {
        _setup(false);
        vm.prank(OTHER);
        providers.registerProvider(SECOND,OTHER,0,0);
        targets.push(address(this));
        bytes4[] memory choices = new bytes4[](9);
        choices[0] = this.actDeposit.selector;
        choices[1] = this.actReserve.selector;
        choices[2] = this.actRelease.selector;
        choices[3] = this.actHold.selector;
        choices[4] = this.actResolve.selector;
        choices[5] = this.actExit.selector;
        choices[6] = this.actWithdraw.selector;
        choices[7] = this.actFailedDeposit.selector;
        choices[8] = this.actReplay.selector;
        selectors.push(FuzzSelector(address(this), choices));
        actDeposit(0, 2 ether);
        actDeposit(1, 2 ether);
    }
    function targetContracts() external view returns (address[] memory) { return targets; }
    function targetSelectors() external view returns (FuzzSelector[] memory) { return selectors; }
    function _provider(uint256 i) private pure returns (bytes32) { return i == 0 ? ID : SECOND; }
    function _owner(uint256 i) private pure returns (address) { return i == 0 ? OWNER : OTHER; }
    function _id(uint256 i) private view returns (bytes32) { return collateral.positionId(_provider(i)); }
    function _next() private returns (bytes32) { return bytes32(++sequence); }

    function actDeposit(uint256 seed, uint256 raw) public {
        uint256 i = seed % 2;
        ResourceProviderCollateral420.Position memory p = collateral.getPosition(_id(i));
        if (p.state != ResourceProviderCollateral420.State.NONE && p.state != ResourceProviderCollateral420.State.BONDED) return;
        uint256 amount = 1 ether + raw % (3 ether);
        address owner = _owner(i);
        vm.deal(owner, amount);
        bytes32 n = _next();
        vm.prank(owner);
        collateral.deposit{value:amount}(_provider(i),n);
        funded[i] += amount;
        if (providers.getProvider(_provider(i)).state != ResourceProviderRegistry420.State.ACTIVE) {
            vm.prank(owner);
            providers.updateProvider(_provider(i),0,_id(i));
            vm.prank(owner);
            (bool ok,) = address(providers).call(abi.encodeCall(providers.setState,(_provider(i),ResourceProviderRegistry420.State.ACTIVE)));
            // A penalty hold may legitimately prevent renewed eligibility.
            if (ok) require(providers.isActive(_provider(i)), "activation mismatch");
        }
        invariant_accounting();
    }
    function actReserve(uint256 seed, uint256 raw) external {
        uint256 i = seed % 2;
        if (!providers.isActive(_provider(i))) return;
        uint256 amount = raw % (2 ether);
        uint256 exposure = collateral.outstandingExposure(_id(i)) + amount;
        uint256 available = collateral.getPosition(_id(i)).slashable - collateral.outstandingPenaltyHolds(_id(i));
        if (available < providers.requiredSlashable(exposure)) return;
        bytes32 key = collateral.reserveExposure(_provider(i),_next(),amount);
        refs[i].push(key);
        amounts[i].push(amount);
        invariant_accounting();
    }
    function actRelease(uint256 seed, uint256 index) external {
        uint256 i = seed % 2;
        if (refs[i].length == 0) return;
        uint256 k = index % refs[i].length;
        bytes32 key = refs[i][k];
        collateral.releaseExposure(key);
        uint256 last = refs[i].length - 1;
        refs[i][k] = refs[i][last];
        amounts[i][k] = amounts[i][last];
        refs[i].pop();
        amounts[i].pop();
        (bool ok,) = address(collateral).call(abi.encodeCall(collateral.releaseExposure,(key)));
        require(!ok,"release replay");
        invariant_accounting();
    }
    function actHold(uint256 seed, uint256 raw) external {
        uint256 i = seed % 2;
        ResourceProviderCollateral420.Position memory p = collateral.getPosition(_id(i));
        if (p.state != ResourceProviderCollateral420.State.BONDED && p.state != ResourceProviderCollateral420.State.EXITING) return;
        uint256 available = p.slashable - collateral.outstandingPenaltyHolds(_id(i));
        if (available == 0) return;
        bytes32 key = collateral.holdPenalty(_id(i),_next(),1 + raw % available);
        penalties[i].push(key);
        invariant_accounting();
    }
    function actResolve(uint256 seed, uint256 index, bool slash, uint64 batch) external {
        uint256 i = seed % 2;
        if (penalties[i].length == 0) return;
        uint256 k = index % penalties[i].length;
        bytes32 key = penalties[i][k];
        if (collateral.penaltyDecision(key) == bytes32(0)) {
            if (!slash) collateral.dismissPenalty(key);
            else collateral.authorizePenalty(key,_next(),address(0xCAFE));
        }
        if (collateral.penaltyDecision(key) != bytes32(0)) {
            uint256 beforePaid = address(0xCAFE).balance;
            collateral.executePenalty(key,1 + batch % 8);
            confiscated[i] += address(0xCAFE).balance - beforePaid;
        }
        (,,bool resolved) = collateral.penaltyHolds(key);
        if (resolved) {
            penalties[i][k] = penalties[i][penalties[i].length-1];
            penalties[i].pop();
        }
        invariant_accounting();
    }
    function actExit(uint256 seed) external {
        uint256 i = seed % 2;
        if (collateral.getPosition(_id(i)).state != ResourceProviderCollateral420.State.BONDED) return;
        vm.prank(_owner(i));
        collateral.requestExit(_id(i));
        require(!providers.isActive(_provider(i)),"exit eligibility");
        invariant_accounting();
    }
    function actWithdraw(uint256 seed, bool mature) external {
        uint256 i = seed % 2;
        if (mature) vm.warp(block.timestamp + 1 days);
        bool allowed = collateral.canWithdraw(_id(i));
        address owner = _owner(i);
        uint256 beforePaid = owner.balance;
        vm.prank(owner);
        (bool ok,) = address(collateral).call(abi.encodeCall(collateral.withdraw,(_id(i))));
        require(ok == allowed,"withdrawal eligibility mismatch");
        paid[i] += owner.balance - beforePaid;
        invariant_accounting();
    }
    function actFailedDeposit(uint256 seed) external {
        uint256 i = seed % 2;
        address owner = _owner(i);
        bytes32 n = _next();
        bytes32 key = keccak256(abi.encode("420/RESOURCE/COLLATERAL/DEPOSIT/V1",block.chainid,address(collateral),owner,n));
        _grant(address(collateral),VaultIds420.ACTION_CREATE_OBLIGATION,false);
        vm.deal(owner,1 ether);
        vm.prank(owner);
        (bool ok,) = address(collateral).call{value:1 ether}(abi.encodeCall(collateral.deposit,(_provider(i),n)));
        require(!ok && !collateral.consumedDeposit(key) && owner.balance == 1 ether,"failed deposit leaked");
        _grant(address(collateral),VaultIds420.ACTION_CREATE_OBLIGATION,true);
        invariant_accounting();
    }
    function actReplay(uint256 seed) external {
        uint256 i = seed % 2;
        address owner = _owner(i);
        vm.deal(owner,1 ether);
        vm.prank(owner);
        (bool ok,) = address(collateral).call{value:1 ether}(abi.encodeCall(collateral.deposit,(_provider(i),bytes32(i+1))));
        require(!ok && owner.balance == 1 ether,"deposit replay");
        invariant_accounting();
    }
    function invariant_accounting() public view {
        uint256 remaining;
        uint256 count;
        for (uint256 i; i<2; ++i) {
            bytes32 id = _id(i);
            ResourceProviderCollateral420.Position memory p = collateral.getPosition(id);
            require(p.deposited == funded[i] && collateral.withdrawnAmount(id) == paid[i] && collateral.slashedAmount(id) == confiscated[i],"ghost accounting");
            require(funded[i] == p.slashable + paid[i] + confiscated[i],"position conservation");
            uint256 sum;
            for (uint64 t=1; t<=p.trancheCount; ++t) {
                bytes32 obligation = collateral.trancheObligation(id,t);
                VaultAccounting420.Obligation memory o = accounting.getObligation(obligation);
                if (o.state == 1) {
                    require(o.beneficiary == _owner(i) && o.sourceRef == id && vault.payerSafetyController(obligation) == address(collateral),"tranche isolation");
                    require(collateral.reconciledTranche(id,t) == o.amount,"tranche reconciliation");
                    sum += o.amount;
                    count++;
                }
            }
            require(sum == p.slashable,"tranche conservation");
            uint256 exposure;
            for (uint256 r; r<amounts[i].length; ++r) exposure += amounts[i][r];
            require(collateral.outstandingExposure(id) == exposure && collateral.outstandingReservations(id) == refs[i].length,"reservation conservation");
            uint256 holds;
            for (uint256 k; k<penalties[i].length; ++k) {
                (bytes32 position,uint256 amount,bool resolved) = collateral.penaltyHolds(penalties[i][k]);
                require(position == id && !resolved,"penalty isolation");
                holds += amount - collateral.penaltyExecuted(penalties[i][k]);
            }
            require(holds == collateral.outstandingPenaltyHolds(id) && holds <= p.slashable,"hold conservation");
            remaining += p.slashable;
        }
        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(VID,address(0));
        require(collateral.totalSlashable() == remaining && collateral.totalWithdrawn() == paid[0]+paid[1] && collateral.totalSlashed() == confiscated[0]+confiscated[1],"aggregate conservation");
        require(address(vault).balance == remaining && a.recordedBalance == remaining && a.reserved == remaining && a.claimable == 0,"vault conservation");
        require(a.released == paid[0]+paid[1]+confiscated[0]+confiscated[1] && accounting.openObligationCount(VID) == count,"vault payout conservation");
        require(address(collateral).balance == 0 && collateral.custodyInvariant(),"custody invariant");
    }
}
