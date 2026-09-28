package rpc

import (
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/indexer/model"
)

type fakeRPC struct {
	chain uint64
	genesis model.BlockRecord
	head model.BlockRecord
	safe model.BlockRecord
	finalized model.BlockRecord
	chainErr error
	genesisErr error
	headErr error
	safeErr error
	finalizedErr error
}

func (f fakeRPC) ChainID() (uint64, error) { return f.chain, f.chainErr }
func (f fakeRPC) BlockByNumber(n uint64) (model.BlockRecord, error) {
	if n == 0 { return f.genesis, f.genesisErr }
	return model.BlockRecord{ChainID:f.chain, Number:n, Hash:"0xblock"}, nil
}
func (f fakeRPC) Head() (model.BlockRecord, error) { return f.head, f.headErr }
func (f fakeRPC) Safe() (model.BlockRecord, error) { return f.safe, f.safeErr }
func (f fakeRPC) Finalized() (model.BlockRecord, error) { return f.finalized, f.finalizedErr }

func goodRPC(now time.Time) fakeRPC {
	return fakeRPC{
		chain: 420,
		genesis: model.BlockRecord{ChainID:420, Number:0, Hash:"0xgenesis"},
		head: model.BlockRecord{ChainID:420, Number:100, Hash:"0xhead", Timestamp:uint64(now.Unix())},
		safe: model.BlockRecord{ChainID:420, Number:98, Hash:"0xsafe"},
		finalized: model.BlockRecord{ChainID:420, Number:95, Hash:"0xfinalized"},
	}
}

func req(now time.Time) Requirements {
	return Requirements{RequiredChainID:420, ExpectedGenesisHash:"0xgenesis", MaxHeadAge:2*time.Minute, Now:now}
}

func TestValidateHealthySource(t *testing.T) {
	now := time.Unix(2000000000, 0).UTC()
	v, err := Validate(goodRPC(now), req(now))
	if err != nil { t.Fatal(err) }
	if !v.Healthy || v.ObservedGenesisHash != "0xgenesis" { t.Fatalf("expected healthy source: %+v", v) }
}

func TestValidateRejectsWrongChain(t *testing.T) {
	now := time.Unix(2000000000, 0).UTC()
	f := goodRPC(now); f.chain = 1
	_, err := Validate(f, req(now))
	if !errors.Is(err, ErrWrongChain) { t.Fatalf("expected wrong-chain error, got %v", err) }
}

func TestValidateRejectsGenesisMismatch(t *testing.T) {
	now := time.Unix(2000000000, 0).UTC()
	f := goodRPC(now); f.genesis.Hash = "0xother"
	_, err := Validate(f, req(now))
	if !errors.Is(err, ErrGenesisMismatch) { t.Fatalf("expected genesis mismatch, got %v", err) }
}

func TestValidateRejectsImpossibleFinalityOrdering(t *testing.T) {
	now := time.Unix(2000000000, 0).UTC()
	f := goodRPC(now); f.safe.Number = 90; f.finalized.Number = 95
	_, err := Validate(f, req(now))
	if !errors.Is(err, ErrFinalityOrdering) { t.Fatalf("expected finality ordering error, got %v", err) }
}

func TestValidateRejectsStaleHead(t *testing.T) {
	now := time.Unix(2000000000, 0).UTC()
	f := goodRPC(now); f.head.Timestamp = uint64(now.Add(-3*time.Minute).Unix())
	_, err := Validate(f, req(now))
	if !errors.Is(err, ErrStaleSource) { t.Fatalf("expected stale-source error, got %v", err) }
}

func TestValidateRejectsMissingHeadHash(t *testing.T) {
	now := time.Unix(2000000000, 0).UTC()
	f := goodRPC(now); f.head.Hash = ""
	_, err := Validate(f, req(now))
	if !errors.Is(err, ErrSourceIdentity) { t.Fatalf("expected source identity error, got %v", err) }
}

func TestValidatePropagatesMalformedSourceFailure(t *testing.T) {
	now := time.Unix(2000000000, 0).UTC()
	f := goodRPC(now); f.headErr = errors.New("malformed rpc response")
	_, err := Validate(f, req(now))
	if !errors.Is(err, ErrSourceIdentity) { t.Fatalf("expected source identity error, got %v", err) }
}

func TestValidateRejectsCrossChainFinalityRecord(t *testing.T) {
	now := time.Unix(2000000000, 0).UTC()
	f := goodRPC(now); f.finalized.ChainID = 1
	_, err := Validate(f, req(now))
	if !errors.Is(err, ErrSourceIdentity) { t.Fatalf("expected source identity error, got %v", err) }
}
