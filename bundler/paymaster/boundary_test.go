package paymaster

import (
	"encoding/hex"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/bundler/userop"
)

func word(v *big.Int)[]byte{ out:=make([]byte,32); b:=v.Bytes(); copy(out[32-len(b):],b); return out }
func addressW(s string)[]byte{ out:=make([]byte,32); b,_:=hex.DecodeString(strings.TrimPrefix(s,"0x")); copy(out[12:],b); return out }
func bytes32(fill byte)[]byte{ out:=make([]byte,32); for i:=range out{out[i]=fill}; return out }

func envelope(entry string,chain uint64,from,to uint64,data []byte)[]byte{
	var raw []byte
	raw=append(raw,word(big.NewInt(1))...)
	raw=append(raw,addressW("0x3333333333333333333333333333333333333333")...)
	raw=append(raw,addressW(entry)...)
	raw=append(raw,word(new(big.Int).SetUint64(chain))...)
	raw=append(raw,bytes32(0x44)...)
	raw=append(raw,word(new(big.Int).SetUint64(from))...)
	raw=append(raw,word(new(big.Int).SetUint64(to))...)
	raw=append(raw,word(big.NewInt(1000000))...)
	raw=append(raw,bytes32(0x55)...)
	raw=append(raw,word(big.NewInt(320))...)
	raw=append(raw,word(new(big.Int).SetUint64(uint64(len(data))))...)
	raw=append(raw,data...)
	for len(raw)%32!=0 { raw=append(raw,0) }
	return raw
}
func operation(raw []byte)userop.PackedUserOperation{
	return userop.PackedUserOperation{
		Sender:"0x2222222222222222222222222222222222222222",Nonce:"0x1",InitCode:"0x",CallData:"0x1234",
		AccountGasLimits:"0x"+strings.Repeat("00",32),PreVerificationGas:"0x0",GasFees:"0x"+strings.Repeat("00",32),
		PaymasterAndData:"0x"+hex.EncodeToString(raw),Signature:"0xaa",
	}
}

func TestEmptyPaymasterIsNeutral(t *testing.T){
	op:=operation(nil)
	env,err:=Validate(op,420,"0x1111111111111111111111111111111111111111",time.Unix(100,0))
	if err!=nil || env!=nil { t.Fatalf("unexpected neutral result: env=%v err=%v",env,err) }
}
func TestCanonicalEnvelopeBindingAndWindow(t *testing.T){
	entry:="0x1111111111111111111111111111111111111111"
	op:=operation(envelope(entry,420,90,110,[]byte{1,2,3}))
	env,err:=Validate(op,420,entry,time.Unix(100,0))
	if err!=nil { t.Fatal(err) }
	if env.Paymaster!="0x3333333333333333333333333333333333333333" || len(env.SponsorData)!=3 { t.Fatalf("unexpected envelope: %+v",env) }
	if _,err:=Validate(op,421,entry,time.Unix(100,0)); err==nil { t.Fatal("accepted wrong chain") }
	if _,err:=Validate(op,420,"0x9999999999999999999999999999999999999999",time.Unix(100,0)); err==nil { t.Fatal("accepted wrong EntryPoint") }
	if _,err:=Validate(op,420,entry,time.Unix(80,0)); err==nil { t.Fatal("accepted future sponsorship") }
	if _,err:=Validate(op,420,entry,time.Unix(120,0)); err==nil { t.Fatal("accepted expired sponsorship") }
}
func TestRejectsNoncanonicalEnvelope(t *testing.T){
	entry:="0x1111111111111111111111111111111111111111"
	raw:=envelope(entry,420,90,110,nil)
	raw[9*32+31]=0x60
	if _,err:=Validate(operation(raw),420,entry,time.Unix(100,0)); err==nil { t.Fatal("accepted noncanonical dynamic offset") }
}
