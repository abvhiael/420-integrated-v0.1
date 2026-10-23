package shuffle

import (
 "encoding/hex"
 "math/big"
 "strings"
 "github.com/consensys/gnark-crypto/ecc"
 "golang.org/x/crypto/sha3"
)
// Matches PokerInitialEncryptedDeck420.statement() byte-for-byte for the
// deterministic real-verifier contract integration fixture. All values are
// ABI static words, so abi.encode is their 32-byte concatenation.
func testKeccak(data []byte) [32]byte {
 h:=sha3.NewLegacyKeccak256()
 _,_=h.Write(data)
 var out [32]byte
 copy(out[:],h.Sum(nil))
 return out
}
func testTextHash(s string)[32]byte{return testKeccak([]byte(s))}
func testWordNumber(v *big.Int)[32]byte{
 var out [32]byte
 if v.Sign()<0 || v.BitLen()>256{panic("not a uint256")}
 v.FillBytes(out[:])
 return out
}
func testWordInt(v int64)[32]byte{return testWordNumber(big.NewInt(v))}
func testAddress(hexAddress string)[32]byte{
 bytes,err:=hex.DecodeString(strings.TrimPrefix(hexAddress,"0x"))
 if err!=nil||len(bytes)!=20{panic("bad address")}
 var out [32]byte
 copy(out[12:],bytes)
 return out
}
func initial52TestStatement(root,pkX,pkY *big.Int)*big.Int{
 var keyWords []byte
 a:=testWordNumber(pkX);b:=testWordNumber(pkY)
 keyWords=append(keyWords,a[:]...);keyWords=append(keyWords,b[:]...)
 threshold:=testKeccak(keyWords)
 words:=[][32]byte{
  testTextHash("420.BET.POKER.CANONICAL.INITIAL.ELGAMAL.V1"),
  testWordInt(31337),
  testAddress("0x0000000000000000000000000000000000001001"),
  testAddress("0x0000000000000000000000000000000000001002"),
  testTextHash("initial-52-contract-v2"),
  testTextHash("initial-52-contract-circuit"),
  testTextHash("initial-52-contract-key"),
  testTextHash("initial-52-contract-schema"),
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
  testWordNumber(root),
 }
 var data []byte
 for _,word:=range words{data=append(data,word[:]...)}
 digest:=testKeccak(data)
 return new(big.Int).Mod(new(big.Int).SetBytes(digest[:]),ecc.BN254.ScalarField())
}
