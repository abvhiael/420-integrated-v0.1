// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../BnbConsensus420.t.sol";
contract BnbForkActorV18 {
 BnbConsensusLightClient420 public immutable client;
 bytes private first;bytes private child;bytes private voteA;bytes private voteB;
 constructor(BnbConsensusLightClient420 c,bytes memory a,bytes memory b,bytes memory va,bytes memory vb){client=c;first=a;child=b;voteA=va;voteB=vb;}
 function cacheConflictingHeader(uint8 mutation) external {bytes memory raw=first;raw[raw.length-1]^=bytes1(mutation);(bool ok,)=address(client).call(abi.encodeCall(client.cacheHeader,(raw)));ok;}
 function claimUncomputedFinality(bool stale) external {
  bytes[] memory ancestry=new bytes[](stale?0:1);
  // The first candidate deliberately lacks the predecessor or completed BLS job.
  // Parsing/cache admission must never grant it authority over the trusted prefix.
  (bool ok,)=address(client).call(abi.encodeCall(client.finalize,(first,child,ancestry,voteA,voteB)));require(!ok,"cache authorized fork");
 }
}
contract BnbForkV18Test is BnbConsensus420Test {
 BnbConsensusLightClient420 private c;BnbForkActorV18 private actor;bytes32 private initialHash;
 function setUp() public {c=client(new BnbBlsVerifier420());initialHash=c.finalizedHash();actor=new BnbForkActorV18(c,header(116664000),header(116664001),file("vote_116664000.rlp"),file("vote_116664001.rlp"));}
 function targetContracts() public view returns(address[] memory t){t=new address[](1);t[0]=address(actor);}
 function testV18ConflictingHeaderCacheCannotReorganizeFinalizedPrefix() public {actor.cacheConflictingHeader(1);actor.claimUncomputedFinality(false);_check();}
 function invariantV18FinalizedPrefixAndCommitteeResistCachedForks() public view {_check();}
 function _check() private view {require(c.finalizedNumber()==116663998&&c.finalizedHash()==initialHash,"finalized prefix replaced");require(c.epochCount()==2,"unfinalized committee authorized");(bytes32 hash,,)=c.execution(116663998);require(hash==initialHash,"immutable execution overwritten");}
}
