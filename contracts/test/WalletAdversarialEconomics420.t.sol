// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/EntryPoint420.sol";
import "../src/accounts/SmartAccount420.sol";
import "../src/accounts/PaymasterData420.sol";
import "../src/system/CapabilityRegistry420.sol";

interface VmWalletEconomics420 {
    function chainId(uint256 chain) external;
    function warp(uint256 timestamp) external;
    function deal(address account, uint256 balance) external;
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address sender) external;
}

contract WalletGasProbe420 is IAccountValidation420 {
    uint256 public executions;
    uint256 public requestedValidationGas;
    function setRequestedValidationGas(uint256 amount) external { requestedValidationGas = amount; }
    function validateUserOp(PackedUserOperation420 calldata, bytes32, uint256) external view returns (uint256) {
        if (requestedValidationGas != 0) {
            uint256 start = gasleft();
            while (start - gasleft() < requestedValidationGas) {
                assembly { pop(gas()) }
            }
        }
        return 0;
    }
    function cheap() external { executions += 1; }
    function expensive() external {
        // SSTORE in every iteration is intentionally expensive; 30k gas
        // cannot finish this loop, while an unbounded call can.
        for (uint256 i; i < 50; ++i) { executions = i + 1; }
    }
}

contract WalletEconomicsSponsor420 is IPaymaster420 {
    EntryPoint420 public immutable entryPoint;
    uint256 public calls;
    uint256 public charged;
    PostOpMode420 public lastMode;
    bool public revertPostOp;
    bool public exhaustPostOpGas;

    constructor(EntryPoint420 entryPoint_) { entryPoint = entryPoint_; }
    function setRevertPostOp(bool value) external { revertPostOp = value; }
    function setExhaustPostOpGas(bool value) external { exhaustPostOpGas = value; }
    function validatePaymasterUserOp(PackedUserOperation420 calldata, bytes32, uint256)
        external pure returns (bytes memory context, uint256 validationData)
    {
        return (abi.encode(uint256(420)), 0);
    }
    function postOp(PostOpMode420 mode, bytes calldata, uint256 actualGasCostWei) external {
        require(msg.sender == address(entryPoint), "not entrypoint");
        if (revertPostOp) revert("postOp revert");
        if (exhaustPostOpGas) {
            while (true) { assembly { pop(gas()) } }
        }
        calls += 1;
        charged = actualGasCostWei;
        lastMode = mode;
    }
    function withdraw(address payable recipient, uint256 amount) external {
        entryPoint.withdrawTo(recipient, amount);
    }
}

contract WalletBatchProbe420 {
    uint256 public count;
    function succeed() external { count += 1; }
    function fail() external pure { revert("fail"); }
}

