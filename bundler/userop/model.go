package userop

import (
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
)

type PackedUserOperation struct {
	Sender             string `json:"sender"`
	Nonce              string `json:"nonce"`
	InitCode           string `json:"initCode"`
	CallData           string `json:"callData"`
	AccountGasLimits   string `json:"accountGasLimits"`
	PreVerificationGas string `json:"preVerificationGas"`
	GasFees            string `json:"gasFees"`
	PaymasterAndData   string `json:"paymasterAndData"`
	Signature          string `json:"signature"`
}

type Canonical struct {
	Sender             [20]byte
	Nonce              *big.Int
	InitCode           []byte
	CallData           []byte
	AccountGasLimits   [32]byte
	PreVerificationGas *big.Int
	GasFees            [32]byte
	PaymasterAndData   []byte
	Signature          []byte
}

func (op PackedUserOperation) Canonicalize() (Canonical, error) {
	var out Canonical
	var err error
	if out.Sender, err = decodeFixed20("sender", op.Sender); err != nil { return Canonical{}, err }
	if out.Nonce, err = parseQuantity("nonce", op.Nonce); err != nil { return Canonical{}, err }
	if out.InitCode, err = decodeBytes("initCode", op.InitCode); err != nil { return Canonical{}, err }
	if out.CallData, err = decodeBytes("callData", op.CallData); err != nil { return Canonical{}, err }
	if out.AccountGasLimits, err = decodeFixed32("accountGasLimits", op.AccountGasLimits); err != nil { return Canonical{}, err }
	if out.PreVerificationGas, err = parseQuantity("preVerificationGas", op.PreVerificationGas); err != nil { return Canonical{}, err }
	if out.GasFees, err = decodeFixed32("gasFees", op.GasFees); err != nil { return Canonical{}, err }
	if out.PaymasterAndData, err = decodeBytes("paymasterAndData", op.PaymasterAndData); err != nil { return Canonical{}, err }
	if out.Signature, err = decodeBytes("signature", op.Signature); err != nil { return Canonical{}, err }
	return out, nil
}

func parseQuantity(name, raw string) (*big.Int, error) {
	if len(raw) < 3 || !strings.HasPrefix(raw, "0x") { return nil, fmt.Errorf("%s must be a 0x-prefixed RPC quantity", name) }
	digits := raw[2:]
	if digits == "" { return nil, fmt.Errorf("%s is empty", name) }
	if len(digits) > 1 && digits[0] == '0' { return nil, fmt.Errorf("%s is not canonical", name) }
	if len(digits) > 64 { return nil, fmt.Errorf("%s exceeds uint256", name) }
	v := new(big.Int)
	if _, ok := v.SetString(digits, 16); !ok { return nil, fmt.Errorf("%s is not hex", name) }
	if v.Sign() < 0 || v.BitLen() > 256 { return nil, fmt.Errorf("%s exceeds uint256", name) }
	return v, nil
}

func decodeBytes(name, raw string) ([]byte, error) {
	if !strings.HasPrefix(raw, "0x") { return nil, fmt.Errorf("%s must be 0x-prefixed", name) }
	digits := raw[2:]
	if len(digits)%2 != 0 { return nil, fmt.Errorf("%s must contain whole bytes", name) }
	if digits == "" { return []byte{}, nil }
	b, err := hex.DecodeString(digits)
	if err != nil { return nil, fmt.Errorf("%s is not hex", name) }
	return b, nil
}

func decodeFixed20(name, raw string) ([20]byte, error) {
	var out [20]byte
	b, err := decodeBytes(name, raw)
	if err != nil { return out, err }
	if len(b) != len(out) { return out, fmt.Errorf("%s must be 20 bytes", name) }
	copy(out[:], b)
	var zero [20]byte
	if out == zero { return out, errors.New("sender must be non-zero") }
	return out, nil
}

func decodeFixed32(name, raw string) ([32]byte, error) {
	var out [32]byte
	b, err := decodeBytes(name, raw)
	if err != nil { return out, err }
	if len(b) != len(out) { return out, fmt.Errorf("%s must be 32 bytes", name) }
	copy(out[:], b)
	return out, nil
}
