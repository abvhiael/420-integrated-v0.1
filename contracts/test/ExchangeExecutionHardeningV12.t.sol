// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeFeePolicy420.sol";
import "../src/exchange/ExchangeFeeRouter420.sol";

contract V12Token420 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public takeFee;
    bool public failTransferFrom;

    function configure(bool takeFee_, bool failTransferFrom_) external {
        takeFee = takeFee_;
        failTransferFrom = failTransferFrom_;
    }

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (failTransferFrom) return false;
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount && balanceOf[from] >= amount, "transferFrom");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        uint256 received = takeFee && amount > 1 ? amount - 1 : amount;
        balanceOf[to] += received;
        return true;
    }
}

contract V12DevelopmentVault420 {
    uint256 public received;
    function contributeToken(address token, bytes32, bytes32, bytes32, uint256 gross, uint16 bps) external {
        uint256 amount = gross * bps / 10_000;
        require(V12Token420(token).transferFrom(msg.sender, address(this), amount), "dev transfer");
        received += amount;
    }
}

contract ExchangeExecutionHardeningV12Test {
    address private constant PROTOCOL = address(0x1201);
    address private constant DEVELOPMENT = address(0x1202);
    address private constant COMMUNITY = address(0x1203);
    address private constant LIQUIDITY = address(0x1204);

    ExchangeFeePolicy420 private policy;
    ExchangeFeeRouter420 private router;
    V12DevelopmentVault420 private devVault;

    constructor() {
        policy = new ExchangeFeePolicy420(address(this));
        devVault = new V12DevelopmentVault420();
        policy.setFeeSplit(ExchangeFeePolicy420.FeeSplit(4000, 2000, 1500, 2000, 500));
        policy.setRecipients(ExchangeFeePolicy420.Recipients(PROTOCOL, DEVELOPMENT, COMMUNITY, LIQUIDITY, address(devVault)));
        policy.setExchangeFee(100);
        router = new ExchangeFeeRouter420(address(this), address(policy));
        router.setCollector(address(this), true);
    }

    function testFuzzFeeConservation(uint96 rawAmount) public {
        uint256 amount = uint256(rawAmount) + 10_000;
        V12Token420 token = new V12Token420();
        token.mint(address(this), amount);
        token.approve(address(router), amount);

        uint256 beforeRecipients = _recipientTotal(token);
        bytes32 tradeRef = keccak256(abi.encode("v12-fuzz", amount, address(token)));
        router.routeTokenFee(tradeRef, address(token), amount);

        require(_recipientTotal(token) - beforeRecipients == amount, "conservation");
        require(token.balanceOf(address(router)) == 0, "router residue");
        require(token.allowance(address(router), address(devVault)) == 0, "dev allowance residue");
        require(router.consumedTradeRef(tradeRef), "trade ref");
    }

    function testFeeOnTransferFailsClosed() public {
        V12Token420 token = new V12Token420();
        token.configure(true, false);
        token.mint(address(this), 100 ether);
        token.approve(address(router), 100 ether);
        bytes32 tradeRef = keccak256("v12-fee-on-transfer");
        (bool ok,) = address(router).call(abi.encodeWithSelector(router.routeTokenFee.selector, tradeRef, address(token), 100 ether));
        require(!ok, "fee-on-transfer accepted");
        require(!router.consumedTradeRef(tradeRef), "revert did not roll back replay state");
        require(token.balanceOf(address(router)) == 0, "residue after rollback");
    }

    function testFalseTransferFromFailsClosed() public {
        V12Token420 token = new V12Token420();
        token.configure(false, true);
        token.mint(address(this), 100 ether);
        token.approve(address(router), 100 ether);
        bytes32 tradeRef = keccak256("v12-false-transferFrom");
        (bool ok,) = address(router).call(abi.encodeWithSelector(router.routeTokenFee.selector, tradeRef, address(token), 100 ether));
        require(!ok, "false transferFrom accepted");
        require(!router.consumedTradeRef(tradeRef), "replay state survived revert");
    }

    function testReplayFailsWithoutSecondDistribution() public {
        V12Token420 token = new V12Token420();
        token.mint(address(this), 200 ether);
        token.approve(address(router), 200 ether);
        bytes32 tradeRef = keccak256("v12-replay");
        router.routeTokenFee(tradeRef, address(token), 100 ether);
        uint256 totalAfterFirst = _recipientTotal(token);
        (bool ok,) = address(router).call(abi.encodeWithSelector(router.routeTokenFee.selector, tradeRef, address(token), 100 ether));
        require(!ok, "replay accepted");
        require(_recipientTotal(token) == totalAfterFirst, "replay distributed twice");
        require(token.balanceOf(address(router)) == 0, "router residue");
    }

    function _recipientTotal(V12Token420 token) private view returns (uint256) {
        return token.balanceOf(PROTOCOL) + token.balanceOf(DEVELOPMENT) + token.balanceOf(COMMUNITY)
            + token.balanceOf(LIQUIDITY) + token.balanceOf(address(devVault));
    }
}