contract WalletAdversarialEconomics420Test {
    VmWalletEconomics420 private constant vm =
        VmWalletEconomics420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant OWNER_PK = 0xE420;
    uint256 private constant SESSION_PK = 0xF420;

    EntryPoint420 private entryPoint;
    CapabilityRegistry420 private capabilities;
    SmartAccount420 private account;
    WalletGasProbe420 private probe;
    WalletEconomicsSponsor420 private sponsor;
    WalletBatchProbe420 private batchTarget;
    address private owner;
    address private session;

    receive() external payable {}

    function setUp() public {
        vm.chainId(420);
        vm.warp(500);
        vm.deal(address(this), 100 ether);
        owner = vm.addr(OWNER_PK);
        session = vm.addr(SESSION_PK);
        entryPoint = new EntryPoint420();
        capabilities = new CapabilityRegistry420();
        account = new SmartAccount420(address(entryPoint), address(capabilities), owner, address(0xBEEF));
        probe = new WalletGasProbe420();
        batchTarget = new WalletBatchProbe420();
        sponsor = new WalletEconomicsSponsor420(entryPoint);
        entryPoint.depositTo{value: 1 ether}(address(sponsor));
    }

    function testSponsoredCallGasBoundAndRollbackRefundAndReplay() public {
        bytes32 authorization = keccak256("wallet/economics/expensive");
        PackedUserOperation420 memory op = _sponsoredProbe(
            authorization, abi.encodeWithSelector(WalletGasProbe420.expensive.selector), 30_000
        );
        uint256 before = entryPoint.balanceOf(address(sponsor));
        uint256 maximum = (100_000 + 30_000 + 21_000) * 1 gwei;
        (bool success,) = entryPoint.handleOp(op);
        require(!success, "execution exceeded signed gas limit");
        require(probe.executions() == 0, "out-of-gas did not roll back target writes");
        require(entryPoint.getNonce(address(probe), 0) == 1, "validated nonce not consumed");
        require(entryPoint.reservedOf(address(sponsor)) == 0, "reservation not released");
        require(entryPoint.authorizationConsumed(address(sponsor), authorization), "authorization reused");
        uint256 charged = before - entryPoint.balanceOf(address(sponsor));
        require(charged > 0 && charged <= maximum, "charge outside signed reservation");
        require(sponsor.charged() == charged, "settlement callback mismatch");
        require(sponsor.lastMode() == PostOpMode420.OpReverted, "wrong outcome");

        (bool ok,) = address(entryPoint).call(abi.encodeWithSelector(EntryPoint420.handleOp.selector, op));
        require(!ok, "replayed operation accepted");
        require(entryPoint.balanceOf(address(sponsor)) == before - charged, "replay charged twice");
    }

    function testAccountAndSponsorShareSignedVerificationGasBudget() public {
        // Account validation consumes most of its signed verification allowance.
        // Its successful return cannot grant the sponsor the *same* allowance
        // a second time; the operation must fail before nonce and reservation.
        probe.setRequestedValidationGas(90_000);
        bytes32 authorization = keccak256("wallet/economics/verification-budget");
        PackedUserOperation420 memory op = _sponsoredProbe(
            authorization, abi.encodeWithSelector(WalletGasProbe420.cheap.selector), 100_000
        );
        uint256 before = entryPoint.balanceOf(address(sponsor));
        (bool ok,) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, op)
        );
        require(!ok, "verification allowance was reused by paymaster");
        require(probe.executions() == 0, "account executed after verification budget exhausted");
        require(entryPoint.getNonce(address(probe), 0) == 0, "failed verification consumed nonce");
        require(!entryPoint.authorizationConsumed(address(sponsor), authorization), "failed verification consumed id");
        require(entryPoint.reservedOf(address(sponsor)) == 0, "failed verification reserved funds");
        require(entryPoint.balanceOf(address(sponsor)) == before, "failed verification charged sponsor");
    }

    function testZeroSponsoredGasBudgetsRejectWithoutReservationOrNonce() public {
        bytes32 authorization = keccak256("wallet/economics/zero");
        PackedUserOperation420 memory op = _sponsoredProbe(
            authorization, abi.encodeWithSelector(WalletGasProbe420.cheap.selector), 0
        );
        uint256 before = entryPoint.balanceOf(address(sponsor));
        (bool ok, bytes memory reason) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, op)
        );
        require(!ok && _error(reason) == EntryPoint420.InvalidOperationGasLimits.selector, "zero gas accepted");
        require(entryPoint.getNonce(address(probe), 0) == 0, "nonce consumed");
        require(!entryPoint.authorizationConsumed(address(sponsor), authorization), "authorization consumed");
        require(entryPoint.balanceOf(address(sponsor)) == before, "deposit changed");
    }

    function testSuccessfulSponsorshipChargesOnlyActualAndReleasesUnusedReserve() public {
        bytes32 authorization = keccak256("wallet/economics/cheap");
        PackedUserOperation420 memory op = _sponsoredProbe(
            authorization, abi.encodeWithSelector(WalletGasProbe420.cheap.selector), 100_000
        );
        uint256 max = (100_000 + 100_000 + 21_000) * 1 gwei;
        uint256 before = entryPoint.balanceOf(address(sponsor));
        (bool success,) = entryPoint.handleOp(op);
        require(success && probe.executions() == 1, "cheap op failed");
        uint256 charged = before - entryPoint.balanceOf(address(sponsor));
        require(charged > 0 && charged <= max, "charge exceeded reserve");
        require(entryPoint.reservedOf(address(sponsor)) == 0, "reservation leaked");
        require(entryPoint.availableOf(address(sponsor)) == before - charged, "unused reserve not returned");
        require(sponsor.lastMode() == PostOpMode420.OpSucceeded, "success callback missing");
    }

    function testPostOpRevertCannotReverseSettlementOrNonce() public {
        sponsor.setRevertPostOp(true);
        bytes32 authorization = keccak256("wallet/economics/postop");
        PackedUserOperation420 memory op = _sponsoredProbe(
            authorization, abi.encodeWithSelector(WalletGasProbe420.cheap.selector), 100_000
        );
        uint256 before = entryPoint.balanceOf(address(sponsor));
        (bool success,) = entryPoint.handleOp(op);
        require(success && probe.executions() == 1, "postop affected execution");
        require(entryPoint.balanceOf(address(sponsor)) < before, "postop restored deposit");
        require(entryPoint.reservedOf(address(sponsor)) == 0, "postop left reservation");
        require(entryPoint.getNonce(address(probe), 0) == 1, "postop rolled back nonce");
    }

    function testGasExhaustingPostOpCannotRollbackSponsorshipOrReplayState() public {
        sponsor.setExhaustPostOpGas(true);
        bytes32 authorization = keccak256("wallet/economics/postop-oog");
        PackedUserOperation420 memory op = _sponsoredProbe(
            authorization, abi.encodeWithSelector(WalletGasProbe420.cheap.selector), 100_000
        );
        uint256 before = entryPoint.balanceOf(address(sponsor));
        (bool success,) = entryPoint.handleOp(op);
        require(success && probe.executions() == 1, "hostile postop rolled back target");
        require(entryPoint.reservedOf(address(sponsor)) == 0, "hostile postop stranded reserve");
        require(entryPoint.balanceOf(address(sponsor)) < before, "hostile postop undid charge");
        require(entryPoint.authorizationConsumed(address(sponsor), authorization), "authorization reverted");
        require(entryPoint.getNonce(address(probe), 0) == 1, "hostile postop undid nonce");
        (bool replay,) = address(entryPoint).call(abi.encodeWithSelector(EntryPoint420.handleOp.selector, op));
        require(!replay, "hostile postop permitted replay");
    }

    function testMalformedSessionEnvelopeFailsClosedPreservingNonceAndGrants() public {
        vm.prank(owner); account.enableSessionKey(session);
        vm.prank(owner); bytes32 grantId = account.createSessionGrant(
            session, address(batchTarget), WalletBatchProbe420.succeed.selector,
            1, 2, 60, 0, 0
        );
        uint192 lane = uint192(uint160(session));
        bytes memory malformed = abi.encodePacked(SmartAccount420.executeSession.selector, hex"112233");
        PackedUserOperation420 memory op = _ownerOp(malformed, entryPoint.getNonce(address(account), lane));
        op.signature = _sign(SESSION_PK, entryPoint.getUserOpHash(op));
        (bool ok, bytes memory reason) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, op)
        );
        require(!ok && _error(reason) == EntryPoint420.ValidationFailed.selector, "malformed ABI not rejected cleanly");
        require(entryPoint.getNonce(address(account), lane) == uint256(lane) << 64, "malformed nonce consumed");
        require(capabilities.usage(grantId).used == 0, "malformed grant charged");
        require(batchTarget.count() == 0, "malformed account call executed");
    }

    function testOwnerBatchRevertsAtomicallyYetConsumesValidatedNonce() public {
        SmartAccount420.Call[] memory calls = new SmartAccount420.Call[](2);
        calls[0] = SmartAccount420.Call({
            target: address(batchTarget), value: 0,
            data: abi.encodeWithSelector(WalletBatchProbe420.succeed.selector)
        });
        calls[1] = SmartAccount420.Call({
            target: address(batchTarget), value: 0,
            data: abi.encodeWithSelector(WalletBatchProbe420.fail.selector)
        });
        PackedUserOperation420 memory op = _ownerOp(
            abi.encodeWithSelector(SmartAccount420.executeBatch.selector, calls), 0
        );
        op.signature = _sign(OWNER_PK, entryPoint.getUserOpHash(op));
        (bool success,) = entryPoint.handleOp(op);
        require(!success, "failed batch falsely succeeded");
        require(batchTarget.count() == 0, "earlier batch call did not roll back");
        require(entryPoint.getNonce(address(account), 0) == 1, "validated nonce not consumed");
    }

    function _sponsoredProbe(bytes32 authorizationId, bytes memory callData, uint256 callGas)
        private view returns (PackedUserOperation420 memory op)
    {
        op = _ownerOp(callData, 0);
        op.sender = address(probe);
        op.accountGasLimits = bytes32((uint256(100_000) << 128) | callGas);
        op.preVerificationGas = 21_000;
        op.gasFees = bytes32(uint256(1 gwei));
        PaymasterData420.V1 memory d = PaymasterData420.V1({
            version: 1, paymaster: address(sponsor), entryPoint: address(entryPoint),
            chainId: 420, policyId: keccak256("wallet/economics/policy"),
            validAfter: 100, validUntil: 1_000, maxSponsoredCostWei: 1 ether,
            authorizationId: authorizationId, sponsorData: hex"0420"
        });
        op.paymasterAndData = PaymasterData420.encodeV1(d);
    }

    function _ownerOp(bytes memory callData, uint256 nonce_) private view returns (PackedUserOperation420 memory op) {
        op = PackedUserOperation420({
            sender: address(account), nonce: nonce_, initCode: bytes(""), callData: callData,
            accountGasLimits: bytes32(0), preVerificationGas: 0, gasFees: bytes32(0),
            paymasterAndData: bytes(""), signature: bytes("")
        });
    }

    function _sign(uint256 privateKey, bytes32 hash) private returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _error(bytes memory reason) private pure returns (bytes4 result) {
        if (reason.length < 4) return bytes4(0);
        assembly { result := mload(add(reason, 32)) }
    }
}
