// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SupportedTokenRoutes420.t.sol";
import "./helpers/EthereumProofFixture420.sol";
import "../src/bridge/EthereumDepositGateway420.sol";

contract TokenEscrowBehavior420 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public mode;
    uint8 public decimals;

    function setDecimals(uint8 d) external {
        decimals = d;
    }

    function mint(address to, uint256 n) external {
        balanceOf[to] += n;
    }

    function setMode(uint256 m) external {
        mode = m;
    }

    function approve(address to, uint256 n) external returns (bool) {
        allowance[msg.sender][to] = n;
        return true;
    }

    function transferFrom(address from, address to, uint256 n) external returns (bool) {
        if (mode == 2) return false;
        if (mode == 3) revert("controlled token failure");
        require(allowance[from][msg.sender] >= n && balanceOf[from] >= n);
        allowance[from][msg.sender] -= n;
        balanceOf[from] -= n + (mode == 5 ? 1 : 0);
        balanceOf[to] += n - (mode == 4 ? 1 : 0) + (mode == 6 ? 1 : 0);
        if (mode == 1) {
            assembly { return(0, 0) }
        }
        if (mode == 7) {
            assembly {
                mstore(0, 2)
                return(0, 32)
            }
        }
        return true;
    }
}

/// Canonical receipt/MPT verification and real escrow effects; finality and token deployments are controlled.
contract TokenGatewaySemantics420Test is TokenRouteFixture420, EthereumProofFixture420 {
    uint256 constant SOURCE_KEY = 0x420beef;

    function setupGateway() internal returns (EthereumDepositGateway420 gateway) {
        EthereumDepositGateway420 template = new EthereumDepositGateway420(address(this));
        vm.etch(address(uint160(uint256(GATEWAY))), address(template).code);
        gateway = EthereumDepositGateway420(address(uint160(uint256(GATEWAY))));
    }

    function mockToken(uint256 i, uint256 mode) internal returns (TokenEscrowBehavior420 t) {
        address token = address(uint160(uint256(source(i))));
        vm.etch(token, type(TokenEscrowBehavior420).runtimeCode);
        t = TokenEscrowBehavior420(token);
        t.setDecimals(profile(i).decimals);
        t.mint(vm.addr(SOURCE_KEY), 1000 ether);
        t.setMode(mode);
        vm.prank(vm.addr(SOURCE_KEY));
        t.approve(address(uint160(uint256(GATEWAY))), type(uint256).max);
    }

    function receipt(EthereumVm420.Log[] memory logs) internal pure returns (bytes memory) {
        bytes[] memory ls = new bytes[](logs.length);
        for (uint256 i; i < logs.length; i++) {
            bytes[] memory fields = new bytes[](3);
            fields[0] = enc(abi.encodePacked(logs[i].emitter));
            bytes[] memory topics = new bytes[](logs[i].topics.length);
            for (uint256 j; j < topics.length; j++) {
                topics[j] = enc(abi.encodePacked(logs[i].topics[j]));
            }
            fields[1] = list(topics);
            fields[2] = enc(logs[i].data);
            ls[i] = list(fields);
        }
        bytes[] memory r = new bytes[](4);
        r[0] = encUint(1);
        r[1] = encUint(210000);
        r[2] = enc(new bytes(256));
        r[3] = list(ls);
        return list(r);
    }

    function txBytes(address gateway, address token, uint256 amount, bytes32 route) internal returns (bytes memory) {
        bytes[] memory f = new bytes[](9);
        f[0] = encUint(0);
        f[1] = encUint(1);
        f[2] = encUint(1000000);
        f[3] = enc(abi.encodePacked(gateway));
        f[4] = encUint(0);
        f[5] = enc(
            abi.encodeCall(
                EthereumDepositGateway420.deposit, (token, amount, uint256(420), address(router), route, address(0xB0B))
            )
        );
        f[6] = encUint(1);
        f[7] = encUint(0);
        f[8] = encUint(0);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SOURCE_KEY, keccak256(list(f)));
        f[6] = encUint(uint256(v) + 10);
        f[7] = encUint(uint256(r));
        f[8] = encUint(uint256(s));
        return list(f);
    }

    function depositProof(uint256 i, uint256 mode) internal returns (bytes memory encoded, bytes32 messageId) {
        vm.chainId(420);
        configure(i);
        EthereumDepositGateway420 gateway = setupGateway();
        TokenEscrowBehavior420 t = mockToken(i, mode);
        SupportedTokenRoutes420.Profile memory p = profile(i);
        uint256 amount = 42 * 10 ** uint256(p.decimals);
        EthereumGatewayMessageVerifier420 messages =
            new EthereumGatewayMessageVerifier420(address(this), address(router));
        messages.setRoute(address(t), p.routeId);
        verifier.setMessageVerifier(address(messages));
        configure(i);
        bytes memory transaction = txBytes(address(gateway), address(t), amount, p.routeId);
        vm.chainId(1);
        gateway.setToken(address(t), true);
        vm.recordLogs();
        vm.prank(vm.addr(SOURCE_KEY));
        messageId = gateway.deposit(address(t), amount, 420, address(router), p.routeId, address(0xB0B));
        EthereumVm420.Log[] memory logs = vm.getRecordedLogs();
        require(t.balanceOf(address(gateway)) == amount, "exact escrow delta");
        vm.chainId(420);
        EthereumGatewayMessageVerifier420.Proof memory proof_;
        proof_.transactionIndex = 0;
        proof_.transaction = transaction;
        proof_.receipt = receipt(logs);
        proof_.logIndex = uint32(logs.length - 1);
        bytes memory txNode = singleLeaf(hex"80", transaction);
        bytes memory recNode = singleLeaf(hex"80", proof_.receipt);
        proof_.transactionProof = oneProof(txNode);
        proof_.receiptProof = oneProof(recNode);
        proof_.executionHeader = syntheticHeader(26411203, keccak256(txNode), keccak256(recNode));
        EthereumExecutionHeader420.Header memory h = EthereumExecutionHeader420.parse(proof_.executionHeader);
        encoded = abi.encode(h.number, h.blockHash, h.receiptsRoot, abi.encode(proof_));
    }

    function testGatewayAudioReceipt() public {
        qualifiedReceipt(0);
    }

    function testGatewayUniReceipt() public {
        qualifiedReceipt(1);
    }

    function testGatewayLinkReceipt() public {
        qualifiedReceipt(2);
    }

    function testGatewayAaveReceipt() public {
        qualifiedReceipt(3);
    }

    function testGatewayUsdtReceiptNoReturn() public {
        qualifiedReceiptMode(4, 1);
    }

    function testGatewayQcadReceipt() public {
        qualifiedReceipt(5);
    }

    function testGatewayEurcReceipt() public {
        qualifiedReceipt(6);
    }

    function qualifiedReceipt(uint256 i) internal {
        qualifiedReceiptMode(i, 0);
    }

    function qualifiedReceiptMode(uint256 i, uint256 mode) internal {
        (bytes memory encoded, bytes32 id) = depositProof(i, mode);
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(eth, encoded);
        require(
            v.sourceMessageId == id && v.amount == 42 ether && v.assetId == profile(i).assetId,
            "native receipt, route and amount"
        );
    }

    function unsupported(uint256 mode) internal {
        EthereumDepositGateway420 gateway = setupGateway();
        TokenEscrowBehavior420 t = mockToken(4, mode);
        vm.chainId(1);
        gateway.setToken(address(t), true);
        uint256 before_ = t.balanceOf(vm.addr(SOURCE_KEY));
        vm.prank(vm.addr(SOURCE_KEY));
        (bool ok,) = address(gateway)
            .call(
                abi.encodeCall(
                    gateway.deposit,
                    (address(t), uint256(42e6), uint256(420), address(router), profile(4).routeId, address(0xB0B))
                )
            );
        require(
            !ok && t.balanceOf(address(gateway)) == 0 && t.balanceOf(vm.addr(SOURCE_KEY)) == before_
                && gateway.nonce() == 0,
            "unsupported behavior rollback"
        );
    }

    function testGatewayRejectsTransferFee() public {
        unsupported(4);
    }

    function testGatewayRejectsSenderSurcharge() public {
        unsupported(5);
    }

    function testGatewayRejectsRebasingDelta() public {
        unsupported(6);
    }

    function testGatewayRejectsFalseReturn() public {
        unsupported(2);
    }

    function testGatewayRejectsTokenRevert() public {
        unsupported(3);
    }

    function testGatewayRejectsMalformedReturn() public {
        unsupported(7);
    }

    function testGatewayReceiptTamperedAmountRejected() public {
        (bytes memory encoded,) = depositProof(1, 0);
        (uint64 n, bytes32 h, bytes32 root, bytes memory proof_) =
            abi.decode(encoded, (uint64, bytes32, bytes32, bytes));
        EthereumGatewayMessageVerifier420.Proof memory p = abi.decode(proof_, (EthereumGatewayMessageVerifier420.Proof));
        p.receipt[p.receipt.length - 2] ^= 0x01;
        (bool ok,) = address(router)
            .call(
                abi.encodeCall(router.inbound, (IBridgeAdapter420(address(eth)), abi.encode(n, h, root, abi.encode(p))))
            );
        require(!ok, "tampered amount proof");
    }

    function testGatewayRejectsSourceDecimalDrift() public {
        EthereumDepositGateway420 gateway = setupGateway();
        TokenEscrowBehavior420 t = mockToken(4, 0);
        vm.chainId(1);
        gateway.setToken(address(t), true);
        t.setDecimals(18);
        vm.prank(vm.addr(SOURCE_KEY));
        (bool ok,) = address(gateway)
            .call(
                abi.encodeCall(
                    gateway.deposit,
                    (address(t), uint256(42e6), uint256(420), address(router), profile(4).routeId, address(0xB0B))
                )
            );
        require(!ok && gateway.nonce() == 0 && t.balanceOf(address(gateway)) == 0, "source decimal drift");
    }
}
