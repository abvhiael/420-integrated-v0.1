package gasestimation

import (
	"math/big"
	"strings"
	"testing"

	"github.com/420integrated/420-integrated/bundler/simulation"
	"github.com/420integrated/420-integrated/bundler/userop"
)

func opFixture() userop.PackedUserOperation {
	return userop.PackedUserOperation{
		Sender:"0x2222222222222222222222222222222222222222",
		Nonce:"0x1",InitCode:"0x",CallData:"0x1234",
		AccountGasLimits:"0x"+strings.Repeat("00",16)+strings.Repeat("01",16),
		PreVerificationGas:"0x5208",
		GasFees:"0x"+strings.Repeat("00",32),
		PaymasterAndData:"0x",Signature:"0xaabb",
	}
}

func TestLocalPreVerificationGasIncludesIntrinsicAndCalldata(t *testing.T){
	data,err:=simulation.EncodeHandleOp(opFixture())
	if err!=nil { t.Fatal(err) }
	got:=localPreVerificationGas(data)
	if got.Cmp(big.NewInt(21000))<=0 { t.Fatalf("expected calldata cost above intrinsic, got %s",got) }
}

func TestQuantityRoundTrip(t *testing.T){
	v,err:=parseQuantity("0x5208")
	if err!=nil { t.Fatal(err) }
	if quantity(v)!="0x5208" { t.Fatalf("round trip mismatch: %s",quantity(v)) }
	if _,err:=parseQuantity("0x05208"); err==nil { t.Fatal("accepted noncanonical quantity") }
}

func TestInvalidEstimatorConfiguration(t *testing.T){
	if _,err:=NewRPC("http://127.0.0.1:8545","0x1111111111111111111111111111111111111111",0); err==nil {
		t.Fatal("expected invalid configuration")
	}
}
