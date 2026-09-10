package rpc

import (
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
)

type fakeRPC struct { chain uint64; head, safe, finalized uint64 }
func (f fakeRPC) ChainID() (uint64, error) { return f.chain, nil }
func (f fakeRPC) BlockByNumber(n uint64) (model.BlockRecord, error) { return model.BlockRecord{ChainID:f.chain, Number:n}, nil }
func (f fakeRPC) Head() (model.BlockRecord, error) { return model.BlockRecord{ChainID:f.chain, Number:f.head}, nil }
func (f fakeRPC) Safe() (model.BlockRecord, error) { return model.BlockRecord{ChainID:f.chain, Number:f.safe}, nil }
func (f fakeRPC) Finalized() (model.BlockRecord, error) { return model.BlockRecord{ChainID:f.chain, Number:f.finalized}, nil }

func TestValidateHealthySource(t *testing.T) {
	v, err := Validate(fakeRPC{chain:420, head:100, safe:98, finalized:95}, 420)
	if err != nil { t.Fatal(err) }
	if !v.Healthy { t.Fatalf("expected healthy source: %+v", v) }
}

func TestValidateWrongChainDoesNotBecomeHealthy(t *testing.T) {
	v, err := Validate(fakeRPC{chain:1, head:100, safe:98, finalized:95}, 420)
	if err != nil { t.Fatal(err) }
	if v.Healthy || v.ObservedChainID != 1 { t.Fatalf("unexpected validation: %+v", v) }
}

func TestValidateRejectsImpossibleFinalityOrdering(t *testing.T) {
	v, err := Validate(fakeRPC{chain:420, head:100, safe:90, finalized:95}, 420)
	if err != nil { t.Fatal(err) }
	if v.Healthy { t.Fatalf("expected unhealthy ordering: %+v", v) }
}
