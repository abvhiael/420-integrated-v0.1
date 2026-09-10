package store

import (
	"sync"

	"github.com/420integrated/420-integrated/indexer/model"
)

// Memory is a rebuildable non-production store useful for qualification and local development.
type Memory struct {
	mu     sync.RWMutex
	cp     model.ChainCheckpoint
	hasCP  bool
	blocks map[uint64]model.BlockRecord
}

func NewMemory() *Memory { return &Memory{blocks: make(map[uint64]model.BlockRecord)} }

func (m *Memory) Checkpoint() (model.ChainCheckpoint, bool, error) {
	m.mu.RLock(); defer m.mu.RUnlock()
	return m.cp, m.hasCP, nil
}

func (m *Memory) SaveCheckpoint(cp model.ChainCheckpoint) error {
	m.mu.Lock(); defer m.mu.Unlock()
	m.cp, m.hasCP = cp, true
	return nil
}

func (m *Memory) Block(number uint64) (model.BlockRecord, bool, error) {
	m.mu.RLock(); defer m.mu.RUnlock()
	b, ok := m.blocks[number]
	return b, ok, nil
}

func (m *Memory) PutBlock(block model.BlockRecord) error {
	m.mu.Lock(); defer m.mu.Unlock()
	m.blocks[block.Number] = block
	return nil
}

func (m *Memory) DeleteBlocksAbove(number uint64) error {
	m.mu.Lock(); defer m.mu.Unlock()
	for height := range m.blocks {
		if height > number { delete(m.blocks, height) }
	}
	return nil
}
