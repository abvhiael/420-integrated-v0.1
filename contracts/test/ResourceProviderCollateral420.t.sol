// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./ResourceGenesis420.t.sol";
import "../src/resource/ResourceProviderCollateral420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";

interface VmResourceCollateral420 {
    function prank(address) external;
    function deal(address,uint256) external;
    function warp(uint256) external;
}

/** Test-only registered Vault that deliberately calls back at both mutable deposit boundaries. */
contract CallbackResourceVault420 {
    bytes32 public immutable vaultId;
    VaultRegistry420 public immutable registry;
    VaultAuthorization420 public immutable authorization;
    VaultAccounting420 public immutable accounting;
    address public immutable registrationCreator;
    mapping(bytes32 => address) public payerSafetyController;
    ResourceProviderCollateral420 public target;
    ResourceProviderRegistry420 public providers;
    bytes32 public providerId;
    bytes32 public reservation;
    bytes32 public penalty;
    uint256 public attempts;
    bool public corrupt;
    bool public observedEligible;

    constructor(bytes32 id, VaultRegistry420 r, VaultAuthorization420 a, VaultAccounting420 ac) {
        vaultId = id;
        registry = r;
        authorization = a;
        accounting = ac;
        registrationCreator = msg.sender;
    }

    function configure(ResourceProviderCollateral420 c, ResourceProviderRegistry420 p, bytes32 id) external {
        target = c;
        providers = p;
        providerId = id;
    }

    function setAttack(bytes32 r, bytes32 p, bool bad) external {
        reservation = r;
        penalty = p;
        corrupt = bad;
    }

    function depositNative() external payable {
        accounting.recordDeposit(vaultId, address(0), msg.value);
        _callback();
    }

    function createObligation(bytes32, bytes32 id, address asset, address beneficiary, uint256 amount, bytes32 kind, bytes32 source) external {
        accounting.createObligation(vaultId, id, asset, beneficiary, amount, kind, source);
        payerSafetyController[id] = corrupt ? address(this) : msg.sender;
        _callback();
    }

    function reserve(bytes32 ref) external returns (bytes32) {
        return target.reserveExposure(providerId, ref, 0);
    }

    function _reject(bytes memory data, uint256 value) private {
        (bool ok,) = address(target).call{value: value}(data);
        require(!ok, "mutable callback succeeded");
        attempts++;
    }

    function _callback() private {
        bytes32 id = target.positionId(providerId);
        _reject(abi.encodeCall(target.deposit, (providerId, keccak256("nested deposit"))), 1 wei);
        _reject(abi.encodeCall(target.reserveExposure, (providerId, keccak256("nested reserve"), 0)), 0);
        if (reservation != bytes32(0)) _reject(abi.encodeCall(target.releaseExposure, (reservation)), 0);
        _reject(abi.encodeCall(target.requestExit, (id)), 0);
        _reject(abi.encodeCall(target.withdraw, (id)), 0);
        if (penalty != bytes32(0)) _reject(abi.encodeCall(target.executePenalty, (penalty, uint64(1))), 0);
        if (providers.isActive(providerId)) observedEligible = true;
    }
}

