// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerWS8ProductionFixture54.sol";

/// @notice Contract-derived export only; no proof-admission or settlement claim.
contract BetPokerWS8FrozenHandContext54Test is PokerWS8ProductionFixture54 {
    event WS8ProverHandScope(uint256 scope,bytes32 indexed handId);
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


    event WS8StatementContext(bytes encoded);
    event WS8ProductionComponents(address initialDeck,address shuffle,address recipientKeys,address proofBook,address nativeEngine,address reveals,address outcome);
    event WS8InitialStatement(bytes32 statement,bytes32 candidateRoot);
    event WS8ShuffleStatement(uint8 stage,bytes32 statement,bytes32 inputRoot,bytes32 outputRoot);
    event WS8RecipientScope(uint8 seat,uint256 scope,uint64 epoch);
    event WS8AggregateScope(uint256 scope,uint256[6] points);
    event WS8NativeImplementationIdentity(string role,address implementation,bytes32 runtimeCodeHash,uint256 runtimeBytes);
    function _nativeIdentity(string memory role,address implementation) internal {
        require(implementation.code.length>0&&implementation.code.length<=24576,"native implementation exceeds deployment limit");
        emit WS8NativeImplementationIdentity(role,implementation,implementation.codehash,implementation.code.length);
    }

    /// @dev Prover input export only. It admits no proof and issues no Level 2
    /// certificate; the original frozen/admitted owner below must still pass.
    function testExportFundedContextForProver() public {
        bytes32 id=_ws8FundedHand();
        emit WS8ProverHandScope(uint256(id)%WS8_FR,id);
        emit WS8StatementContext(abi.encode(_ws8Context(id)));
    }

    function testFreezeCanonicalFundedHandContext() public {
        bytes32 handId=_ws8FundedHand();
        emit WS8ProverHandScope(uint256(handId)%WS8_FR,handId);
        PokerConfidentialDeal420.Hand memory h=deal.getHand(handId);
        PokerTableRegistry420.Table memory t=registry.getTable(TABLE);
        address signerA=ws8vm.addr(WS8_PLAYER_KEY);address signerB=ws8vm.addr(WS8_OPPONENT_KEY);
        emit WS8SeatSigningKeys(PLAYER,PLAYER_B,signerA,signerB,
            ledger.seatOf(TABLE,0).epoch,ledger.seatOf(TABLE,1).epoch);
        emit WS8ProviderBonds(address(ws8Bonds),800,1600,800);
        emit WS8FrozenHand(handId,TABLE,h.configHash,h.rulesetId,h.versionId,
            h.seatSnapshotHash,ledger.lockedSnapshot(TABLE),h.transcriptCommitment,h.epoch,h.nonce,h.deadline,
            block.chainid,address(deal),address(ledger),800,400,400,
            PROVIDER_A,PROVIDER_B,t.config.rakePolicyHash);
        emit WS8ProductionComponents(address(ws8Initial),address(ws8Shuffle),address(ws8Recipients),
            address(ws8Book),address(ws8Engine),address(ws8Live),address(ws8Outcome));
        _nativeIdentity("engine",address(ws8Engine));
        _nativeIdentity("clock",address(ws8Disputes));
        _nativeIdentity("admission",ws8Engine.admissionModule());
        _nativeIdentity("play",ws8Engine.playModule());
        _nativeIdentity("custody",ws8Engine.custodyModule());
        _nativeIdentity("settlement",ws8Engine.settlementModule());
        _nativeIdentity("admission-factory",address(PokerNLHEAdmissionFactory420));
        _nativeIdentity("play-factory",address(PokerNLHEPlayFactory420));
        _nativeIdentity("custody-factory",address(PokerNLHECustodyFactory420));
        _nativeIdentity("settlement-factory",address(PokerNLHESettlementFactory420));
        for(uint8 i;i<7;i++){
            (bytes32 circuit,bytes32 schema)=WS8VerifierData.identity(i);
            emit WS8VerifierIdentity(i,ws8Backends[i],ws8Keys[i],ws8Backends[i].codehash,circuit,schema);
            require(ws8Versions.matches(_ws8Version(i),ws8Backends[i],ws8Keys[i],circuit,schema),"verifier provenance");
        }
        for(uint8 seat;seat<2;seat++){
            PokerSeatLedger420.Seat memory s=ledger.seatOf(TABLE,seat);
            emit WS8RecipientScope(seat,ws8Recipients.scopeForKey(TABLE,s.player,s.epoch),s.epoch);
        }
        uint256[6] memory points=WS8VerifierData.keys();
        emit WS8AggregateScope(ws8Book.aggregateScope(points),points);
        emit WS8StatementContext(abi.encode(_ws8Context(handId)));
        bytes32[3] memory roots=abi.decode(ws8vm.readFileBinary("../clients/420bet-poker/zkshuffle/fixtures/ws8/proofs/roots.bin"),(bytes32[3]));
        bytes32 initialRoot=roots[0];bytes32 firstRoot=roots[1];bytes32 finalRoot=roots[2];
        (,uint256[5] memory initialPublic)=abi.decode(ws8vm.readFileBinary("../clients/420bet-poker/zkshuffle/fixtures/ws8/proofs/WS8Initial.abi"),(uint256[8],uint256[5]));
        (,uint256[6] memory firstPublic)=abi.decode(ws8vm.readFileBinary("../clients/420bet-poker/zkshuffle/fixtures/ws8/proofs/WS8Shuffle1.abi"),(uint256[8],uint256[6]));
        (,uint256[6] memory finalPublic)=abi.decode(ws8vm.readFileBinary("../clients/420bet-poker/zkshuffle/fixtures/ws8/proofs/WS8Shuffle2.abi"),(uint256[8],uint256[6]));
        require(initialPublic[1]==uint256(ws8Initial.statement(handId,initialRoot))%WS8_FR,"initial contract statement differs");
        require(firstPublic[1]==uint256(ws8Shuffle.statement(handId,1,initialRoot,firstRoot))%WS8_FR,"first contract statement differs");
        require(finalPublic[1]==uint256(ws8Shuffle.statement(handId,2,firstRoot,finalRoot))%WS8_FR,"second contract statement differs");
        emit WS8InitialStatement(ws8Initial.statement(handId,initialRoot),initialRoot);
        emit WS8ShuffleStatement(1,ws8Shuffle.statement(handId,1,initialRoot,firstRoot),initialRoot,firstRoot);
        emit WS8ShuffleStatement(2,ws8Shuffle.statement(handId,2,firstRoot,finalRoot),firstRoot,finalRoot);
    }
}
