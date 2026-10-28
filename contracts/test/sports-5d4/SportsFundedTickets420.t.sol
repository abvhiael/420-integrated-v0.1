// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SportsBetAcceptance420.t.sol";
import "../../src/bet/sports/SportsFundedTickets420.sol";

interface SportsFundingVm { function deal(address,uint256) external; }

contract SportsFundedTickets420Test is SportsBetAcceptance420Test {
    SportsFundedTickets420 vault;
    SportsOutcomeCertification420 cert;
    address constant REPORT_A = address(0xABCD);
    address constant REPORT_B = address(0xBCDE);
    address constant JUDGE = address(0xCDEF);
    SportsFundingVm constant fundingVm = SportsFundingVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function setUp() public virtual override {
        super.setUp();
        cert = new SportsOutcomeCertification420(address(markets), REPORT_A, REPORT_B, JUDGE, 1 hours);
        vault = new SportsFundedTickets420(address(auth), address(acceptance), address(cert));
        _grant(CONTROL, vault.RESOLVE(), vault.scope(market));
        fundingVm.deal(CONTROL, 1 ether);
        fundingVm.deal(PLAYER, 1 ether);
        vm.prank(CONTROL);
        token.deposit{value: 20000}();
        vm.prank(CONTROL);
        token.approve(address(vault), type(uint256).max);
        vm.prank(PLAYER);
        token.deposit{value: 10000}();
        vm.prank(PLAYER);
        token.approve(address(vault), type(uint256).max);
    }

    function _fund(uint256 amount) internal returns (bytes32 id) {
        SportsBetAcceptance420.Offer memory offer = _offer(amount);
        vm.prank(PLAYER);
        id = vault.fund(offer);
    }

    function testFundedTicketLockedAndCollateralReserved() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        SportsFundedTickets420.Ticket memory t = vault.get(id);
        require(t.player == PLAYER && t.gross == 925 && t.profit == 425, "immutable locked ticket");
        require(uint256(t.state) == 1 && vault.reserved(market) == 425, "reserved liability");
        require(token.balanceOf(address(vault)) == 2500, "atomic escrow custody");
        SportsBetAcceptance420.Offer memory duplicate = _offer(500);
        vm.prank(PLAYER);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.fund, (duplicate)));
        require(!ok, "nonce replay");
        _fails(CONTROL, address(vault), abi.encodeCall(vault.withdrawCollateral, (market, 1600)));
    }

    function testRejectUncollateralizedAndUnfundedAdmission() public {
        _submit(_quote(1));
        SportsBetAcceptance420.Offer memory o = _offer(500);
        vm.prank(PLAYER);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.fund, (o)));
        require(!ok, "no collateral");
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        vm.prank(address(0xBAD));
        (ok,) = address(vault).call(abi.encodeCall(vault.fund, (o)));
        require(!ok, "no funded payer");
    }

    function testRefundTimeoutAndOneTerminalOutcome() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        (bool early,) = address(vault).call(abi.encodeCall(vault.refund, (id)));
        require(!early, "premature refund");
        SportsMarketRegistry420.Record memory m = markets.get(market);
        vm.warp(uint256(m.config.cutoff) + 86400);
        vault.refund(id);
        require(vault.credit(PLAYER, address(token)) == 500 && vault.reserved(market) == 0, "refund and release");
        (bool again,) = address(vault).call(abi.encodeCall(vault.refund, (id)));
        require(!again, "duplicate close");
        vm.prank(PLAYER);
        vault.claim(address(token));
        require(token.balanceOf(PLAYER) == 10000, "claim exact stake");
        require(vault.credit(PLAYER, address(token)) == 0, "single withdrawal");
    }

    function _certifyWinner() internal {
        bytes32 evidence = keccak256("feed-evidence");
        vm.prank(REPORT_A);
        cert.attest(market, chosen, evidence);
        vm.prank(REPORT_B);
        cert.attest(market, chosen, evidence);
        vm.warp(block.timestamp + 1 hours);
        cert.finalize(market);
    }

    function testWinnerCreditsProfitAndDoesNotDoublePay() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        vm.warp(markets.get(market).config.cutoff + 1);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        _certifyWinner();
        _call(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        require(vault.credit(PLAYER, address(token)) == 925 && vault.collateral(market) == 1575, "profit collateral used");
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, false)));
        vm.prank(PLAYER);
        vault.claim(address(token));
        require(token.balanceOf(PLAYER) == 10425, "gross payout exactly once");
    }

    function testDisputePreventsSettlementAndVoidRefunds() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        vm.warp(markets.get(market).config.cutoff + 1);
        bytes32 ev = keccak256("feed-A");
        vm.prank(REPORT_A);
        cert.attest(market, chosen, ev);
        vm.prank(REPORT_B);
        (bool mismatch,) = address(cert).call(abi.encodeCall(cert.attest, (market, chosen, keccak256("feed-B"))));
        require(!mismatch, "source mismatch must reject");
        vm.prank(REPORT_B);
        cert.attest(market, chosen, ev);
        cert.challenge(market, keccak256("player-evidence"));
        vm.warp(markets.get(market).config.cutoff + 1 days);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        (bool early,) = address(cert).call(abi.encodeCall(cert.finalize, (market)));
        require(!early, "challenged finality bypass");
        vm.prank(JUDGE);
        cert.decide(market, true, keccak256("review-evidence"));
        vault.refund(id);
        require(vault.credit(PLAYER, address(token)) == 500, "void refund");
    }

    function testOperatorCannotForgeAttestation() public {
        vm.prank(CONTROL);
        (bool ok,) = address(cert).call(abi.encodeCall(cert.attest, (market, chosen, keccak256("fake"))));
        require(!ok, "operator not independent certifier");
    }

    function testPrematureCertificationAndWrongWinnerAreRejected() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        vm.prank(REPORT_A);
        (bool premature,) = address(cert).call(abi.encodeCall(cert.attest, (market, chosen, keccak256("early"))));
        require(!premature, "premature certification");
        vm.warp(markets.get(market).config.cutoff + 1);
        _certifyWinner();
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, false)));
        _call(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
    }

    function testChallengeCannotBeSilentlyDismissedOrRepeated() public {
        vm.warp(markets.get(market).config.cutoff + 1);
        bytes32 ev = keccak256("two-source-evidence");
        vm.prank(REPORT_A);
        cert.attest(market, chosen, ev);
        vm.prank(REPORT_B);
        cert.attest(market, chosen, ev);
        cert.challenge(market, keccak256("challenge-A"));
        (bool repeated,) = address(cert).call(abi.encodeCall(cert.challenge, (market, keccak256("challenge-B"))));
        require(!repeated, "one review state");
        vm.prank(CONTROL);
        (bool forged,) = address(cert).call(abi.encodeCall(cert.decide, (market, false, keccak256("forged"))));
        require(!forged, "unauthorized arbitrator");
        vm.warp(block.timestamp + 2 hours);
        (bool finalizeBypass,) = address(cert).call(abi.encodeCall(cert.finalize, (market)));
        require(!finalizeBypass, "appeal freezes automatic finality");
        vm.prank(JUDGE);
        cert.decide(market, false, keccak256("reviewed"));
        SportsOutcomeCertification420.Result memory r = cert.result(market);
        require(r.status == SportsOutcomeCertification420.Status.FINAL, "review complete");
        vm.prank(JUDGE);
        (bool again,) = address(cert).call(abi.encodeCall(cert.decide, (market, true, keccak256("revised"))));
        require(!again, "no second finalization");
    }

    function testNonFinalOutcomeTriggersTimeoutRefund() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        vm.warp(markets.get(market).config.cutoff + 86400);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        vault.refund(id);
        require(vault.credit(PLAYER, address(token)) == 500, "timeout preserves player stake");
    }

    /// @notice Bookkeeping must exactly explain vault custody while claims are pending.
    function _assertSingleMarketSolvent() internal view {
        uint256 accounted = vault.collateral(market) + vault.pendingStake(market)
            + vault.credit(PLAYER, address(token));
        require(token.balanceOf(address(vault)) == accounted, "unbacked claim / unallocated custody");
        require(vault.reserved(market) <= vault.collateral(market), "overdrawn collateral");
        require(vault.marketProfitExposure(market) == vault.reserved(market), "reservation mismatch");
    }

    function testAccountingInvariantAcrossAdmissionWinAndClaim() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        _assertSingleMarketSolvent();
        bytes32 id = _fund(500);
        _assertSingleMarketSolvent();
        vm.warp(markets.get(market).config.cutoff + 1);
        _certifyWinner();
        _call(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        _assertSingleMarketSolvent();
        vm.prank(PLAYER);
        vault.claim(address(token));
        _assertSingleMarketSolvent();
    }

    function testAccountingInvariantAcrossLossAndCollateralWithdrawal() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        _assertSingleMarketSolvent();
        vm.warp(markets.get(market).config.cutoff + 1);
        bytes32 evidence = keccak256("independent-losing-result");
        bytes32[] memory options = markets.selections(market);
        bytes32 other = options[1];
        vm.prank(REPORT_A);
        cert.attest(market, other, evidence);
        vm.prank(REPORT_B);
        cert.attest(market, other, evidence);
        vm.warp(block.timestamp + 1 hours);
        cert.finalize(market);
        _call(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, false)));
        _assertSingleMarketSolvent();
        _call(CONTROL, address(vault), abi.encodeCall(vault.withdrawCollateral, (market, 2500)));
        _assertSingleMarketSolvent();
    }

    function testFuzzRefundAccounting(uint16 rawStake) public {
        uint256 stake = 100 + uint256(rawStake) % 901;
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(stake);
        _assertSingleMarketSolvent();
        vm.warp(markets.get(market).config.cutoff + 86400);
        vault.refund(id);
        _assertSingleMarketSolvent();
        vm.prank(PLAYER);
        vault.claim(address(token));
        _assertSingleMarketSolvent();
    }

    function _assertAssetConservation() internal view {
        uint256 amount = vault.assetLiability(address(token));
        require(token.balanceOf(address(vault)) == amount, "aggregate asset undercollateralized");
        require(amount == vault.assetCollateral(address(token)) + vault.assetPendingStake(address(token))
            + vault.assetPlayerCredit(address(token)), "component sum");
    }

    function testTwoMarketsShareTokenWithoutDoubleCountingCollateral() public {
        bytes32 spreadTemplate = _newTemplate(_templateConfig(SportsTypes420.Kind.SPREAD));
        bytes32 second = _newMarket(_marketConfig(spreadTemplate, -7));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 1200)));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (second, 800)));
        _assertAssetConservation();
        require(vault.assetLiability(address(token)) == 2000, "two market accounting");
        require(vault.collateral(market) == 1200 && vault.collateral(second) == 800, "market isolation");
        _fails(CONTROL, address(vault), abi.encodeCall(vault.withdrawCollateral, (second, 801)));
        _call(CONTROL, address(vault), abi.encodeCall(vault.withdrawCollateral, (market, 700)));
        _assertAssetConservation();
        require(vault.assetLiability(address(token)) == 1300 && vault.collateral(second) == 800, "isolated withdraw");
        _call(CONTROL, address(vault), abi.encodeCall(vault.withdrawCollateral, (second, 800)));
        _assertAssetConservation();
    }

    function testFuzzAssetConservationAcrossDepositsAndWithdrawals(uint16 a, uint16 b) public {
        uint256 first = uint256(a) % 2000 + 1;
        uint256 second = uint256(b) % 2000 + 1;
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, first)));
        _assertAssetConservation();
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, second)));
        _assertAssetConservation();
        _call(CONTROL, address(vault), abi.encodeCall(vault.withdrawCollateral, (market, first)));
        _assertAssetConservation();
        _call(CONTROL, address(vault), abi.encodeCall(vault.withdrawCollateral, (market, second)));
        _assertAssetConservation();
    }

    function testStaleQuoteCannotBeFunded() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        SportsBetAcceptance420.Offer memory o = _offer(500);
        _submit(_quote(2));
        vm.prank(PLAYER);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.fund, (o)));
        require(!ok && vault.reserved(market) == 0, "no stale quote funding");
    }
}

