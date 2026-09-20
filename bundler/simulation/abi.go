package simulation

import (
	"encoding/hex"
	"errors"
	"math/big"

	"github.com/420integrated/420-integrated/bundler/userop"
)

const handleOpSelector = "9eec012b"

func EncodeHandleOp(op userop.PackedUserOperation)(string,error){
	c,err:=op.Canonicalize()
	if err!=nil { return "",err }
	tuple:=encodeTuple(c)
	out:=make([]byte,0,4+32+len(tuple))
	selector, _ := hex.DecodeString(handleOpSelector)
	out=append(out,selector...)
	out=append(out,uintWord(big.NewInt(32))...)
	out=append(out,tuple...)
	return "0x"+hex.EncodeToString(out),nil
}

func encodeTuple(op userop.Canonical) []byte {
	dynamics:=[][]byte{op.InitCode,op.CallData,op.PaymasterAndData,op.Signature}
	tails:=make([][]byte,len(dynamics))
	headBytes:=9*32
	cursor:=headBytes
	offsets:=make([]int,len(dynamics))
	for i,d:=range dynamics {
		tails[i]=bytesTail(d)
		offsets[i]=cursor
		cursor+=len(tails[i])
	}
	out:=make([]byte,0,cursor)
	out=append(out,addressWord(op.Sender)...)
	out=append(out,uintWord(op.Nonce)...)
	out=append(out,uintWord(big.NewInt(int64(offsets[0])))...)
	out=append(out,uintWord(big.NewInt(int64(offsets[1])))...)
	out=append(out,op.AccountGasLimits[:]...)
	out=append(out,uintWord(op.PreVerificationGas)...)
	out=append(out,op.GasFees[:]...)
	out=append(out,uintWord(big.NewInt(int64(offsets[2])))...)
	out=append(out,uintWord(big.NewInt(int64(offsets[3])))...)
	for _,tail:=range tails { out=append(out,tail...) }
	return out
}

func bytesTail(v []byte) []byte {
	padded:=((len(v)+31)/32)*32
	out:=make([]byte,32+padded)
	copy(out,uintWord(big.NewInt(int64(len(v)))))
	copy(out[32:],v)
	return out
}

func addressWord(v [20]byte) []byte {
	out:=make([]byte,32)
	copy(out[12:],v[:])
	return out
}

func uintWord(v *big.Int) []byte {
	if v==nil || v.Sign()<0 || v.BitLen()>256 { panic(errors.New("invalid uint256")) }
	out:=make([]byte,32)
	b:=v.Bytes()
	copy(out[32-len(b):],b)
	return out
}

func DecodeHandleOpResult(raw string)(bool,error){
	if len(raw)<2+64*3 || len(raw)%2!=0 || raw[:2]!="0x" { return false,errors.New("invalid handleOp simulation result") }
	b,err:=hex.DecodeString(raw[2:])
	if err!=nil || len(b)<96 { return false,errors.New("invalid handleOp simulation result") }
	for _,v:=range b[:31] { if v!=0 { return false,errors.New("invalid handleOp success word") } }
	if b[31]!=0 && b[31]!=1 { return false,errors.New("invalid handleOp success value") }
	offset:=new(big.Int).SetBytes(b[32:64])
	if !offset.IsUint64() || offset.Uint64()%32!=0 || offset.Uint64()+32>uint64(len(b)) { return false,errors.New("invalid handleOp return-data offset") }
	return b[31]==1,nil
}
