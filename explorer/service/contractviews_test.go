package service

import (
	"context"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/indexer/model"
)

type contractFakeIndexer struct {
	*fakeIndexer
	contract model.ContractRecord
}

func (f contractFakeIndexer) Contract(context.Context, string) (model.ContractRecord, error) { return f.contract, nil }

func TestContractDetailPresentsRuntimeCode(t *testing.T) {
	address := "0x1111111111111111111111111111111111111111"
	idx := contractFakeIndexer{fakeIndexer: &fakeIndexer{}, contract: model.ContractRecord{
		ChainID: 420, Address: address, DeploymentTxHash: "0xtx", DeploymentBlock: 7,
		DeploymentHash: "0xblock", RuntimeCode: "0x60016000", CodeHash: "0xhash", SchemaVersion: "v1",
	}}
	svc, err := New(idx, 420, time.Minute)
	if err != nil { t.Fatal(err) }
	view, err := svc.ContractDetail(context.Background(), address)
	if err != nil { t.Fatal(err) }
	if !view.HasRuntimeCode || view.RuntimeCodeBytes != 4 || view.Contract.CodeHash != "0xhash" { t.Fatalf("unexpected contract view: %+v", view) }
}

func TestContractDetailRejectsAddressMismatch(t *testing.T) {
	idx := contractFakeIndexer{fakeIndexer: &fakeIndexer{}, contract: model.ContractRecord{
		ChainID: 420, Address: "0x2222222222222222222222222222222222222222", DeploymentTxHash: "0xtx", DeploymentHash: "0xblock",
	}}
	svc, _ := New(idx, 420, time.Minute)
	if _, err := svc.ContractDetail(context.Background(), "0x1111111111111111111111111111111111111111"); err == nil { t.Fatal("expected address mismatch") }
}
