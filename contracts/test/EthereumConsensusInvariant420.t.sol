// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./helpers/EthereumProofFixture420.sol";

contract EthereumConsensusInvariantHandler420 {
    EthereumConsensusLightClient420 public immutable client;
    bytes private proof;
    bytes private journal;
    constructor(EthereumConsensusLightClient420 c,bytes memory p,bytes memory j){client=c;proof=p;journal=j;}
    function validOrReplay() external {(bool ok,)=address(client).call{gas:3_000_000}(abi.encodeCall(client.submitFinality,(proof,journal)));ok;}
    function forgeFinality(bytes32 proposedRoot) external {
        EthereumConsensusLightClient420.ProofOutputs memory p=abi.decode(journal,(EthereumConsensusLightClient420.ProofOutputs));
        if(proposedRoot==p.newHeader)return;p.newHeader=proposedRoot;
        (bool ok,)=address(client).call{gas:3_000_000}(abi.encodeCall(client.submitFinality,(proof,abi.encode(p))));require(!ok,"forged root advanced finality");
    }
    function forgeCommittee(bytes32 committee) external {
        EthereumConsensusLightClient420.ProofOutputs memory p=abi.decode(journal,(EthereumConsensusLightClient420.ProofOutputs));
        if(committee==p.nextSyncCommitteeHash)return;p.nextSyncCommitteeHash=committee;
        (bool ok,)=address(client).call{gas:3_000_000}(abi.encodeCall(client.submitFinality,(proof,abi.encode(p))));require(!ok,"forged committee accepted");
    }
}
contract EthereumConsensusInvariant420Test is EthereumProofFixture420 {
    EthereumConsensusLightClient420 private c;
    EthereumConsensusInvariantHandler420 private handler;
    function setUp() public {c=client("");handler=new EthereumConsensusInvariantHandler420(c,read("consensus-proof.bin"),read("consensus-public-values.bin"));}
    function targetContracts() public view returns(address[] memory targets){targets=new address[](1);targets[0]=address(handler);}
    function invariantOnlyProvenMainnetCheckpointAndCommitteeCanBeStored() public view {
        require(c.head()==15650752 || c.head()==15650912);
        require(c.headers(15650752)==0x58d35cd3413a91b2cffae5d6073fc8a3f2ea71b58915f7c592d64e7293a766e0);
        if(c.head()==15650912)require(c.headers(15650912)==0x36c12458c4556fbe873378b095bd53618bedecca2b3ca9a30a1d05e34a094618);
        require(c.syncCommittees(1910)==0x31996e9f90a487a9423b2fdc838dd930c75f226f71d64f924b49b4dcdeca46f9);
    }
}
