// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../fantasy/FantasyDisputeController420.t.sol";
import "../../src/bet/fantasy/FantasySlateBook420.sol";
import "../../src/bet/fantasy/FantasyNHLScoring420.sol";
interface VmFantasyOracle420 {
    function envString(string calldata) external returns(string memory);
    function readFile(string calldata) external returns(string memory);
    function parseBytes(string calldata) external returns(bytes memory);
}
contract FantasySportradarOracle420Test is FantasyDisputeFixture420 {
    struct Vector {
        bytes32 slate; bytes32 game; uint64 scheduled; uint64 cutoff; uint64 asOf;
        uint64 actualStart; uint64 finalAt; bytes32 evidence; bytes32 root;
        uint32[] ids; uint8[] positions; FantasyTypes420.Stats[] stats;
        bytes32[][] proofs; int256[] points;
    }
    Vector v;
    FantasySlateBook420 book;
    FantasyNHLScoring420 scorer;
    bytes32 constant DATA_FEED = keccak256("sportradar-single-upstream-two-operators");
    event Connected(address book,address router,bytes32 slate,bytes32 manifest,bytes32 feed,
        bytes32 resultDigest,bytes32 statsDigest,bytes32 root,bytes32 evidence,uint64 asOf,uint256 leaves);
    event Identity(bytes32 kind,address deployed,bytes32 runtimeHash,uint256 runtimeBytes);
    event Calls(bytes resolveCalldata,bytes verifyStatsCalldata,bytes observationCalldata);
    function setUp() public override {
        super.setUp();
        VmFantasyOracle420 extra=VmFantasyOracle420(address(vm));
        v=abi.decode(extra.parseBytes(extra.readFile(extra.envString("FANTASY_ORACLE_VECTOR"))),(Vector));
        require(v.ids.length==v.positions.length && v.ids.length==v.stats.length && v.ids.length==v.proofs.length && v.ids.length==v.points.length && v.ids.length<=64,"vector inventory");
        vm.warp(v.scheduled-100);
        book=new FantasySlateBook420(address(auth),address(router)); scorer=new FantasyNHLScoring420();
        _feed(DATA_FEED);_grant(address(this),book.PUBLISH(),auth.scopeForContest(v.slate));
        FantasyTypes420.Game[] memory games=new FantasyTypes420.Game[](1);games[0]=FantasyTypes420.Game(v.game,v.scheduled);
        FantasyTypes420.Athlete[] memory athletes=new FantasyTypes420.Athlete[](v.ids.length);
        for(uint256 i;i<v.ids.length;i++)athletes[i]=FantasyTypes420.Athlete(v.ids[i],v.game,v.positions[i]);
        book.publish(v.slate,DATA_FEED,keccak256("test-custodian-key"),keccak256("test-custodian-group"),address(this),v.cutoff,games,athletes);
        book.sealSlate(v.slate);vm.warp(v.asOf);
    }
    function _results() internal view returns(FantasyTypes420.GameResult[] memory result){
        result=new FantasyTypes420.GameResult[](1);
        result[0]=FantasyTypes420.GameResult(v.game,v.actualStart,v.finalAt,v.finalAt,true,true,false);
    }
    function _statReport() internal view returns(FantasyTypes420.StatReport memory){
        return FantasyTypes420.StatReport(v.root,v.evidence,1,v.asOf);
    }
    function _observation(bytes32 provider,bytes32 digest,uint256 nonce) internal view returns(bytes memory){
        return abi.encodeCall(router.submitObservation,(DATA_FEED,provider,keccak256(abi.encode("sportradar-observation",nonce)),int256(0),digest,v.evidence,uint64(block.timestamp),uint16(10000)));
    }
    function _send(address operator,bytes32 provider,bytes32 digest,uint256 nonce) internal {
        vm.prank(operator);(bool ok,bytes memory error)=address(router).call(_observation(provider,digest,nonce));
        if(!ok)assembly {revert(add(error,32),mload(error))}
    }
    function _resolve() internal {
        bytes32 digest=book.resultDigest(v.slate,_results(),v.evidence);
        _send(OP_A,PA,digest,1);_send(OP_B,PB,digest,2);book.resolve(v.slate,_results(),v.evidence);
        vm.warp(block.timestamp+1);
    }
    function _accept() internal {
        _resolve();bytes32 digest=book.statDigest(v.slate,_statReport());
        _send(OP_A,PA,digest,3);_send(OP_B,PB,digest,4);book.verifyStats(v.slate,_statReport());
    }
    function testVerifiedProviderStatisticsReachCanonicalOracleAndScorer() public {
        _accept();require(router.readResult(DATA_FEED).agreeingSources==2,"real quorum");
        for(uint256 i;i<v.ids.length;i++){
            require(scorer.score(v.stats[i],v.positions[i]==16)==v.points[i],"independent score");
            uint32[7] memory ids;FantasyTypes420.Stats[7] memory stats;bytes32[][7] memory proofs;
            for(uint256 j;j<7;j++){ids[j]=v.ids[i];stats[j]=v.stats[i];proofs[j]=v.proofs[i];}
            require(scorer.calculate(address(book),v.slate,1,v.root,ids,abi.encode(stats,proofs))==v.points[i]*7,"every leaf proof");
        }
        // Exercise actual proof verification through a valid position-based lineup.
        uint8[7] memory wanted=[uint8(1),2,4,8,8,16,1];
        uint32[7] memory lineup;FantasyTypes420.Stats[7] memory statistics;bytes32[][7] memory proof;int256 expected;
        bool[] memory used=new bool[](v.ids.length);
        for(uint256 slot;slot<7;slot++){
            bool found;
            for(uint256 i;i<v.ids.length;i++)if(!used[i] && v.positions[i]==wanted[slot]){
                used[i]=true;found=true;lineup[slot]=v.ids[i];statistics[slot]=v.stats[i];proof[slot]=v.proofs[i];expected+=v.points[i];break;
            }
            require(found,"position inventory");
        }
        require(scorer.calculate(address(book),v.slate,1,v.root,lineup,abi.encode(statistics,proof))==expected,"real Merkle scoring");
        bytes32 rd=book.resultDigest(v.slate,_results(),v.evidence);bytes32 sd=book.statDigest(v.slate,_statReport());
        emit Identity(keccak256("FantasySlateBook420"),address(book),address(book).codehash,address(book).code.length);
        emit Identity(keccak256("OracleRouter420"),address(router),address(router).codehash,address(router).code.length);
        emit Identity(keccak256("OracleProviderRegistry420"),address(providers),address(providers).codehash,address(providers).code.length);
        emit Identity(keccak256("OracleFeedRegistry420"),address(feeds),address(feeds).codehash,address(feeds).code.length);
        emit Identity(keccak256("FantasyNHLScoring420"),address(scorer),address(scorer).codehash,address(scorer).code.length);
        emit Connected(address(book),address(router),v.slate,book.slateOf(v.slate).manifest,DATA_FEED,rd,sd,v.root,v.evidence,v.asOf,v.ids.length);
        emit Calls(abi.encodeCall(book.resolve,(v.slate,_results(),v.evidence)),abi.encodeCall(book.verifyStats,(v.slate,_statReport())),_observation(PA,sd,3));
    }
    function testSingleOperatorCannotSatisfyQuorum() public {
        _send(OP_A,PA,book.resultDigest(v.slate,_results(),v.evidence),1);
        vm.expectRevert(OracleRouter420.InsufficientFreshSources.selector);book.resolve(v.slate,_results(),v.evidence);
    }
    function testUnauthorisedOperatorCannotReport() public {
        vm.prank(USER);vm.expectRevert(OracleRouter420.UnauthorizedProvider.selector);
        router.submitObservation(DATA_FEED,PA,keccak256("bad"),0,v.root,v.evidence,v.asOf,10000);
    }
    function testConflictingOperatorsCannotSatisfyQuorum() public {
        _send(OP_A,PA,book.resultDigest(v.slate,_results(),v.evidence),1);_send(OP_B,PB,keccak256("different"),2);
        vm.expectRevert(OracleRouter420.InsufficientFreshSources.selector);book.resolve(v.slate,_results(),v.evidence);
    }
    function testDifferentEvidenceCannotUseAcceptedRoot() public {
        _accept();FantasyTypes420.StatReport memory report=_statReport();report.evidence=keccak256("substituted evidence");
        vm.expectRevert(FantasySlateBook420.InvalidEvidence.selector);book.verifyStats(v.slate,report);
    }
    function testDifferentRevisionCannotUseAcceptedRoot() public {
        _accept();FantasyTypes420.StatReport memory report=_statReport();report.revision=2;
        vm.expectRevert(FantasySlateBook420.InvalidEvidence.selector);book.verifyStats(v.slate,report);
    }
    function testStaleQuorumCannotVerifyStats() public {
        _accept();vm.warp(block.timestamp+8 days);
        vm.expectRevert(OracleRouter420.InsufficientFreshSources.selector);book.verifyStats(v.slate,_statReport());
    }
    function testTamperedStatisticCannotPassActualMerkleVerifier() public {
        _accept();uint32[7] memory ids;FantasyTypes420.Stats[7] memory stats;bytes32[][7] memory proofs;
        for(uint256 j;j<7;j++){ids[j]=v.ids[0];stats[j]=v.stats[0];proofs[j]=v.proofs[0];stats[j].shots++;}
        vm.expectRevert(FantasyNHLScoring420.InvalidProof.selector);
        scorer.calculate(address(book),v.slate,1,v.root,ids,abi.encode(stats,proofs));
    }
    function testObservationReplayIsRejectedByCanonicalRouter() public {
        bytes32 digest=book.resultDigest(v.slate,_results(),v.evidence);_send(OP_A,PA,digest,1);
        vm.expectRevert(OracleRouter420.ObservationReplay.selector);_send(OP_A,PA,digest,1);
    }
    function testFutureAsOfCannotVerify() public {
        _resolve();FantasyTypes420.StatReport memory report=_statReport();report.asOf=uint64(block.timestamp+1);
        vm.expectRevert(FantasySlateBook420.InvalidEvidence.selector);book.verifyStats(v.slate,report);
    }
    function testDifferentSlateContextCannotReuseDigest() public {
        _accept();vm.expectRevert(FantasySlateBook420.InvalidEvidence.selector);book.verifyStats(keccak256("other slate"),_statReport());
    }
}
