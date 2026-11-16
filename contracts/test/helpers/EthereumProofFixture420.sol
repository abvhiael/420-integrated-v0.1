// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bridge/verifiers/EthereumConsensusLightClient420.sol";
import "../../src/bridge/verifiers/EthereumGatewayMessageVerifier420.sol";
interface EthereumVm420 {
    struct Log {bytes32[] topics; bytes data; address emitter;}
    function readFileBinary(string calldata) external view returns(bytes memory);
    function warp(uint256) external;
    function chainId(uint256) external;
    function store(address,bytes32,bytes32) external;
    function etch(address,bytes calldata) external;
    function prank(address) external;
    function deal(address,uint256) external;
    function sign(uint256,bytes32) external returns(uint8,bytes32,bytes32);
    function addr(uint256) external returns(address);
    function expectRevert(bytes4) external;
    function recordLogs() external;
    function getRecordedLogs() external returns(Log[] memory);
}
abstract contract EthereumProofFixture420 {
    EthereumVm420 internal constant vm=EthereumVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    string internal constant FIXTURE="contracts/test/fixtures/ethereum/";
    function read(string memory name) internal view returns(bytes memory){return vm.readFileBinary(string.concat(FIXTURE,name));}
    function client(string memory prefix) internal returns(EthereumConsensusLightClient420 c){
        (bytes32 root,EthereumSSZ420.BeaconHeader memory h,bytes32 committee,bytes32[] memory path)=abi.decode(read(string.concat(prefix,"bootstrap.bin")),(bytes32,EthereumSSZ420.BeaconHeader,bytes32,bytes32[]));
        vm.warp(1606824023+uint256(h.slot)*12+3600);
        c=new EthereumConsensusLightClient420(root,h,committee,path);
    }
    function finalizedClient() internal returns(EthereumConsensusLightClient420 c){
        c=client("");c.submitFinality(read("consensus-proof.bin"),read("consensus-public-values.bin"));
        (EthereumSSZ420.BeaconHeader memory h,bytes memory raw,bytes32[] memory path)=abi.decode(read("finalized-execution.bin"),(EthereumSSZ420.BeaconHeader,bytes,bytes32[]));
        c.authenticateExecution(h,raw,path);
    }
    function history(string memory symbol) internal view returns(EthereumGatewayMessageVerifier420.Proof memory){return abi.decode(read(string.concat("history-",symbol,".bin")),(EthereumGatewayMessageVerifier420.Proof));}
    function scalar(uint256 value) internal pure returns(bytes memory out){
        if(value==0)return hex"";uint256 n;uint256 v=value;while(v!=0){++n;v>>=8;}out=new bytes(n);
        for(uint256 i;i<n;++i)out[n-1-i]=bytes1(uint8(value>>(8*i)));
    }
    function prefix(bytes memory payload,uint256 offset) internal pure returns(bytes memory){
        if(payload.length<56)return abi.encodePacked(bytes1(uint8(offset+payload.length)),payload);
        bytes memory size=scalar(payload.length);return abi.encodePacked(bytes1(uint8(offset+55+size.length)),size,payload);
    }
    function enc(bytes memory payload) internal pure returns(bytes memory){if(payload.length==1 && uint8(payload[0])<128)return payload;return prefix(payload,128);}
    function encUint(uint256 value) internal pure returns(bytes memory){return enc(scalar(value));}
    function list(bytes[] memory elements) internal pure returns(bytes memory){bytes memory payload;for(uint256 i;i<elements.length;++i)payload=abi.encodePacked(payload,elements[i]);return prefix(payload,192);}
    function singleLeaf(bytes memory key,bytes memory value) internal pure returns(bytes memory){bytes[] memory f=new bytes[](2);f[0]=enc(abi.encodePacked(hex"20",key));f[1]=enc(value);return list(f);}
    function oneProof(bytes memory node) internal pure returns(bytes[] memory p){p=new bytes[](1);p[0]=node;}
    function syntheticHeader(uint64 number,bytes32 txRoot,bytes32 receiptRoot) internal pure returns(bytes memory){
        bytes[] memory fields=new bytes[](16);
        fields[0]=enc(abi.encodePacked(keccak256("synthetic parent")));fields[1]=enc(abi.encodePacked(keccak256("synthetic ommers")));fields[2]=enc(abi.encodePacked(address(1)));
        fields[3]=enc(abi.encodePacked(keccak256("synthetic state")));fields[4]=enc(abi.encodePacked(txRoot));fields[5]=enc(abi.encodePacked(receiptRoot));fields[6]=enc(new bytes(256));
        fields[7]=encUint(0);fields[8]=encUint(number);fields[9]=encUint(30_000_000);fields[10]=encUint(210_000);fields[11]=encUint(1_794_636_025);fields[12]=enc(hex"4200");fields[13]=enc(abi.encodePacked(keccak256("synthetic randomness")));fields[14]=enc(new bytes(8));fields[15]=encUint(1);
        return list(fields);
    }
    /// Test-only synthetic execution root; real historical finality tests never call store/etch.
    function injectExecution(EthereumConsensusLightClient420 c,bytes memory raw) internal {
        EthereumExecutionHeader420.Header memory h=EthereumExecutionHeader420.parse(raw);bytes32 slot=keccak256(abi.encode(h.number,uint256(3)));
        vm.store(address(c),slot,h.blockHash);vm.store(address(c),bytes32(uint256(slot)+1),h.parentHash);vm.store(address(c),bytes32(uint256(slot)+2),h.stateRoot);vm.store(address(c),bytes32(uint256(slot)+3),h.transactionsRoot);vm.store(address(c),bytes32(uint256(slot)+4),h.receiptsRoot);vm.store(address(c),bytes32(uint256(slot)+5),bytes32(uint256(h.number)|(uint256(h.timestamp)<<64)));
    }
}
