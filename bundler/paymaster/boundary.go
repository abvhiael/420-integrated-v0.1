package paymaster

import (
	"bytes"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/bundler/userop"
)

const MaxSponsorDataBytes = 4096

type Envelope struct {
	Version uint8
	Paymaster string
	EntryPoint string
	ChainID *big.Int
	PolicyID string
	ValidAfter uint64
	ValidUntil uint64
	MaxSponsoredCostWei *big.Int
	AuthorizationID string
	SponsorData []byte
}

func Validate(op userop.PackedUserOperation,chainID uint64,entryPoint string,now time.Time)(*Envelope,error){
	canonical,err:=op.Canonicalize()
	if err!=nil { return nil,err }
	if len(canonical.PaymasterAndData)==0 { return nil,nil }
	if now.IsZero() { return nil,errors.New("validation time is required") }
	env,err:=decode(canonical.PaymasterAndData)
	if err!=nil { return nil,fmt.Errorf("invalid paymasterAndData: %w",err) }
	if env.ChainID.BitLen()>64 || env.ChainID.Uint64()!=chainID { return nil,errors.New("paymaster chain binding mismatch") }
	if !strings.EqualFold(env.EntryPoint,entryPoint) { return nil,errors.New("paymaster EntryPoint binding mismatch") }
	nowUnix:=uint64(now.Unix())
	if nowUnix<env.ValidAfter { return nil,errors.New("paymaster sponsorship is not yet valid") }
	if nowUnix>env.ValidUntil { return nil,errors.New("paymaster sponsorship is expired") }
	return env,nil
}

func decode(raw []byte)(*Envelope,error){
	if len(raw)<11*32 || len(raw)%32!=0 { return nil,errors.New("noncanonical ABI length") }
	word:=func(i int)[]byte{return raw[i*32:(i+1)*32]}
	if !allZero(word(0)[:31]) || word(0)[31]!=1 { return nil,errors.New("unsupported version") }
	paymaster,err:=addressWord(word(1)); if err!=nil { return nil,fmt.Errorf("paymaster: %w",err) }
	entryPoint,err:=addressWord(word(2)); if err!=nil { return nil,fmt.Errorf("entryPoint: %w",err) }
	chain:=new(big.Int).SetBytes(word(3)); if chain.Sign()==0 { return nil,errors.New("zero chain id") }
	if allZero(word(4)) { return nil,errors.New("zero policy id") }
	validAfter,err:=uint48Word(word(5)); if err!=nil{return nil,fmt.Errorf("validAfter: %w",err)}
	validUntil,err:=uint48Word(word(6)); if err!=nil{return nil,fmt.Errorf("validUntil: %w",err)}
	if validUntil==0 || validUntil<=validAfter { return nil,errors.New("invalid validity window") }
	if !allZero(word(7)[:16]) { return nil,errors.New("max sponsored cost exceeds uint128") }
	maxCost:=new(big.Int).SetBytes(word(7)[16:]); if maxCost.Sign()==0 { return nil,errors.New("zero max sponsored cost") }
	if allZero(word(8)) { return nil,errors.New("zero authorization id") }
	offset:=new(big.Int).SetBytes(word(9))
	if !offset.IsUint64() || offset.Uint64()!=10*32 { return nil,errors.New("noncanonical sponsorData offset") }
	lengthWord:=word(10)
	length:=new(big.Int).SetBytes(lengthWord)
	if !length.IsUint64() || length.Uint64()>MaxSponsorDataBytes { return nil,errors.New("sponsorData too large") }
	n:=int(length.Uint64())
	padded:=((n+31)/32)*32
	if len(raw)!=(11*32)+padded { return nil,errors.New("noncanonical sponsorData length") }
	data:=append([]byte(nil),raw[11*32:11*32+n]...)
	if !allZero(raw[11*32+n:]) { return nil,errors.New("nonzero ABI padding") }
	return &Envelope{
		Version:1,Paymaster:paymaster,EntryPoint:entryPoint,ChainID:chain,
		PolicyID:"0x"+hex.EncodeToString(word(4)),ValidAfter:validAfter,ValidUntil:validUntil,
		MaxSponsoredCostWei:maxCost,AuthorizationID:"0x"+hex.EncodeToString(word(8)),SponsorData:data,
	},nil
}

func addressWord(w []byte)(string,error){
	if len(w)!=32 || !allZero(w[:12]) || allZero(w[12:]) { return "",errors.New("invalid address word") }
	return "0x"+hex.EncodeToString(w[12:]),nil
}
func uint48Word(w []byte)(uint64,error){
	if len(w)!=32 || !allZero(w[:26]) { return 0,errors.New("exceeds uint48") }
	var v uint64
	for _,b:=range w[26:] { v=(v<<8)|uint64(b) }
	return v,nil
}
func allZero(b []byte)bool{return bytes.Equal(b,make([]byte,len(b)))}
