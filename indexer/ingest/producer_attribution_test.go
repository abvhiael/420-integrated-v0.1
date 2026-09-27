package ingest

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
	indexerrpc "github.com/420integrated/420-integrated/indexer/rpc"
	"github.com/420integrated/420-integrated/indexer/store"
)

type producerSource struct{ blocks map[uint64]model.BlockRecord; head uint64 }
func (s *producerSource) ChainID() (uint64, error) { return 420, nil }
func (s *producerSource) BlockNumber(context.Context) (uint64, error) { return s.head, nil }
func (s *producerSource) BundleByNumber(_ context.Context, _ uint64, n uint64, finality model.Finality, schema string) (indexerrpc.Bundle, error) {
	b := s.blocks[n]; b.Finality = finality; b.SchemaVersion = schema
	return indexerrpc.Bundle{Block:b}, nil
}

type producerMap map[string]model.BlockProducer
func (m producerMap) ProducerForBlock(hash string) (model.BlockProducer, bool, error) {
	p, ok := m[hash]
	return p, ok, nil
}

func TestCatchUpAttachesHistoricalProducerAttribution(t *testing.T) {
	path := filepath.Join(t.TempDir(), "index.json")
	s, err := store.NewFileStore(path); if err != nil { t.Fatal(err) }
	src := &producerSource{head:1, blocks:map[uint64]model.BlockRecord{
		0:{ChainID:420,Number:0,Hash:"0x0"},
		1:{ChainID:420,Number:1,Hash:"0x1",ParentHash:"0x0"},
	}}
	attr := producerMap{"0x1":{ConsensusSlot:9,ProducerSeat:2,ProposerRank:1,ConsensusBlockRoot:"0xc1",Certified:true}}
	e := New(420, "v1", src, s).WithProducerAttributor(attr)
	if err := e.CatchUp(context.Background()); err != nil { t.Fatal(err) }
	got, ok, err := s.Block(1); if err != nil || !ok { t.Fatalf("missing block: ok=%v err=%v",ok,err) }
	if got.Producer == nil || got.Producer.ConsensusSlot != 9 || got.Producer.ProducerSeat != 2 || got.Producer.ProposerRank != 1 || !got.Producer.Certified {
		t.Fatalf("producer attribution missing or wrong: %+v", got)
	}
}

func TestCatchUpFailsClosedWhenHistoricalProducerMissing(t *testing.T) {
	path := filepath.Join(t.TempDir(), "index.json")
	s, err := store.NewFileStore(path); if err != nil { t.Fatal(err) }
	src := &producerSource{head:1, blocks:map[uint64]model.BlockRecord{
		0:{ChainID:420,Number:0,Hash:"0x0"},
		1:{ChainID:420,Number:1,Hash:"0x1",ParentHash:"0x0"},
	}}
	e := New(420, "v1", src, s).WithProducerAttributor(producerMap{})
	if err := e.CatchUp(context.Background()); err == nil { t.Fatal("expected missing producer attribution failure") }
	if _, ok, _ := s.Block(1); ok { t.Fatal("block persisted despite missing producer attribution") }
}