abstract contract ResourceProviderCollateralFixture420 {
    VmResourceCollateral420 constant vm = VmResourceCollateral420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant OWNER = address(0xA11CE);
    address constant OTHER = address(0xB0B);
    bytes32 constant ID = keccak256("resource-provider");
    bytes32 constant VID = keccak256("resource-collateral-vault");
    uint256 nonce;
    MockResourceCaps420 caps;
    VaultAuthorization420 auth;
    VaultRegistry420 registry;
    VaultAccounting420 accounting;
    AssetVault420 vault;
    ResourceProviderRegistry420 providers;
    ResourceProviderCollateral420 collateral;
    function setUp() public virtual { _setup(false); }
    function _setup(bool hostile) internal {
        caps = new MockResourceCaps420();
        auth = new VaultAuthorization420(address(caps));
        VaultPolicyRegistry420 policies = new VaultPolicyRegistry420(address(this));
        registry = new VaultRegistry420(address(auth),address(policies));
        accounting = new VaultAccounting420(address(registry));
        bytes32 a = keccak256("auth"); bytes32 b = keccak256("asset");
        bytes32 c = keccak256("release"); bytes32 d = keccak256("accounting");
        policies.setPolicy(a,VaultIds420.POLICY_AUTHORIZATION,a,0,true);
        policies.setPolicy(b,VaultIds420.POLICY_ASSET,b,0,true);
        policies.setPolicy(c,VaultIds420.POLICY_RELEASE,c,0,true);
        policies.setPolicy(d,VaultIds420.POLICY_ACCOUNTING,d,0,true);
        if (hostile) {
            vault = AssetVault420(payable(address(new CallbackResourceVault420(VID, registry, auth, accounting))));
        } else {
            vault = new AssetVault420(VID,address(registry),address(auth),address(accounting),address(this));
        }
        registry.registerVault(VID,address(vault),VaultIds420.VAULT_COLLATERAL,a,b,c,d,0,a,b);
        providers = new ResourceProviderRegistry420(address(new ResourceAuthorization420(address(caps))),address(this));
        vm.prank(OWNER);
        providers.registerProvider(ID,OWNER,0,0);
        collateral = new ResourceProviderCollateral420(address(providers),address(vault),address(registry),address(accounting));
        providers.bindCollateral(address(collateral));
        providers.publishCollateralPolicy(1 ether,1 ether,1 days,10000,true,keccak256("test policy only"));
        collateral.configureReservationController(address(this),true);
        _grant(address(collateral),VaultIds420.ACTION_CREATE_OBLIGATION,true);
        _grant(address(collateral),VaultIds420.ACTION_RELEASE_OBLIGATION,true);
        _grant(address(collateral),VaultIds420.ACTION_CLAIM,true);
        _grant(address(collateral),VaultIds420.ACTION_CANCEL_OBLIGATION,true);
    }
    function _grant(address who,bytes32 action,bool allow) internal {
        caps.set(who,VaultIds420.COMPONENT_VAULT,action,auth.scopeForVault(VID),allow);
    }
    function _deposit(uint256 amount) internal returns(bytes32) {
        bytes32 n = bytes32(++nonce);
        vm.deal(OWNER,amount);
        vm.prank(OWNER);
        return collateral.deposit{value:amount}(ID,n);
    }
    function _activate(bytes32 id) internal {
        vm.prank(OWNER);
        providers.updateProvider(ID,0,id);
        vm.prank(OWNER);
        providers.setState(ID,ResourceProviderRegistry420.State.ACTIVE);
    }
}

