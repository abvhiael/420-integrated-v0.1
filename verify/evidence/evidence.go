package evidence

import (
	"errors"
	"fmt"
	"strings"
)

const Phase = "VERIFY-2"

type MissingContextReason string

const (
	MissingNone                 MissingContextReason = ""
	MissingGenesisOrPredeploy   MissingContextReason = "GENESIS_OR_PREDEPLOY"
	MissingCreationTxUnresolved MissingContextReason = "CREATION_TRANSACTION_NOT_RECOVERABLE"
)

type BlockContext struct {
	Number uint64 `json:"number"`
	Hash   string `json:"hash"`
}

type CreationContext struct {
	TransactionHash string `json:"transactionHash,omitempty"`
	ReceiptBlockHash string `json:"receiptBlockHash,omitempty"`
	CreationBytecode string `json:"creationBytecode,omitempty"`
}

type DeploymentEvidence struct {
	ChainID             uint64               `json:"chainId"`
	Address             string               `json:"address"`
	RuntimeBytecode     string               `json:"runtimeBytecode"`
	RuntimeCodeHash     string               `json:"runtimeCodeHash"`
	ObservedAt          BlockContext         `json:"observedAt"`
	FirstCodeBlock      BlockContext         `json:"firstCodeBlock"`
	Creation            *CreationContext     `json:"creation,omitempty"`
	MissingContextReason MissingContextReason `json:"missingContextReason,omitempty"`
	Provenance          string               `json:"provenance"`
}

func (e DeploymentEvidence) BindingKey() string {
	return fmt.Sprintf("%d:%s:%s", e.ChainID, strings.ToLower(e.Address), strings.ToLower(e.RuntimeCodeHash))
}

func (e DeploymentEvidence) Validate() error {
	if e.ChainID == 0 { return errors.New("chain id is required") }
	if !validAddress(e.Address) { return errors.New("valid contract address is required") }
	if e.RuntimeBytecode == "" || e.RuntimeBytecode == "0x" { return errors.New("runtime bytecode is required") }
	if !validHash(e.RuntimeCodeHash) { return errors.New("runtime code hash is required") }
	if !validHash(e.ObservedAt.Hash) || !validHash(e.FirstCodeBlock.Hash) { return errors.New("block hash provenance is required") }
	if e.Provenance == "" { return errors.New("provenance is required") }
	if e.Creation == nil && e.MissingContextReason == MissingNone { return errors.New("missing creation context requires explicit reason") }
	return nil
}

func validAddress(v string) bool { return len(v) == 42 && strings.HasPrefix(v, "0x") }
func validHash(v string) bool { return len(v) == 66 && strings.HasPrefix(v, "0x") }
