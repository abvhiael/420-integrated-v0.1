// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/adapters/CADCLayerZeroAdapter.sol";
import {EndpointV2} from "@layerzerolabs/lz-evm-protocol-v2/contracts/EndpointV2.sol";
import {ReceiveUln302} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/uln/uln302/ReceiveUln302.sol";
import {UlnConfig, SetDefaultUlnConfigParam} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/uln/UlnBase.sol";
import {OFT} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";
import {SendUln302} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/uln/uln302/SendUln302.sol";
import {ILayerZeroDVN} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/uln/interfaces/ILayerZeroDVN.sol";
import {
    SetDefaultExecutorConfigParam,
    ExecutorConfig
} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/SendLibBase.sol";

import {
    SendParam,
    MessagingFee,
    MessagingReceipt,
    OFTReceipt
} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";

interface CADCVm420 {
    function prank(address) external;
}

contract CADCTestOFT420 is OFT {
    constructor(address endpoint) OFT("Controlled CADC", "TEST", endpoint, msg.sender) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Test-only malformed issuer receipt after a genuine native send/burn.
contract CADCTestCorruptOFT420 is CADCTestOFT420 {
    constructor(address ep_) CADCTestOFT420(ep_) {}

    function send(SendParam calldata param, MessagingFee calldata fee, address refund)
        external
        payable
        override
        returns (MessagingReceipt memory r, OFTReceipt memory o)
    {
        (uint256 sent, uint256 received) = _debit(msg.sender, param.amountLD, param.minAmountLD, param.dstEid);
        (bytes memory m, bytes memory options) = _buildMsgAndOptions(param, received);
        r = _lzSend(param.dstEid, m, options, fee, refund);
        o = OFTReceipt(sent, received);
        r.guid = bytes32(uint256(1));
    }
}

contract CADCTestOFTSix420 is CADCTestOFT420 {
    constructor(address ep_) CADCTestOFT420(ep_) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract CADCTestDVN420 {
    uint256 public jobs;

    function assignJob(ILayerZeroDVN.AssignJobParam calldata, bytes calldata) external payable returns (uint256) {
        jobs++;
        return 0;
    }

    function getFee(uint32, uint64, address, bytes calldata) external pure returns (uint256) {
        return 0;
    }

    function submit(ReceiveUln302 lib, bytes memory header, bytes32 payload, uint64 confirmations) external {
        lib.verify(header, payload, confirmations);
    }
}

contract CADCTestExecutor420 {
    function assignJob(uint32, address, uint256, bytes calldata) external pure returns (uint256) {
        return 0;
    }

    function getFee(uint32, address, uint256, bytes calldata) external pure returns (uint256) {
        return 0;
    }
}

contract CADCTestIntegration420 {
    function requireActive() external view {require(active,"inactive integration");}
    bool public active;
    address public cadc;
    address public layerZeroEndpoint;
    address public issuerOFT;
    bytes32 public securityConfigHash;
    bytes32 public peerConfigHash;

    function configure(address t, address e, address o, bytes32 s, bytes32 p) external {
        cadc = t;
        layerZeroEndpoint = e;
        issuerOFT = o;
        securityConfigHash = s;
        peerConfigHash = p;
    }

    function setActive(bool a) external {
        active = a;
    }
}

contract CADCLayerZero420Test {
    CADCVm420 constant vm = CADCVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    EndpointV2 ep;
    ReceiveUln302 uln;
    CADCTestOFT420 oft;
    CADCTestIntegration420 integration;
    CADCLayerZeroAdapter adapter;
    CADCTestDVN420 a;
    CADCTestDVN420 b;
    CADCTestDVN420 optional;
    bytes32 constant REMOTE = bytes32(uint256(0x1234));
    bytes32 constant ASSET = keccak256("CADC");
    bytes32 constant ROUTE = keccak256("CADC/ETH/420");
    address constant RECIPIENT = address(0xCAFE);

    function setUp() public virtual {
        ep = new EndpointV2(30420, address(this));
        uln = new ReceiveUln302(address(ep));
        oft = new CADCTestOFT420(address(ep));
        integration = _newIntegration();
        a = new CADCTestDVN420();
        b = new CADCTestDVN420();
        optional = new CADCTestDVN420();
        setDefaults(15, false);
        ep.registerLibrary(address(uln));
        ep.setDefaultReceiveLibrary(30101, address(uln), 0);
        oft.setPeer(30101, REMOTE);
        adapter = new CADCLayerZeroAdapter(address(this), _router(), address(integration), ASSET);
        integration.configure(address(oft), address(ep), address(oft), bytes32(uint256(1)), bytes32(uint256(1)));
        pin();
    }

    function _newIntegration() internal virtual returns (CADCTestIntegration420) {
        return new CADCTestIntegration420();
    }

    function _router() internal view virtual returns (address) {
        return address(this);
    }

    function setDefaults(uint64 confirmations, bool withOptional) internal {
        address[] memory required = new address[](2);
        required[0] = address(a) < address(b) ? address(a) : address(b);
        required[1] = address(a) < address(b) ? address(b) : address(a);
        address[] memory opts = new address[](withOptional ? 1 : 0);
        if (withOptional) opts[0] = address(optional);
        SetDefaultUlnConfigParam[] memory c = new SetDefaultUlnConfigParam[](1);
        c[0] = SetDefaultUlnConfigParam(
            30101, UlnConfig(confirmations, 2, withOptional ? 1 : 0, withOptional ? 1 : 0, required, opts)
        );
        uln.setDefaultUlnConfigs(c);
    }

    function pin() internal virtual {
        integration.setActive(false);
        adapter.setPeer(
            30101,
            CADCLayerZeroAdapter.Peer(
                ROUTE,
                REMOTE,
                address(uln),
                address(0),
                keccak256(abi.encode(uln.getUlnConfig(address(oft), 30101))),
                0,
                true,
                false
            )
        );
        integration.configure(
            address(oft), address(ep), address(oft), adapter.securityConfigHash(), adapter.peerConfigHash()
        );
        _activateIntegration();
    }

    function _activateIntegration() internal virtual {integration.setActive(true);}

    function message(uint64 amount) internal pure returns (bytes memory) {
        return abi.encodePacked(bytes32(uint256(uint160(RECIPIENT))), amount);
    }

    function header(uint64 nonce) internal view returns (bytes memory) {
        return abi.encodePacked(
            uint8(1), nonce, uint32(30101), REMOTE, uint32(30420), bytes32(uint256(uint160(address(oft))))
        );
    }

    function guid(uint64 nonce) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked(nonce, uint32(30101), REMOTE, uint32(30420), bytes32(uint256(uint160(address(oft)))))
        );
    }

    function attest(CADCTestDVN420 dvn, uint64 nonce, bytes memory m, uint64 confirmations) internal {
        dvn.submit(uln, header(nonce), keccak256(abi.encodePacked(guid(nonce), m)), confirmations);
    }

    function deliver(uint64 nonce, bytes memory m) internal returns (IBridgeAdapter420.VerifiedTransfer memory) {
        return adapter.verifyInbound(abi.encode(uint32(30101), nonce, m));
    }

    function reject(uint64 nonce, bytes memory m) internal {
        (bool ok,) = address(adapter).call(abi.encodeCall(adapter.verifyInbound, (abi.encode(uint32(30101), nonce, m))));
        require(!ok, "must reject");
    }

    function ready(uint64 nonce, bytes memory m) internal {
        attest(a, nonce, m, 15);
        attest(b, nonce, m, 15);
    }

    function testNativeEndpointUlnOftDelivery() public {
        bytes memory m = message(125);
        ready(1, m);
        IBridgeAdapter420.VerifiedTransfer memory v = deliver(1, m);
        require(
            v.amount == 125 * 1e12 && v.recipient == RECIPIENT && v.routeId == ROUTE && v.assetId == ASSET
                && v.sourceMessageId == guid(1) && v.sourceTxId == keccak256(abi.encodePacked(guid(1), m)),
            "bindings"
        );
        require(oft.balanceOf(RECIPIENT) == v.amount, "native credit");
    }

    function testNoRpcFinalityAssertion() public {
        reject(1, message(125));
    }

    function testSingleRequiredDVNInsufficient() public {
        bytes memory m = message(125);
        attest(a, 1, m, 15);
        reject(1, m);
    }

    function testWrongDVNInsufficient() public {
        bytes memory m = message(125);
        attest(a, 1, m, 15);
        attest(optional, 1, m, 15);
        reject(1, m);
    }

    function testInsufficientConfirmations() public {
        bytes memory m = message(125);
        attest(a, 1, m, 14);
        attest(b, 1, m, 15);
        reject(1, m);
    }

    function testOptionalThresholdRequired() public {
        setDefaults(15, true);
        pin();
        bytes memory m = message(125);
        ready(1, m);
        reject(1, m);
        attest(optional, 1, m, 15);
        deliver(1, m);
    }

    function testPayloadTampering() public {
        ready(1, message(125));
        reject(1, message(126));
    }

    function testNonceTampering() public {
        bytes memory m = message(125);
        ready(1, m);
        reject(2, m);
    }

    function testDuplicateDelivery() public {
        bytes memory m = message(125);
        ready(1, m);
        deliver(1, m);
        reject(1, m);
    }

    function testReplaySurvivesRepinning() public {
        bytes memory m = message(125);
        ready(1, m);
        deliver(1, m);
        pin();
        ready(1, m);
        reject(1, m);
    }

    function testEarlierExternalCommitCannotBypassAdmission() public {
        bytes memory m = message(125);
        ready(1, m);
        uln.commitVerification(header(1), keccak256(abi.encodePacked(guid(1), m)));
        reject(1, m);
    }

    function testEffectiveDefaultConfigurationDrift() public {
        bytes memory m = message(125);
        ready(1, m);
        setDefaults(16, false);
        reject(1, m);
    }

    function testPeerSubstitution() public {
        bytes memory m = message(125);
        ready(1, m);
        oft.setPeer(30101, bytes32(uint256(777)));
        reject(1, m);
    }

    function testInactive() public {
        integration.setActive(false);
        reject(1, message(125));
    }

    function testOnlyRouter() public {
        vm.prank(address(0xBAD));
        (bool ok,) = address(adapter)
            .call(abi.encodeCall(adapter.verifyInbound, (abi.encode(uint32(30101), uint64(1), message(125)))));
        require(!ok, "router");
    }

    function testOnlyGovernance() public {
        vm.prank(address(0xBAD));
        (bool ok,) = address(adapter)
            .call(
                abi.encodeCall(
                    adapter.setPeer,
                    (
                        uint32(30101),
                        CADCLayerZeroAdapter.Peer(
                            ROUTE, REMOTE, address(uln), address(0), bytes32(0), bytes32(0), true, false
                        )
                    )
                )
            );
        require(!ok, "governance");
    }

    function testZeroAmount() public {
        bytes memory m = message(0);
        ready(1, m);
        reject(1, m);
    }

    function testZeroNonce() public {
        bytes memory m = message(125);
        ready(0, m);
        reject(0, m);
    }

    function testDirtyRecipient() public {
        bytes memory m = abi.encodePacked(bytes32(type(uint256).max), uint64(125));
        ready(1, m);
        reject(1, m);
    }

    function testComposeRequiresQualifiedConsumer() public {
        bytes memory m = abi.encodePacked(message(125), bytes32(uint256(1)), bytes("compose"));
        ready(1, m);
        reject(1, m);
    }

    function testFuzzUnauthenticatedAmountMutation(uint64 amount) public {
        if (amount == 125) return;
        ready(1, message(125));
        reject(1, message(amount));
    }

    function testPeerCannotChangeWhileActive() public {
        (bool ok,) = address(adapter)
            .call(
                abi.encodeCall(
                    adapter.setPeer,
                    (
                        uint32(30101),
                        CADCLayerZeroAdapter.Peer(
                            ROUTE, REMOTE, address(uln), address(0), bytes32(uint256(1)), 0, true, false
                        )
                    )
                )
            );
        require(!ok, "active mutation");
    }

    function testLibrarySubstitution() public {
        ReceiveUln302 other = new ReceiveUln302(address(ep));
        SetDefaultUlnConfigParam[] memory c = new SetDefaultUlnConfigParam[](1);
        c[0] = SetDefaultUlnConfigParam(30101, uln.getUlnConfig(address(oft), 30101));
        other.setDefaultUlnConfigs(c);
        ep.registerLibrary(address(other));
        ep.setDefaultReceiveLibrary(30101, address(other), 0);
        reject(1, message(125));
    }

    function testZeroRecipient() public {
        bytes memory m = abi.encodePacked(bytes32(0), uint64(125));
        ready(1, m);
        reject(1, m);
    }

    function testWrongSourceEid() public {
        (bool ok,) = address(adapter)
            .call(abi.encodeCall(adapter.verifyInbound, (abi.encode(uint32(30102), uint64(1), message(125)))));
        require(!ok, "eid");
    }

    function testIssuerSecurityCommitmentMismatch() public {
        integration.configure(address(oft), address(ep), address(oft), bytes32(uint256(1)), adapter.peerConfigHash());
        reject(1, message(125));
    }

    function testIssuerTokenSubstitution() public {
        integration.configure(
            address(ep), address(ep), address(oft), adapter.securityConfigHash(), adapter.peerConfigHash()
        );
        reject(1, message(125));
    }

    function testRejectedDeliveryPreservesDvnEvidence() public {
        bytes memory m = message(125);
        ready(1, m);
        oft.setPeer(30101, bytes32(uint256(999)));
        reject(1, m);
        oft.setPeer(30101, REMOTE);
        deliver(1, m);
    }

    function testMissingRequiredDvnPolicy() public {
        address[] memory required = new address[](0);
        address[] memory opts = new address[](1);
        opts[0] = address(optional);
        SetDefaultUlnConfigParam[] memory c = new SetDefaultUlnConfigParam[](1);
        c[0] = SetDefaultUlnConfigParam(30101, UlnConfig(15, 0, 1, 1, required, opts));
        uln.setDefaultUlnConfigs(c);
        pin();
        bytes memory m = message(125);
        attest(optional, 1, m, 15);
        reject(1, m);
    }

    function testFuzzNativeAmountBinding(uint64 amount) public {
        if (amount == 0) return;
        bytes memory m = message(amount);
        ready(1, m);
        IBridgeAdapter420.VerifiedTransfer memory v = deliver(1, m);
        require(v.amount == uint256(amount) * 1e12 && oft.balanceOf(RECIPIENT) == v.amount, "amount");
    }

    function setupOutbound() internal returns (SendUln302 lib) {
        lib = new SendUln302(address(ep), 100000, 0);
        SetDefaultUlnConfigParam[] memory c = new SetDefaultUlnConfigParam[](1);
        c[0] = SetDefaultUlnConfigParam(30101, uln.getUlnConfig(address(oft), 30101));
        lib.setDefaultUlnConfigs(c);
        SetDefaultExecutorConfigParam[] memory e = new SetDefaultExecutorConfigParam[](1);
        e[0] = SetDefaultExecutorConfigParam(30101, ExecutorConfig(10000, address(new CADCTestExecutor420())));
        lib.setDefaultExecutorConfigs(e);
        ep.registerLibrary(address(lib));
        ep.setDefaultSendLibrary(30101, address(lib));
        integration.setActive(false);
        adapter.setPeer(
            30101,
            CADCLayerZeroAdapter.Peer(
                ROUTE,
                REMOTE,
                address(uln),
                address(lib),
                keccak256(abi.encode(c[0].config)),
                keccak256(abi.encode(c[0].config)),
                true,
                true
            )
        );
        integration.configure(
            address(oft), address(ep), address(oft), adapter.securityConfigHash(), adapter.peerConfigHash()
        );
        _activateIntegration();
        oft.mint(address(this), 1000 * 1e12);
        oft.approve(address(adapter), type(uint256).max);
    }

    function outbound(uint256 amount) internal returns (bytes32) {
        return adapter.initiateOutbound(
            ROUTE,
            ASSET,
            address(this),
            abi.encode(bytes32(uint256(uint160(RECIPIENT)))),
            amount,
            abi.encode(uint32(30101), hex"0003")
        );
    }

    function testNativeOutboundDispatchesRequiredDvns() public {
        setupOutbound();
        uint256 supply = oft.totalSupply();
        bytes32 id = outbound(125 * 1e12);
        require(
            id != 0 && adapter.consumed(id) && a.jobs() == 1 && b.jobs() == 1
                && oft.totalSupply() == supply - 125 * 1e12 && oft.balanceOf(address(adapter)) == 0,
            "native burn and dispatch"
        );
    }

    function testOutboundRejectsDust() public {
        setupOutbound();
        (bool ok,) = address(this).call(abi.encodeCall(this.callOutbound, (125 * 1e12 + 1)));
        require(!ok, "dust");
        require(oft.balanceOf(address(this)) == 1000 * 1e12, "rollback");
    }

    function callOutbound(uint256 amount) external returns (bytes32) {
        return outbound(amount);
    }

    function testOutboundAssetSubstitution() public {
        setupOutbound();
        (bool ok,) = address(adapter)
            .call(
                abi.encodeCall(
                    adapter.initiateOutbound,
                    (
                        ROUTE,
                        bytes32(uint256(1)),
                        address(this),
                        abi.encode(bytes32(uint256(1))),
                        125 * 1e12,
                        abi.encode(uint32(30101), hex"0003")
                    )
                )
            );
        require(!ok, "asset");
    }

    function testOutboundRouteSubstitution() public {
        setupOutbound();
        (bool ok,) = address(adapter)
            .call(
                abi.encodeCall(
                    adapter.initiateOutbound,
                    (
                        bytes32(uint256(1)),
                        ASSET,
                        address(this),
                        abi.encode(bytes32(uint256(1))),
                        125 * 1e12,
                        abi.encode(uint32(30101), hex"0003")
                    )
                )
            );
        require(!ok, "route");
    }

    function testOutboundConfigDrift() public {
        SendUln302 lib = setupOutbound();
        SetDefaultUlnConfigParam[] memory c = new SetDefaultUlnConfigParam[](1);
        UlnConfig memory config = uln.getUlnConfig(address(oft), 30101);
        config.confirmations = 16;
        c[0] = SetDefaultUlnConfigParam(30101, config);
        lib.setDefaultUlnConfigs(c);
        (bool ok,) = address(this).call(abi.encodeCall(this.callOutbound, (125 * 1e12)));
        require(!ok, "send config");
    }

    function testSixDecimalIssuerToken() public {
        oft = new CADCTestOFTSix420(address(ep));
        oft.setPeer(30101, REMOTE);
        pin();
        bytes memory m = message(1250000);
        ready(1, m);
        IBridgeAdapter420.VerifiedTransfer memory v = deliver(1, m);
        require(v.amount == 1250000 && oft.balanceOf(RECIPIENT) == 1250000, "six decimals");
    }

    function testOutboundRejectsWrongNativeGuidAndRollsBackBurn() public {
        oft = new CADCTestCorruptOFT420(address(ep));
        oft.setPeer(30101, REMOTE);
        setupOutbound();
        uint256 supply = oft.totalSupply();
        (bool ok,) = address(this).call(abi.encodeCall(this.callOutbound, (125 * 1e12)));
        require(
            !ok && oft.totalSupply() == supply && oft.balanceOf(address(this)) == 1000 * 1e12 && a.jobs() == 0
                && b.jobs() == 0,
            "GUID binding and native rollback"
        );
    }
}