contract HostileSportsToken420 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint8 public mode; // 1 false return; 2 transfer fee; 3 reenter target during transfer
    address public target;
    bytes public attack;
    bool public nested;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function rebaseDown(address who, uint256 amount) external { balanceOf[who] -= amount; }
    function rebaseUp(address who, uint256 amount) external { balanceOf[who] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function configure(uint8 mode_, address target_, bytes calldata attack_) external {
        mode = mode_;
        target = target_;
        attack = attack_;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (mode == 1) return false;
        require(allowance[from][msg.sender] >= amount && balanceOf[from] >= amount);
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        uint256 credited = mode == 2 ? amount - 1 : amount;
        balanceOf[to] += credited;
        if (mode == 4) { assembly { return(0, 0) } }
        if (mode == 3 && !nested) {
            nested = true;
            (bool ok,) = target.call(attack);
            require(!ok, "reentrancy unexpectedly succeeded");
            nested = false;
        }
        return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount);
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract SportsHostileToken420Test is SportsFundedTickets420Test {
    HostileSportsToken420 hostile;
    bytes32 hostileMarket;

    function _hostileSetup(uint8 mode) internal {
        hostile = new HostileSportsToken420();
        // Proposition identity deliberately ignores the token address. A second
        // MONEYLINE_TWO fixture would conflict with the existing live market.
        bytes32 hostileTemplate = _newTemplate(_templateConfig(SportsTypes420.Kind.SPREAD));
        SportsTypes420.MarketConfig memory cfg = _marketConfig(hostileTemplate, -7);
        cfg.asset = address(hostile);
        hostileMarket = _newMarket(cfg);
        require(hostileMarket != market && markets.idFor(cfg) == hostileMarket, "distinct hostile proposition");
        hostile.mint(CONTROL, 10000);
        vm.prank(CONTROL);
        hostile.approve(address(vault), type(uint256).max);
        hostile.configure(mode, address(vault), abi.encodeCall(vault.deposit, (hostileMarket, 100)));
    }

    function testHostileFalseReturnTokenCannotMintCollateral() public {
        _hostileSetup(1);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.deposit, (hostileMarket, 100)));
        require(vault.collateral(hostileMarket) == 0 && hostile.balanceOf(address(vault)) == 0, "false return collateral");
    }

    function testHostileFeeOnTransferCannotMintCollateral() public {
        _hostileSetup(2);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.deposit, (hostileMarket, 100)));
        require(vault.collateral(hostileMarket) == 0 && hostile.balanceOf(address(vault)) == 0, "fee token collateral");
    }

    function testMissingReturnCannotMintCollateral() public {
        _hostileSetup(4);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.deposit, (hostileMarket, 100)));
        require(vault.collateral(hostileMarket) == 0 && hostile.balanceOf(address(vault)) == 0, "missing return collateral");
    }

    function testNegativeRebaseBlocksCollateralRelease() public {
        _hostileSetup(0);
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (hostileMarket, 100)));
        hostile.rebaseDown(address(vault), 1);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.withdrawCollateral, (hostileMarket, 1)));
        require(vault.collateral(hostileMarket) == 100 && vault.assetLiability(address(hostile)) == 100, "rebase mutated ledger");
    }

    function testPositiveRebaseBlocksCollateralRelease() public {
        _hostileSetup(0);
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (hostileMarket, 100)));
        hostile.rebaseUp(address(vault), 1);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.withdrawCollateral, (hostileMarket, 1)));
        require(vault.collateral(hostileMarket) == 100 && vault.assetLiability(address(hostile)) == 100, "positive drift bypass");
    }

    function testHostileReentryCannotModifyVaultLedger() public {
        _hostileSetup(3);
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (hostileMarket, 100)));
        require(vault.collateral(hostileMarket) == 100 && hostile.balanceOf(address(vault)) == 100, "reentry changed ledger");
    }
}
