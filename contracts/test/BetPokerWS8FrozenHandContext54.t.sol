// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerConfidentialDeal54.t.sol";
import "../src/bet/PokerInitialEncryptedDeck420.sol";
import "../src/bet/PokerPrivateShuffleGate420.sol";
import "../src/bet/PokerProviderAccountability420.sol";
import "../src/bet/PokerActionKeys420.sol";

/// @notice WS8 PASS ONE: immutable contract-derived context export.
/// @dev Not a proof-admission/settlement qualification. The real Groth16 owners
/// consume these emissions in pass two. No always-accept proof backend is used.
contract BetPokerWS8FrozenHandContext54Test is PokerConfidentialDeal54Test {
    uint256 internal constant CONTEXT_CHAIN_ID = 31337;
    uint256 internal constant CONTEXT_TIMESTAMP = 1_700_000_000;
    uint16 internal constant SEATS_MASK = 3;
    address internal constant RISK_VAULT = address(0xB00D);
    bytes32 internal constant PREVIOUS_STATE = keccak256("WS8.PREVIOUS.STATE.V1");

    event WS8ProviderBonds(address indexed bondVault,uint256 perProvider,uint256 totalCollateral,uint256 playerEscrow);
    event WS8SeatSigningKeys(address indexed player0,address indexed player1,address signer0,address signer1,uint64 epoch0,uint64 epoch1);
    event WS8FrozenHand(
        bytes32 indexed handId,bytes32 indexed tableId,bytes32 configHash,
        bytes32 rulesetId,bytes32 gameVersionId,bytes32 seatSnapshot,
        bytes32 escrowSnapshot,bytes32 transcriptCommitment,
        uint64 seatingEpoch,uint64 nonce,uint64 deadline,
        uint256 chainId,address dealAddress,address ledgerAddress,
        uint256 reservedChips,uint256 player0Chips,uint256 player1Chips,
        address provider0,address provider1,bytes32 rakePolicyHash
    );

    function _freeze() internal returns(bytes32 handId) {
        cheat54.warp(CONTEXT_TIMESTAMP);
        _prepared();
        bytes32 snapshot = deal.snapshotFor(TABLE,SEATS_MASK);
        cheat54.prank(ADMIN);
        handId=deal.begin(TABLE,1,uint64(block.timestamp+3600),PREVIOUS_STATE,snapshot,SEATS_MASK);
        cheat54.prank(PROVIDER_A);
        deal.commit(handId,keccak256("WS8.INDEPENDENT.PROVIDER.A.V1"));
        cheat54.prank(PROVIDER_B);
        deal.commit(handId,keccak256("WS8.INDEPENDENT.PROVIDER.B.V1"));
        require(deal.getHand(handId).state==PokerConfidentialDeal420.State.COMMITTED,
            "two independent commitments required");
    }

    function testFreezeCanonicalFundedHandContext() public {
        require(block.chainid==CONTEXT_CHAIN_ID,
            "WS8 runner MUST pin chainid=31337: refuse different Groth16 context");
        bytes32 handId=_freeze();
        PokerActionKeys420 signing=new PokerActionKeys420(address(deal));
        cheat54.prank(PLAYER);signing.bindSigner(TABLE,address(0xC001));
        cheat54.prank(PLAYER_B);signing.bindSigner(TABLE,address(0xC002));
        emit WS8SeatSigningKeys(PLAYER,PLAYER_B,address(0xC001),address(0xC002),
            ledger.seatOf(TABLE,0).epoch,ledger.seatOf(TABLE,1).epoch);
        PokerConfidentialDeal420.Hand memory h=deal.getHand(handId);
        PokerTableRegistry420.Table memory t=registry.getTable(TABLE);
        require(h.tableId==TABLE&&h.nonce==1&&h.epoch==ledger.seatingEpoch(TABLE),
            "immutable hand identity");
        require(h.configHash==t.configHash&&h.rulesetId==t.config.rulesetId
            &&h.versionId==t.config.gameVersionId, "immutable game configuration");
        require(h.seatSnapshotHash==deal.snapshotFor(TABLE,SEATS_MASK),
            "seat snapshot mismatch");
        require(ledger.seatOf(TABLE,0).player==PLAYER
            &&ledger.seatOf(TABLE,1).player==PLAYER_B, "wrong seated owners");
        require(ledger.seatOf(TABLE,0).chips==400
            &&ledger.seatOf(TABLE,1).chips==400, "funding differs");
        // The export pass freezes actual escrow via the production ledger.
        // This export fixture is a temporary settlement coordinator ONLY;
        // WS8 pass two must bind the real production settlement engine.
        cap.grant(ADMIN,ledger.ACTION_BIND_SETTLEMENT(),auth.scopeForTable(TABLE),true);
        cheat54.prank(ADMIN);
        ledger.bindSettlement(TABLE,address(this),RISK_VAULT);
        bytes32 locked=ledger.reserveHand(TABLE,handId,SEATS_MASK,h.epoch);
        require(locked==ledger.lockedSnapshot(TABLE), "reserved snapshot altered");
        require(ledger.reservedInHand(TABLE)==800 && ledger.lockedTotal(TABLE)==800
            &&ledger.activeHand(TABLE)==handId, "actual 800-chip escrow not locked");
        require(coin.balanceOf(address(ledger))==800, "escrow conservation failed");
        // Real collateral custody, pre-funded and locked by the export-pass
        // coordinator. The production NLHE engine replaces this temporary
        // coordinator for the final proof-admission fixture in pass two.
        PokerProviderAccountability420 bonds=
            new PokerProviderAccountability420(address(deal),address(this),RISK_VAULT);
        coin.mint(PROVIDER_A,800);
        coin.mint(PROVIDER_B,800);
        cheat54.prank(PROVIDER_A);coin.approve(address(bonds),800);
        cheat54.prank(PROVIDER_B);coin.approve(address(bonds),800);
        cheat54.prank(PROVIDER_A);bonds.fundAsset(address(coin),800);
        cheat54.prank(PROVIDER_B);bonds.fundAsset(address(coin),800);
        require(bonds.available(address(coin),PROVIDER_A)==800
            &&bonds.available(address(coin),PROVIDER_B)==800,"provider deposits missing");
        bonds.lock(handId);
        require(bonds.isCollateralized(handId),"both provider bonds must lock");
        require(coin.balanceOf(address(bonds))==1600,"provider collateral is not funded");
        require(coin.balanceOf(address(ledger))==800,"collateral mixed into player escrow");
        emit WS8ProviderBonds(address(bonds),800,1600,800);
        emit WS8FrozenHand(handId,TABLE,h.configHash,h.rulesetId,h.versionId,
            h.seatSnapshotHash,locked,h.transcriptCommitment,h.epoch,h.nonce,h.deadline,
            block.chainid,address(deal),address(ledger),800,400,400,
            PROVIDER_A,PROVIDER_B,t.config.rakePolicyHash);
    }
}
