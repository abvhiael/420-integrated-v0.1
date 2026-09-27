package service

import (
	"context"
	"errors"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

// BlockSummary is the stable Explorer presentation model for a block row.
// It contains only fields supplied by 420Indexer; Explorer never synthesizes
// canonical chain facts from a second source.
type BlockSummary struct {
	ChainID       uint64         `json:"chainId"`
	Number        uint64         `json:"number"`
	Hash          string         `json:"hash"`
	ParentHash    string         `json:"parentHash"`
	Timestamp     uint64         `json:"timestamp"`
	Finality      model.Finality `json:"finality"`
	Producer      *model.BlockProducer `json:"producer,omitempty"`
	SchemaVersion string         `json:"schemaVersion"`
}

// BlockPageView preserves the fixed-snapshot pagination contract from
// 420Indexer while exposing an Explorer-specific presentation shape.
type BlockPageView struct {
	Meta   indexerapi.PageMeta `json:"meta"`
	Blocks []BlockSummary      `json:"blocks"`
}

// BlockNavigation is bounded by the height that 420Indexer reports as
// indexed. A next link is never advertised beyond that projection boundary.
type BlockNavigation struct {
	Previous *uint64 `json:"previous,omitempty"`
	Next     *uint64 `json:"next,omitempty"`
}

// BlockDetailView is the Explorer block-detail resource. LogCount is derived
// from the exact block-scoped log collection returned by 420Indexer.
type BlockTraceView struct {
	ExecutionBlockHash   string         `json:"executionBlockHash"`
	ConsensusBlockRoot   string         `json:"consensusBlockRoot"`
	ConsensusSlot        uint64         `json:"consensusSlot"`
	ProducerSeat         uint16         `json:"producerSeat"`
	ProposerRank         uint8          `json:"proposerRank"`
	Certified            bool           `json:"certified"`
	Finality             model.Finality `json:"finality"`
	SchemaVersion        string         `json:"schemaVersion"`
	CanonicalAuthority   bool           `json:"canonicalAuthority"`
	ExecutionAuthority   string         `json:"executionAuthority"`
	ConsensusAuthority   string         `json:"consensusAuthority"`
	ProjectionAuthority  string         `json:"projectionAuthority"`
}

type BlockDetailView struct {
	Block      BlockSummary      `json:"block"`
	Trace      *BlockTraceView   `json:"trace,omitempty"`
	Logs       []model.LogRecord `json:"logs"`
	LogCount   int               `json:"logCount"`
	Navigation BlockNavigation   `json:"navigation"`
}

func summaryFromBlock(block model.BlockRecord) BlockSummary {
	return BlockSummary{
		ChainID:       block.ChainID,
		Number:        block.Number,
		Hash:          block.Hash,
		ParentHash:    block.ParentHash,
		Timestamp:     block.Timestamp,
		Finality:      block.Finality,
		Producer:      block.Producer,
		SchemaVersion: block.SchemaVersion,
	}
}

// BlockPage returns a presentation page without changing the indexer's
// snapshot cursor or finality provenance.
func (s *Service) BlockPage(ctx context.Context, limit uint32, cursor string) (BlockPageView, error) {
	page, err := s.Blocks(ctx, limit, cursor)
	if err != nil {
		return BlockPageView{}, err
	}
	out := BlockPageView{Meta: page.Meta, Blocks: make([]BlockSummary, 0, len(page.Blocks))}
	for _, block := range page.Blocks {
		if block.Hash == "" {
			return BlockPageView{}, errors.New("420Indexer returned block without canonical hash")
		}
		if block.Number > page.Meta.SnapshotHeight {
			return BlockPageView{}, errors.New("420Indexer returned block beyond page snapshot")
		}
		out.Blocks = append(out.Blocks, summaryFromBlock(block))
	}
	return out, nil
}

// BlockDetail composes block, logs and navigation from the shared indexer.
// The health read is used only to bound presentation navigation; it does not
// make Explorer an authority for chain head/finality.
func traceFromBlock(block model.BlockRecord) (*BlockTraceView, error) {
	if block.Number == 0 { return nil, nil }
	if block.Producer == nil { return nil, errors.New("420Indexer returned block without historical producer provenance") }
	p := block.Producer
	if p.ConsensusBlockRoot == "" { return nil, errors.New("420Indexer returned producer provenance without consensus block root") }
	if p.ProposerRank > 2 { return nil, errors.New("420Indexer returned invalid proposer rank") }
	return &BlockTraceView{
		ExecutionBlockHash:block.Hash,
		ConsensusBlockRoot:p.ConsensusBlockRoot,
		ConsensusSlot:p.ConsensusSlot,
		ProducerSeat:p.ProducerSeat,
		ProposerRank:p.ProposerRank,
		Certified:p.Certified,
		Finality:block.Finality,
		SchemaVersion:block.SchemaVersion,
		CanonicalAuthority:false,
		ExecutionAuthority:"node420 canonical execution block",
		ConsensusAuthority:"fourtwentyd consensus-produced block history",
		ProjectionAuthority:"420Indexer derived projection",
	}, nil
}

func (s *Service) BlockTrace(ctx context.Context, number uint64) (BlockTraceView, error) {
	view, err := s.Block(ctx, number)
	if err != nil { return BlockTraceView{}, err }
	if view.Block.Hash == "" { return BlockTraceView{}, errors.New("420Indexer returned block without canonical hash") }
	trace, err := traceFromBlock(view.Block)
	if err != nil { return BlockTraceView{}, err }
	if trace == nil { return BlockTraceView{}, errors.New("genesis block has no validator producer attribution") }
	return *trace, nil
}

func (s *Service) BlockDetail(ctx context.Context, number uint64) (BlockDetailView, error) {
	view, err := s.Block(ctx, number)
	if err != nil {
		return BlockDetailView{}, err
	}
	if view.Block.Hash == "" {
		return BlockDetailView{}, errors.New("420Indexer returned block without canonical hash")
	}

	health, err := s.indexer.Health(ctx)
	if err != nil {
		return BlockDetailView{}, err
	}
	if err := s.requireRecordChain(health.Health.ChainID); err != nil {
		return BlockDetailView{}, err
	}
	if number > health.Health.IndexedHeight {
		return BlockDetailView{}, errors.New("420Indexer returned block beyond indexed height")
	}

	nav := BlockNavigation{}
	if number > 0 {
		previous := number - 1
		nav.Previous = &previous
	}
	if number < health.Health.IndexedHeight {
		next := number + 1
		nav.Next = &next
	}

	trace, err := traceFromBlock(view.Block)
	if err != nil { return BlockDetailView{}, err }

	return BlockDetailView{
		Block:      summaryFromBlock(view.Block),
		Trace:      trace,
		Logs:       view.Logs,
		LogCount:   len(view.Logs),
		Navigation: nav,
	}, nil
}
