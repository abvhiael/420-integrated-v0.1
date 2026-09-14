package service

import (
	"context"
	"encoding/hex"
	"errors"
	"strings"

	"github.com/420integrated/420-integrated/indexer/model"
)

type contractReader interface {
	Contract(context.Context, string) (model.ContractRecord, error)
}

// ContractDetailView presents only indexed runtime-code facts. Explorer never
// reaches node420 directly for contract code.
type ContractDetailView struct {
	Contract          model.ContractRecord `json:"contract"`
	RuntimeCodeBytes  int                  `json:"runtimeCodeBytes"`
	HasRuntimeCode    bool                 `json:"hasRuntimeCode"`
}

func (s *Service) ContractDetail(ctx context.Context, address string) (ContractDetailView, error) {
	address = strings.TrimSpace(address)
	if !validEVMAddress(address) { return ContractDetailView{}, errors.New("invalid contract address") }
	reader, ok := s.indexer.(contractReader)
	if !ok { return ContractDetailView{}, errors.New("420Indexer contract query unavailable") }
	record, err := reader.Contract(ctx, address)
	if err != nil { return ContractDetailView{}, err }
	if err := s.requireRecordChain(record.ChainID); err != nil { return ContractDetailView{}, err }
	if !strings.EqualFold(record.Address, address) { return ContractDetailView{}, errors.New("420Indexer returned contract address mismatch") }
	if record.DeploymentTxHash == "" || record.DeploymentHash == "" { return ContractDetailView{}, errors.New("420Indexer returned incomplete contract provenance") }
	code := strings.TrimPrefix(record.RuntimeCode, "0x")
	if len(code)%2 != 0 { return ContractDetailView{}, errors.New("420Indexer returned malformed runtime code") }
	if code != "" {
		if _, err := hex.DecodeString(code); err != nil { return ContractDetailView{}, errors.New("420Indexer returned malformed runtime code") }
	}
	return ContractDetailView{Contract: record, RuntimeCodeBytes: len(code)/2, HasRuntimeCode: code != ""}, nil
}

func validEVMAddress(address string) bool {
	if len(address) != 42 || !strings.HasPrefix(address, "0x") { return false }
	_, err := hex.DecodeString(address[2:])
	return err == nil
}
