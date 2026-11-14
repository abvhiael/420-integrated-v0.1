// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./helpers/EthereumProofFixture420.sol";

contract EthereumConsensusQualification420Test is EthereumProofFixture420 {
    function testRealMainnetConsensusFinalityExecutionAndReceiptRoots() public {
        EthereumConsensusLightClient420 c=finalizedClient();
        require(c.head()==15650912);
        EthereumExecutionHeader420.Header memory h=c.getExecution(26411202);
        require(h.blockHash==0xd04129e4d7b1e1fdee6e87f5ad2b36454791e8a2c1f1b971afd28fc9d4260c51);
        require(c.isFinalizedExecutionBlock(h.number,h.blockHash,h.receiptsRoot));
        require(!c.isFinalizedExecutionBlock(h.number,bytes32(uint256(h.blockHash)^1),h.receiptsRoot));
        require(!c.isFinalizedExecutionBlock(h.number,h.blockHash,bytes32(uint256(h.receiptsRoot)^1)));
        require(!c.isFinalizedExecutionBlock(h.number+1,h.blockHash,h.receiptsRoot));
    }
    function testRealMainnetSyncCommitteePeriodTransition() public {
        EthereumConsensusLightClient420 c=client("rotation-");uint64 previous=c.head();
        require(previous==15646592 && uint256(previous)/8192==1909);
        c.submitFinality(read("rotation-proof.bin"),read("rotation-public-values.bin"));
        require(c.head()==15646752 && uint256(c.head())/8192==1910);
        require(c.syncCommittees(1909)!=c.syncCommittees(1910) && c.syncCommittees(1910)!=0);
        require(c.headers(previous)!=0 && c.headers(c.head())!=0);
        vm.expectRevert(EthereumConsensusLightClient420.InvalidConsensusProof.selector);c.submitFinality(read("rotation-proof.bin"),read("rotation-public-values.bin"));
    }
    function testConsensusRejectsForgedCommitteesOutputsReplayAndNoncanonicalJournal() public {
        EthereumConsensusLightClient420 c=client("");bytes memory proof=read("consensus-proof.bin");bytes memory values=read("consensus-public-values.bin");
        EthereumConsensusLightClient420.ProofOutputs memory po=abi.decode(values,(EthereumConsensusLightClient420.ProofOutputs));
        po.startSyncCommitteeHash=bytes32(uint256(po.startSyncCommitteeHash)^1);
        vm.expectRevert(EthereumConsensusLightClient420.InvalidConsensusProof.selector);c.submitFinality(proof,abi.encode(po));
        vm.expectRevert(EthereumConsensusLightClient420.InvalidConsensusProof.selector);c.submitFinality(proof,abi.encodePacked(values,hex"00"));
        po=abi.decode(values,(EthereumConsensusLightClient420.ProofOutputs));po.newHeader=bytes32(uint256(po.newHeader)^1);
        (bool ok,)=address(c).call{gas:3_000_000}(abi.encodeCall(c.submitFinality,(proof,abi.encode(po))));require(!ok,"forged finality accepted");
        po=abi.decode(values,(EthereumConsensusLightClient420.ProofOutputs));po.nextSyncCommitteeHash=bytes32(uint256(1));
        (ok,)=address(c).call{gas:3_000_000}(abi.encodeCall(c.submitFinality,(proof,abi.encode(po))));require(!ok,"forged next committee accepted");
        c.submitFinality(proof,values);
        vm.expectRevert(EthereumConsensusLightClient420.InvalidConsensusProof.selector);c.submitFinality(proof,values);
    }
    function testWeakSubjectivityAndFutureCheckpointFailClosed() public {
        (bytes32 root,EthereumSSZ420.BeaconHeader memory h,bytes32 committee,bytes32[] memory path)=abi.decode(read("bootstrap.bin"),(bytes32,EthereumSSZ420.BeaconHeader,bytes32,bytes32[]));
        uint256 time=1606824023+uint256(h.slot)*12;
        vm.warp(time-1);vm.expectRevert(EthereumConsensusLightClient420.StaleCheckpoint.selector);new EthereumConsensusLightClient420(root,h,committee,path);
        vm.warp(time+14 days+1);vm.expectRevert(EthereumConsensusLightClient420.StaleCheckpoint.selector);new EthereumConsensusLightClient420(root,h,committee,path);
        vm.warp(time+60);path[0]=bytes32(uint256(path[0])^1);
        vm.expectRevert(EthereumSSZ420.InvalidSSZProof.selector);new EthereumConsensusLightClient420(root,h,committee,path);
    }
    function testExecutionPayloadHashBindingAndUnknownBeaconRejected() public {
        EthereumConsensusLightClient420 c=client("");c.submitFinality(read("consensus-proof.bin"),read("consensus-public-values.bin"));
        (EthereumSSZ420.BeaconHeader memory h,bytes memory raw,bytes32[] memory path)=abi.decode(read("finalized-execution.bin"),(EthereumSSZ420.BeaconHeader,bytes,bytes32[]));
        h.bodyRoot=bytes32(uint256(h.bodyRoot)^1);vm.expectRevert(EthereumConsensusLightClient420.InvalidExecutionProof.selector);c.authenticateExecution(h,raw,path);
        h.bodyRoot=bytes32(uint256(h.bodyRoot)^1);path[0]=bytes32(uint256(path[0])^1);vm.expectRevert(EthereumSSZ420.InvalidSSZProof.selector);c.authenticateExecution(h,raw,path);
        path[0]=bytes32(uint256(path[0])^1);c.authenticateExecution(h,raw,path);
    }
    function testHistoricalNativeAndErc20TransactionReceiptMembership() public {
        EthereumConsensusLightClient420 c=finalizedClient();EthereumExecutionHeader420.Header memory h=c.getExecution(26411202);
        string[4] memory names=[string("native"),"aave","link","usdt"];
        for(uint256 i;i<names.length;++i){
            EthereumGatewayMessageVerifier420.Proof memory p=history(names[i]);bytes memory key=EthereumRLP420.indexKey(p.transactionIndex);
            EthereumMPT420.verify(h.transactionsRoot,key,p.transaction,p.transactionProof);EthereumMPT420.verify(h.receiptsRoot,key,p.receipt,p.receiptProof);
            require(EthereumExecutionHeader420.parse(p.executionHeader).blockHash==h.blockHash);
            if(i==0)require(keccak256(p.transaction)==0x93c86bbcc91b7fa818d93e9fdfe26c7d759d9462dc52faa693243b8a2bf5ef22);
        }
    }
    function testHistoricalCanonicalTokenAccountsAndCodeHashes() public {
        EthereumConsensusLightClient420 c=finalizedClient();EthereumExecutionHeader420.Header memory h=c.getExecution(26411202);
        string[7] memory names=[string("aave"),"audio","eurc","link","qcad","uni","usdt"];
        for(uint256 i;i<names.length;++i){
            (address token,bytes32 root,bytes memory account,bytes[] memory proof,bytes32 codeHash)=abi.decode(read(string.concat("account-",names[i],".bin")),(address,bytes32,bytes,bytes[],bytes32));
            require(root==h.stateRoot && codeHash==keccak256(read(string.concat("code-",names[i],".bin"))));
            EthereumMPT420.verify(root,abi.encodePacked(keccak256(abi.encodePacked(token))),account,proof);
            EthereumRLP420.Item[] memory f=EthereumRLP420.children(account,EthereumRLP420.item(account,0));require(f.length==4 && EthereumRLP420.word(account,f[3])==codeHash);
        }
    }
    function testFuzzCanonicalIndexEncoding(uint64 value) public pure {
        bytes memory key=EthereumRLP420.indexKey(value);EthereumRLP420.validate(key);require(EthereumRLP420.integer(key,EthereumRLP420.item(key,0))==value);
    }
    function validate(bytes calldata value) external pure {EthereumRLP420.validate(value);}
    function testCanonicalRLPRejectsMalformedLengthsIntegersAndTrailingBytes() public {
        bytes[6] memory invalid_=[bytes(hex"8100"),hex"b80100",hex"b9003800",hex"c181",hex"c000",hex"f80180"];
        for(uint256 i;i<invalid_.length;++i){(bool ok,)=address(this).call(abi.encodeCall(this.validate,(invalid_[i])));require(!ok,"noncanonical RLP accepted");}
        EthereumRLP420.validate(hex"80");EthereumRLP420.validate(hex"c0");EthereumRLP420.validate(hex"7f");
    }
    function testFuzzTruncatedHistoricalExecutionHeader(uint16 cut) public {
        EthereumGatewayMessageVerifier420.Proof memory p=history("native");bytes memory short_=EthereumRLP420.slice(p.executionHeader,0,uint256(cut)%p.executionHeader.length);
        (bool ok,)=address(this).call(abi.encodeCall(this.validate,(short_)));require(!ok);
    }
    function verifyTrie(bytes32 root,bytes calldata key,bytes calldata value,bytes[] calldata proof) external pure {EthereumMPT420.verify(root,key,value,proof);}
    function testEmbeddedTrieChildrenAndHashedShortNodeRejection() public {
        bytes[] memory leafFields=new bytes[](2);leafFields[0]=enc(hex"32");leafFields[1]=enc(hex"01");bytes memory leaf=list(leafFields);
        bytes[] memory fields=new bytes[](17);for(uint256 i;i<17;++i)fields[i]=enc(hex"");fields[1]=leaf;bytes memory root=list(fields);
        EthereumMPT420.verify(keccak256(root),hex"12",hex"01",oneProof(root));
        fields[1]=enc(abi.encodePacked(keccak256(leaf)));root=list(fields);bytes[] memory proof=new bytes[](2);proof[0]=root;proof[1]=leaf;
        vm.expectRevert(EthereumMPT420.InvalidTrieProof.selector);this.verifyTrie(keccak256(root),hex"12",hex"01",proof);
    }
    function testWrongTrieKeyValueRootAndTrailingProofRejected() public {
        EthereumGatewayMessageVerifier420.Proof memory p=history("usdt");EthereumExecutionHeader420.Header memory h=EthereumExecutionHeader420.parse(p.executionHeader);
        bytes memory key=EthereumRLP420.indexKey(p.transactionIndex);
        (bool ok,)=address(this).call(abi.encodeCall(this.verifyTrie,(h.receiptsRoot,EthereumRLP420.indexKey(p.transactionIndex+1),p.receipt,p.receiptProof)));require(!ok);
        p.receipt[p.receipt.length-1]^=0x01;
        (ok,)=address(this).call(abi.encodeCall(this.verifyTrie,(h.receiptsRoot,key,p.receipt,p.receiptProof)));require(!ok);
        p.receipt[p.receipt.length-1]^=0x01;
        (ok,)=address(this).call(abi.encodeCall(this.verifyTrie,(bytes32(uint256(h.receiptsRoot)^1),key,p.receipt,p.receiptProof)));require(!ok);
        bytes[] memory extra=new bytes[](p.receiptProof.length+1);for(uint256 i;i<p.receiptProof.length;++i)extra[i]=p.receiptProof[i];extra[extra.length-1]=hex"c0";
        (ok,)=address(this).call(abi.encodeCall(this.verifyTrie,(h.receiptsRoot,key,p.receipt,extra)));require(!ok);
    }
    function testGenuineFinalizedExecutionAncestryAndSubstitutionRejection() public {
        EthereumConsensusLightClient420 c=finalizedClient();
        EthereumGatewayMessageVerifier420.Proof memory p=history("native");bytes memory parent=read("parent-header.bin");
        EthereumConsensusLightClient420 unknown=client("");
        vm.expectRevert(EthereumConsensusLightClient420.InvalidExecutionProof.selector);unknown.authenticateAncestor(p.executionHeader,parent);
        vm.expectRevert(EthereumConsensusLightClient420.InvalidExecutionProof.selector);c.authenticateAncestor(p.executionHeader,p.executionHeader);
        c.authenticateAncestor(p.executionHeader,parent);EthereumExecutionHeader420.Header memory h=c.getExecution(26411201);
        require(h.blockHash==c.getExecution(26411202).parentHash && c.isFinalizedExecutionBlock(h.number,h.blockHash,h.receiptsRoot));
        c.authenticateAncestor(p.executionHeader,parent);
    }
    function parseExecution(bytes calldata raw) external pure {EthereumExecutionHeader420.parse(raw);}
    function testExecutionHeaderCanonicalFieldBoundaries() public {
        bytes memory raw=history("native").executionHeader;EthereumRLP420.Item[] memory items=EthereumRLP420.children(raw,EthereumRLP420.item(raw,0));
        bytes[] memory fields=new bytes[](items.length);for(uint256 i;i<items.length;++i)fields[i]=EthereumRLP420.encoded(raw,items[i]);
        uint256[5] memory indexes=[uint256(0),6,8,10,14];
        bytes[5] memory invalid_=[enc(new bytes(31)),enc(new bytes(255)),enc(hex"00"),encUint(type(uint256).max),enc(new bytes(7))];
        for(uint256 i;i<indexes.length;++i){bytes memory original=fields[indexes[i]];fields[indexes[i]]=invalid_[i];(bool ok,)=address(this).call(abi.encodeCall(this.parseExecution,(list(fields))));require(!ok,"malformed execution field accepted");fields[indexes[i]]=original;}
        bytes[] memory wrongCount=new bytes[](18);for(uint256 i;i<18;++i)wrongCount[i]=fields[i];
        vm.expectRevert(EthereumExecutionHeader420.InvalidExecutionHeader.selector);this.parseExecution(list(wrongCount));
    }
}