contract ResourceProviderCollateral420Test is ResourceProviderCollateralFixture420 {
    function testNativeDepositAndTopupReconcile() public {
        bytes32 id = _deposit(2 ether);
        require(id == collateral.positionId(ID),"identity");
        require(_deposit(3 ether) == id,"topup identity");
        ResourceProviderCollateral420.Position memory p = collateral.getPosition(id);
        require(p.owner == OWNER && p.providerId == ID && p.deposited == 5 ether && p.slashable == 5 ether,"position");
        require(p.state == ResourceProviderCollateral420.State.BONDED && p.trancheCount == 2,"state");
        require(collateral.trancheObligation(id,1) != collateral.trancheObligation(id,2),"reuse");
        require(collateral.reconciledTranche(id,1) == 2 ether && collateral.reconciledTranche(id,2) == 3 ether,"tranches");
        require(address(vault).balance == 5 ether && collateral.custodyInvariant(),"custody");
    }
    function testForeignDepositorAndMissingGrantRollback() public {
        vm.deal(OTHER,1 ether); vm.prank(OTHER);
        (bool ok,) = address(collateral).call{value:1 ether}(abi.encodeCall(collateral.deposit,(ID,bytes32(uint256(1)))));
        require(!ok,"foreign owner");
        _grant(address(collateral),VaultIds420.ACTION_CREATE_OBLIGATION,false);
        vm.deal(OWNER,1 ether); vm.prank(OWNER);
        (ok,) = address(collateral).call{value:1 ether}(abi.encodeCall(collateral.deposit,(ID,bytes32(uint256(1)))));
        require(!ok && address(vault).balance == 0 && collateral.totalSlashable() == 0,"atomic rollback");
    }
    function testGenericVaultGrantCannotUnlockResourceCollateral() public {
        bytes32 id = _deposit(1 ether);
        bytes32 obligation = collateral.trancheObligation(id,1);
        _grant(OTHER,VaultIds420.ACTION_CANCEL_OBLIGATION,true);
        _grant(OTHER,VaultIds420.ACTION_RELEASE_OBLIGATION,true);
        vm.prank(OTHER);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.cancelObligation,(keccak256("cancel"),obligation)));
        require(!ok,"generic cancellation");
        vm.prank(OTHER);
        (ok,) = address(vault).call(abi.encodeCall(vault.releaseObligation,(keccak256("release"),obligation)));
        require(!ok && collateral.reconciledTranche(id,1) == 1 ether,"generic release");
    }
    function testWalletAndDirectVaultBalanceAreNotProviderCollateral() public {
        vm.deal(OWNER,10 ether); vm.prank(OWNER);
        vault.depositNative{value:1 ether}();
        require(collateral.getPosition(collateral.positionId(ID)).slashable == 0,"unpledged funds counted");
        require(collateral.totalSlashable() == 0,"unpledged reserve");
    }
    function testWrongAccountingBindingRejected() public {
        VaultAccounting420 other = new VaultAccounting420(address(registry));
        try new ResourceProviderCollateral420(address(providers),address(vault),address(registry),address(other)) {
            revert("incorrect binding accepted");
        } catch {}
    }
    function testReplayCannotCountDepositTwice() public {
        bytes32 id = _deposit(2 ether);
        vm.deal(OWNER,2 ether);
        vm.prank(OWNER);
        (bool ok,) = address(collateral).call{value:2 ether}(abi.encodeCall(collateral.deposit,(ID,bytes32(uint256(1)))));
        require(!ok && collateral.getPosition(id).slashable == 2 ether && address(vault).balance == 2 ether,"replayed deposit");
    }
    function testPositionCannotActivateSecondProviderOrAlias() public {
        bytes32 id = _deposit(2 ether);
        _activate(id);
        bytes32 second = keccak256("second");
        vm.prank(OWNER);
        providers.registerProvider(second,OWNER,0,id);
        vm.prank(OWNER);
        (bool ok,) = address(providers).call(abi.encodeCall(providers.setState,(second,ResourceProviderRegistry420.State.ACTIVE)));
        require(!ok && !providers.isActive(second),"cross-provider reuse");
        require(!collateral.eligible(ID,keccak256(abi.encode(id)),OWNER,1 ether),"alias");
    }
    function testComputeObligationCannotReuseReservedFunds() public {
        _deposit(2 ether);
        _grant(OTHER,VaultIds420.ACTION_CREATE_OBLIGATION,true);
        vm.prank(OTHER);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.createObligation,(keccak256("op"),keccak256("compute"),address(0),OTHER,2 ether,keccak256("420/CMP/WORKER-COLLATERAL/V1"),ID)));
        require(!ok && collateral.totalSlashable()==2 ether,"cross protocol reuse");
    }
    function testReservationsPreventOverbookingAndWithdrawal() public {
        bytes32 id = _deposit(2 ether);
        _activate(id);
        bytes32 key = collateral.reserveExposure(ID,keccak256("first"),2 ether);
        (bool ok,) = address(collateral).call(abi.encodeCall(collateral.reserveExposure,(ID,keccak256("second"),1)));
        require(!ok,"overbook");
        (ok,) = address(collateral).call(abi.encodeCall(collateral.reserveExposure,(ID,keccak256("first"),0)));
        require(!ok,"reservation replay");
        vm.prank(OWNER);
        collateral.requestExit(id);
        vm.warp(block.timestamp+1 days);
        vm.prank(OWNER);
        (ok,) = address(collateral).call(abi.encodeCall(collateral.withdraw,(id)));
        require(!ok,"reserved withdrawal");
        collateral.releaseExposure(key);
        (ok,) = address(collateral).call(abi.encodeCall(collateral.releaseExposure,(key)));
        require(!ok,"release replay");
        vm.prank(OWNER);
        collateral.withdraw(id);
        require(collateral.getPosition(id).state==ResourceProviderCollateral420.State.WITHDRAWN && collateral.totalSlashable()==0 && address(vault).balance==0,"exit");
    }

    function testExitImmediatelyStopsAdmissionAndFreezesPolicyRevision() public {
        bytes32 id = _deposit(2 ether);
        _activate(id);
        vm.prank(OWNER);
        collateral.requestExit(id);
        uint64 maturity = collateral.withdrawableAt(id);
        require(!providers.isActive(ID) && collateral.exitPolicyRevision(id)==1,"exit admission");
        (bool ok,) = address(collateral).call(abi.encodeCall(collateral.reserveExposure,(ID,keccak256("after exit"),1)));
        require(!ok,"exit reservation");
        providers.publishCollateralPolicy(1 ether,1 ether,1,10000,true,keccak256("shorter test policy"));
        vm.warp(block.timestamp+1);
        require(!collateral.canWithdraw(id) && collateral.withdrawableAt(id)==maturity,"policy accelerated exit");
        vm.warp(maturity);
        require(collateral.canWithdraw(id),"frozen maturity");
    }
    function testPenaltyAndZeroExposureReservationBlockPartialWithdrawal() public {
        bytes32 id = _deposit(2 ether);
        _deposit(3 ether);
        _activate(id);
        bytes32 reservation = collateral.reserveExposure(ID,keccak256("capacity hold"),0);
        bytes32 penalty = collateral.holdPenalty(id,keccak256("penalty evidence"),1 ether);
        vm.prank(OWNER);
        collateral.requestExit(id);
        vm.warp(collateral.withdrawableAt(id));
        require(!collateral.canWithdraw(id),"both holds");
        collateral.releaseExposure(reservation);
        require(!collateral.canWithdraw(id),"penalty hold");
        vm.prank(OWNER);
        (bool ok,) = address(collateral).call(abi.encodeCall(collateral.dismissPenalty,(penalty)));
        require(!ok,"owner dismissed penalty");
        collateral.dismissPenalty(penalty);
        (ok,) = address(collateral).call(abi.encodeCall(collateral.dismissPenalty,(penalty)));
        require(!ok,"penalty replay");
        uint256 before = OWNER.balance;
        vm.prank(OWNER);
        collateral.withdraw(id);
        require(OWNER.balance==before+2 ether && collateral.withdrawnAmount(id)==2 ether,"first payout");
        require(collateral.getPosition(id).state==ResourceProviderCollateral420.State.EXITING,"partial exit");
        require(accounting.getAccounting(VID,address(0)).reserved==3 ether,"remaining reserve");
        vm.prank(OWNER);
        collateral.withdraw(id);
        require(OWNER.balance==before+5 ether && collateral.totalWithdrawn()==5 ether,"second payout");
        require(collateral.getPosition(id).state==ResourceProviderCollateral420.State.WITHDRAWN && collateral.custodyInvariant(),"terminal state");
        vm.prank(OWNER);
        (ok,) = address(collateral).call(abi.encodeCall(collateral.withdraw,(id)));
        require(!ok,"withdrawal replay");
    }
    function testWithdrawalGrantFailureIsAtomicAndSponsorReceivesFunds() public {
        vm.prank(OWNER);
        providers.setCollateralSponsor(ID,OTHER);
        vm.deal(OTHER,2 ether);
        vm.prank(OTHER);
        bytes32 id = collateral.deposit{value:2 ether}(ID,keccak256("sponsor"));
        _activate(id);
        vm.prank(OTHER);
        collateral.requestExit(id);
        vm.warp(collateral.withdrawableAt(id));
        vm.prank(OWNER);
        (bool ok,) = address(collateral).call(abi.encodeCall(collateral.withdraw,(id)));
        require(!ok,"operator stole sponsor collateral");
        _grant(address(collateral),VaultIds420.ACTION_CLAIM,false);
        vm.prank(OTHER);
        (ok,) = address(collateral).call(abi.encodeCall(collateral.withdraw,(id)));
        require(!ok && collateral.withdrawalCursor(id)==0 && collateral.withdrawnAmount(id)==0,"failed claim leaked state");
        require(collateral.reconciledTranche(id,1)==2 ether,"failed claim unlocked reserve");
        _grant(address(collateral),VaultIds420.ACTION_CLAIM,true);
        vm.prank(OTHER);
        collateral.withdraw(id);
        require(OTHER.balance==2 ether && address(vault).balance==0,"sponsor payout");
    }

    function testGovernanceDisciplineCannotBeOverridden() public {
        bytes32 id = _deposit(2 ether);
        _activate(id);
        vm.prank(OWNER);
        (bool ok,) = address(providers).call(abi.encodeCall(providers.setDisciplinarySuspension,(ID,true,keccak256("evidence"))));
        require(!ok,"operator discipline");
        providers.setDisciplinarySuspension(ID,true,keccak256("evidence"));
        require(!providers.isActive(ID),"suspension");
        vm.prank(OWNER);
        (ok,) = address(providers).call(abi.encodeCall(providers.setState,(ID,ResourceProviderRegistry420.State.ACTIVE)));
        require(!ok,"self reinstatement");
        providers.reinstateProvider(ID,keccak256("remediated"));
        vm.prank(OWNER);
        providers.setState(ID,ResourceProviderRegistry420.State.ACTIVE);
        require(providers.isActive(ID),"qualified reinstatement");
        providers.disqualifyProvider(ID,keccak256("permanent"));
        (ok,) = address(providers).call(abi.encodeCall(providers.reinstateProvider,(ID,keccak256("retry"))));
        require(!ok && !providers.isActive(ID),"permanent disqualification");
    }

    function testSlashDeductsNativeCustodyAndRetainsExistingExposure() public {
        bytes32 id = _deposit(2 ether);
        _deposit(1 ether);
        _activate(id);
        bytes32 reservation = collateral.reserveExposure(ID,keccak256("existing agreement"),1 ether);
        bytes32 key = collateral.holdPenalty(id,keccak256("penalty evidence"),2.5 ether);
        bytes32 decision = keccak256("final adjudication");
        vm.prank(OWNER);
        (bool ok,) = address(collateral).call(abi.encodeCall(collateral.authorizePenalty,(key,decision,OTHER)));
        require(!ok,"unauthorized penalty");
        collateral.authorizePenalty(key,decision,OTHER);
        uint256 before = OTHER.balance;
        collateral.executePenalty(key,1);
        require(collateral.penaltyExecuted(key)==2 ether,"bounded first batch");
        collateral.executePenalty(key,1);
        require(OTHER.balance==before+2.5 ether,"actual payout");
        require(collateral.getPosition(id).slashable==0.5 ether && collateral.slashedAmount(id)==2.5 ether,"slash accounting");
        require(collateral.reconciledTranche(id,2)==0.5 ether && address(vault).balance==0.5 ether,"remainder custody");
        require(!providers.isActive(ID) && collateral.outstandingReservations(id)==1,"ineligible but obligations retained");
        (ok,) = address(collateral).call(abi.encodeCall(collateral.executePenalty,(key,uint64(1))));
        require(!ok,"duplicate execution");
        collateral.releaseExposure(reservation);
        require(collateral.outstandingReservations(id)==0,"existing discharge");
        vm.prank(OWNER);
        collateral.requestExit(id);
        vm.warp(collateral.withdrawableAt(id));
        vm.prank(OWNER);
        collateral.withdraw(id);
        require(collateral.withdrawnAmount(id)==0.5 ether && collateral.totalSlashed()==2.5 ether && address(vault).balance==0,"final accounting");
    }

    function testPenaltyExecutionRollbackOnMissingVaultGrant() public {
        bytes32 id = _deposit(2 ether);
        bytes32 key = collateral.holdPenalty(id,keccak256("evidence"),1 ether);
        collateral.authorizePenalty(key,keccak256("decision"),OTHER);
        _grant(address(collateral),VaultIds420.ACTION_CANCEL_OBLIGATION,false);
        (bool ok,) = address(collateral).call(abi.encodeCall(collateral.executePenalty,(key,uint64(1))));
        require(!ok && collateral.penaltyExecuted(key)==0 && collateral.reconciledTranche(id,1)==2 ether,"atomic rollback");
        require(collateral.outstandingPenaltyHolds(id)==1 ether,"hold preserved");
    }

    function _hostileVault() internal returns (CallbackResourceVault420 v) {
        _setup(true);
        v = CallbackResourceVault420(address(vault));
        v.configure(collateral, providers, ID);
        collateral.configureReservationController(address(v), true);
    }

    function testMaliciousVaultCallbacksCannotMutateCollateralOrExposeEligibility() public {
        CallbackResourceVault420 v = _hostileVault();
        bytes32 id = _deposit(3 ether);
        _activate(id);
        bytes32 reservation = v.reserve(keccak256("existing reservation"));
        bytes32 penalty = collateral.holdPenalty(id, keccak256("existing evidence"), 1 ether);
        collateral.authorizePenalty(penalty, keccak256("existing decision"), OTHER);
        v.setAttack(reservation, penalty, false);
        uint256 beforeAttempts = v.attempts();
        require(providers.isActive(ID), "provider initially ineligible");
        _deposit(2 ether);
        require(v.attempts() == beforeAttempts + 12, "both callback boundaries not exercised");
        require(!v.observedEligible() && providers.isActive(ID), "transient eligibility escaped");
        ResourceProviderCollateral420.Position memory p = collateral.getPosition(id);
        require(p.deposited == 5 ether && p.slashable == 5 ether && p.trancheCount == 2, "position corrupted");
        require(collateral.totalSlashable() == 5 ether && collateral.totalWithdrawn() == 0 && collateral.totalSlashed() == 0, "totals corrupted");
        require(collateral.outstandingReservations(id) == 1 && collateral.outstandingPenaltyHolds(id) == 1 ether, "holds corrupted");
        require(collateral.penaltyExecuted(penalty) == 0 && collateral.withdrawalCursor(id) == 0, "cursor corrupted");
        require(collateral.reconciledTranche(id, 1) == 3 ether && collateral.reconciledTranche(id, 2) == 2 ether, "tranches corrupted");
        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(VID, address(0));
        require(a.recordedBalance == 5 ether && a.reserved == 5 ether && a.claimable == 0 && a.released == 0, "accounting corrupted");
        require(address(vault).balance == 5 ether && address(collateral).balance == 0 && accounting.openObligationCount(VID) == 2 && collateral.custodyInvariant(), "custody corrupted");
    }

    function testMaliciousVaultBindingMismatchRollsBackDepositAndNonce() public {
        CallbackResourceVault420 v = _hostileVault();
        bytes32 id = _deposit(2 ether);
        bytes32 n = keccak256("retry nonce");
        bytes32 key = keccak256(abi.encode("420/RESOURCE/COLLATERAL/DEPOSIT/V1", block.chainid, address(collateral), OWNER, n));
        v.setAttack(bytes32(0), bytes32(0), true);
        vm.deal(OWNER, 1 ether);
        vm.prank(OWNER);
        (bool ok,) = address(collateral).call{value: 1 ether}(abi.encodeCall(collateral.deposit, (ID, n)));
        require(!ok && !collateral.consumedDeposit(key), "failed deposit consumed nonce");
        require(OWNER.balance == 1 ether && address(vault).balance == 2 ether && address(collateral).balance == 0, "failed deposit moved funds");
        require(collateral.totalSlashable() == 2 ether && collateral.getPosition(id).trancheCount == 1 && collateral.trancheObligation(id, 2) == bytes32(0), "failed deposit leaked effects");
        require(accounting.openObligationCount(VID) == 1 && accounting.getAccounting(VID, address(0)).reserved == 2 ether, "failed deposit leaked reserve");
        v.setAttack(bytes32(0), bytes32(0), false);
        vm.prank(OWNER);
        collateral.deposit{value: 1 ether}(ID, n);
        require(collateral.consumedDeposit(key) && collateral.reconciledTranche(id, 2) == 1 ether, "retry failed");
        require(collateral.totalSlashable() == 3 ether && collateral.custodyInvariant(), "retry custody");
    }

    function testZeroAndBelowMinimumThenExactBoundaryTopup() public {
        vm.deal(OWNER, 1 ether);
        vm.prank(OWNER);
        (bool ok,) = address(collateral).call(abi.encodeCall(collateral.deposit,(ID,keccak256("zero"))));
        require(!ok && collateral.totalSlashable() == 0,"zero deposit accepted");
        bytes32 id = _deposit(1 ether - 1);
        vm.prank(OWNER);
        providers.updateProvider(ID,0,id);
        vm.prank(OWNER);
        (ok,) = address(providers).call(abi.encodeCall(providers.setState,(ID,ResourceProviderRegistry420.State.ACTIVE)));
        require(!ok && !providers.isActive(ID),"below minimum admitted");
        _deposit(1);
        _activate(id);
        require(providers.isActive(ID) && collateral.totalSlashable() == 1 ether,"exact boundary denied");
    }

    function testUnauthorizedSponsorshipAndPrematureExit() public {
        vm.prank(OTHER);
        (bool ok,) = address(providers).call(abi.encodeCall(providers.setCollateralSponsor,(ID,OTHER)));
        require(!ok && providers.collateralSponsor(ID) == address(0),"sponsor theft");
        bytes32 id = _deposit(2 ether);
        _activate(id);
        vm.prank(OTHER);
        (ok,) = address(collateral).call(abi.encodeCall(collateral.requestExit,(id)));
        require(!ok,"foreign exit");
        vm.prank(OWNER);
        collateral.requestExit(id);
        vm.warp(collateral.withdrawableAt(id)-1);
        vm.prank(OWNER);
        (ok,) = address(collateral).call(abi.encodeCall(collateral.withdraw,(id)));
        require(!ok && collateral.totalSlashable() == 2 ether,"premature withdrawal");
        vm.warp(collateral.withdrawableAt(id));
        vm.prank(OWNER);
        collateral.withdraw(id);
        require(collateral.totalWithdrawn() == 2 ether && collateral.custodyInvariant(),"mature exit");
    }

    function testUnauthorizedHoldAndDuplicatePenaltyDecision() public {
        bytes32 id = _deposit(3 ether);
        bytes32 evidence = keccak256("unique evidence");
        vm.prank(OWNER);
        (bool ok,) = address(collateral).call(abi.encodeCall(collateral.holdPenalty,(id,evidence,1 ether)));
        require(!ok,"unauthorized hold");
        bytes32 key = collateral.holdPenalty(id,evidence,1 ether);
        (ok,) = address(collateral).call(abi.encodeCall(collateral.holdPenalty,(id,evidence,1 ether)));
        require(!ok,"duplicate evidence");
        bytes32 other = collateral.holdPenalty(id,keccak256("other evidence"),1 ether);
        bytes32 decision = keccak256("unique decision");
        collateral.authorizePenalty(key,decision,OTHER);
        (ok,) = address(collateral).call(abi.encodeCall(collateral.authorizePenalty,(other,decision,OTHER)));
        require(!ok && collateral.outstandingPenaltyHolds(id) == 2 ether,"duplicate decision");
        collateral.executePenalty(key,1);
        collateral.dismissPenalty(other);
        require(collateral.totalSlashed() == 1 ether && collateral.totalSlashable() == 2 ether && collateral.outstandingPenaltyHolds(id) == 0,"penalty conservation");
    }
}
