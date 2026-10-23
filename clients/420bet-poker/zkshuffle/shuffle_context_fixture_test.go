package shuffle

import (
 "math/big"
 "github.com/consensys/gnark-crypto/ecc"
)

// Equivalent to PokerPrivateShuffleGate420.statement() with the exact
// deterministic contract addresses/hand values used by the Solidity fixture.
func shuffle52TestStatement(stage int64,inputRoot,outputRoot,pkX,pkY *big.Int)*big.Int {
 a:=testWordNumber(pkX);b:=testWordNumber(pkY)
 keyWords:=append(a[:],b[:]...)
 threshold:=testKeccak(keyWords)
 words:=[][32]byte{
  testTextHash("420.BET.POKER.ZK.REENCRYPTION.SHUFFLE.V1"),
  testWordInt(31337),
  testAddress("0x0000000000000000000000000000000000001003"),
  testTextHash("shuffle-52-contract-circuit"),
  threshold,
  testWordInt(420),
  testTextHash("test-table"),
  testTextHash("test-config"),
  testTextHash("test-rules"),
  testTextHash("test-version"),
  testTextHash("test-snapshot"),
  testWordInt(7),
  testWordInt(2),
  testTextHash("test-transcript"),
  testWordInt(stage),
  testWordNumber(inputRoot),
  testWordNumber(outputRoot),
 }
 data:=make([]byte,0,len(words)*32)
 for _,w:=range words{data=append(data,w[:]...)}
 digest:=testKeccak(data)
 return new(big.Int).Mod(new(big.Int).SetBytes(digest[:]),ecc.BN254.ScalarField())
}
