package shuffle

import(
 "math/big"
 "github.com/consensys/gnark-crypto/ecc"
 "github.com/consensys/gnark/frontend"
)

// Exact abi.encode(...) commitments for the deterministically deployed
// Foundry WS3 recipient-registry 0x1005, book 0x1006, shuffle 0x1003
// and immutable provider adapters 0x2001 and 0x2002.
func ws3Word(v frontend.Variable)[32]byte{
 switch z:=v.(type){
 case int:return testWordInt(int64(z))
 case uint8:return testWordInt(int64(z))
 case int64:return testWordInt(z)
 case uint64:return testWordNumber(new(big.Int).SetUint64(z))
 case *big.Int:return testWordNumber(z)
 default:panic("unsupported WS3 ABI field type")
 }
}
func ws3Hash(words ...[32]byte)[32]byte{
 raw:=make([]byte,0,32*len(words))
 for _,word:=range words{raw=append(raw,word[:]...)}
 return testKeccak(raw)
}
func ws3Scalar(words ...[32]byte)*big.Int{
 h:=ws3Hash(words...)
 return new(big.Int).Mod(new(big.Int).SetBytes(h[:]),ecc.BN254.ScalarField())
}
func ws3Player(seat int)[32]byte{
 if seat==0{return testAddress("0x000000000000000000000000000000000000a001")}
 if seat==1{return testAddress("0x000000000000000000000000000000000000a002")}
 panic("unsupported WS3 seat")
}
func ws3KeyScope(seat int)*big.Int{
 return ws3Scalar(
  testTextHash("420.BET.POKER.RECIPIENT.KEY.POP.V1"),
  testWordInt(31337),
  testAddress("0x0000000000000000000000000000000000001005"),
  testTextHash("test-table"),ws3Player(seat),testWordInt(7),
 )
}
func ws3Fingerprint(seat int,qx,qy frontend.Variable)[32]byte{
 return ws3Hash(
  testTextHash("420.BET.POKER.RECIPIENT.KEY.POP.V1"),
  testWordInt(31337),
  testAddress("0x0000000000000000000000000000000000001005"),
  testTextHash("test-table"),ws3Player(seat),testWordInt(7),ws3Word(qx),ws3Word(qy),
 )
}
func ws3DeliveryScope(root *big.Int,position,seat,provider int,recipientFingerprint [32]byte,
  points [12]frontend.Variable)*big.Int{
 fields:=[][32]byte{
  testTextHash("420.BET.POKER.PRIVATE.SHARE.DELIVERY.CONTEXT.V1"),
  testWordInt(31337),
  testAddress("0x0000000000000000000000000000000000001006"),
  testWordInt(420),testWordInt(int64(position)),testWordInt(int64(seat)),
  testWordInt(int64(provider)),testWordNumber(root),recipientFingerprint,testWordInt(7),
 }
 for _,point:=range points{fields=append(fields,ws3Word(point))}
 return ws3Scalar(fields...)
}
func ws3AggregateScope(ax,ay,bx,by,tx,ty frontend.Variable)*big.Int{
 return ws3Scalar(
  testTextHash("420.BET.POKER.PRIVATE.SHARE.AGGREGATE.V1"),
  testWordInt(31337),
  testAddress("0x0000000000000000000000000000000000001006"),
  testAddress("0x0000000000000000000000000000000000001003"),
  testAddress("0x0000000000000000000000000000000000002001"),
  testAddress("0x0000000000000000000000000000000000002002"),
  ws3Word(ax),ws3Word(ay),ws3Word(bx),ws3Word(by),ws3Word(tx),ws3Word(ty),
 )
}
