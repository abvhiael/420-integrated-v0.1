// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeCrypto420.sol";
/// @notice Exact Litecoin Scrypt(N=1024,r=1,p=1,dkLen=32).
/// Permissionless bounded transactions perform ALL ROMix work on chain. No oracle,
/// prover signature, unverified intermediate state or fraud challenge assumption.
contract LitecoinScrypt420 {
    struct Job {bytes header;bytes32[4] x;uint16 cursor;bytes32 digest;bool started;}
    mapping(bytes32=>Job) private jobs;
    mapping(bytes32=>mapping(uint256=>bytes32[4])) private scratch;
    error InvalidJob();
    event Progress(bytes32 indexed headerHash,uint16 cursor);
    function begin(bytes calldata header) external returns(bytes32 id){
        if(header.length!=80)revert InvalidJob();id=BridgeCrypto420.sha256d(header);Job storage j=jobs[id];
        if(j.started)return id;j.started=true;j.header=header;
        bytes memory initial=new bytes(128);
        for(uint32 i=1;i<=4;++i){bytes32 b=hmac(header,abi.encodePacked(header,bytes4(i)));for(uint256 k;k<32;++k)initial[(i-1)*32+k]=b[k];}
        uint32[32] memory x;for(uint256 i;i<32;++i){uint32 v;for(uint256 k;k<4;++k)v|=uint32(uint8(initial[i*4+k]))<<uint32(8*k);x[i]=v;}j.x=pack(x);
        emit Progress(id,0);
    }
    function advance(bytes32 id,uint16 steps) external {
        Job storage j=jobs[id];if(!j.started || j.cursor>=2048 || steps==0 || steps>32)revert InvalidJob();
        uint32[32] memory x=unpack(j.x);uint256 end=uint256(j.cursor)+steps;if(end>2048)end=2048;
        for(uint256 i=j.cursor;i<end;++i){
            if(i<1024)scratch[id][i]=pack(x);
            else {uint32[32] memory v=unpack(scratch[id][uint256(x[16])&1023]);for(uint256 k;k<32;++k)x[k]^=v[k];}
            x=mix(x);
        }
        j.x=pack(x);j.cursor=uint16(end);
        if(end==2048){bytes memory salt=new bytes(128);for(uint256 i;i<32;++i)for(uint256 k;k<4;++k)salt[i*4+k]=bytes1(uint8(x[i]>>uint32(8*k)));j.digest=hmac(j.header,abi.encodePacked(salt,hex"00000001"));}
        emit Progress(id,j.cursor);
    }
    function result(bytes32 id) external view returns(bytes32 digest,bool complete){Job storage j=jobs[id];return(j.digest,j.started && j.cursor==2048);}
    function cursor(bytes32 id) external view returns(uint16){return jobs[id].cursor;}
    function hmac(bytes memory password,bytes memory salt) private pure returns(bytes32){
        bytes32 key=sha256(password);bytes memory a=new bytes(64);bytes memory b=new bytes(64);
        for(uint256 i;i<64;++i){uint8 v=i<32?uint8(key[i]):0;a[i]=bytes1(v^0x36);b[i]=bytes1(v^0x5c);}
        return sha256(abi.encodePacked(b,sha256(abi.encodePacked(a,salt))));
    }
    function pack(uint32[32] memory x) private pure returns(bytes32[4] memory p){for(uint256 i;i<32;++i)p[i/8]|=bytes32(uint256(x[i])<<(32*(i%8)));}
    function unpack(bytes32[4] memory p) private pure returns(uint32[32] memory x){for(uint256 i;i<32;++i)x[i]=uint32(uint256(p[i/8])>>(32*(i%8)));}
    function mix(uint32[32] memory b) private pure returns(uint32[32] memory out){
        uint32[16] memory x;for(uint256 k;k<16;++k)x[k]=b[16+k];
        for(uint256 i;i<2;++i){for(uint256 k;k<16;++k)x[k]^=b[i*16+k];x=salsa(x);for(uint256 k;k<16;++k)out[i*16+k]=x[k];}
    }
    function rot(uint32 v,uint32 n) private pure returns(uint32){return(v<<n)|(v>>(32-n));}
    function salsa(uint32[16] memory x) private pure returns(uint32[16] memory out){unchecked{
        uint32[16] memory z;for(uint256 i;i<16;++i)z[i]=x[i];
        for(uint256 i;i<4;++i){
            z[4]^=rot(z[0]+z[12],7);z[8]^=rot(z[4]+z[0],9);z[12]^=rot(z[8]+z[4],13);z[0]^=rot(z[12]+z[8],18);
            z[9]^=rot(z[5]+z[1],7);z[13]^=rot(z[9]+z[5],9);z[1]^=rot(z[13]+z[9],13);z[5]^=rot(z[1]+z[13],18);
            z[14]^=rot(z[10]+z[6],7);z[2]^=rot(z[14]+z[10],9);z[6]^=rot(z[2]+z[14],13);z[10]^=rot(z[6]+z[2],18);
            z[3]^=rot(z[15]+z[11],7);z[7]^=rot(z[3]+z[15],9);z[11]^=rot(z[7]+z[3],13);z[15]^=rot(z[11]+z[7],18);
            z[1]^=rot(z[0]+z[3],7);z[2]^=rot(z[1]+z[0],9);z[3]^=rot(z[2]+z[1],13);z[0]^=rot(z[3]+z[2],18);
            z[6]^=rot(z[5]+z[4],7);z[7]^=rot(z[6]+z[5],9);z[4]^=rot(z[7]+z[6],13);z[5]^=rot(z[4]+z[7],18);
            z[11]^=rot(z[10]+z[9],7);z[8]^=rot(z[11]+z[10],9);z[9]^=rot(z[8]+z[11],13);z[10]^=rot(z[9]+z[8],18);
            z[12]^=rot(z[15]+z[14],7);z[13]^=rot(z[12]+z[15],9);z[14]^=rot(z[13]+z[12],13);z[15]^=rot(z[14]+z[13],18);
        }
        for(uint256 i;i<16;++i)out[i]=x[i]+z[i];
    }}
}
