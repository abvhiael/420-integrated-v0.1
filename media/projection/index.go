package projection

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"

	searchresult "github.com/420integrated/420-integrated/search/result"
)

var (
	ErrFinalizedConflict = errors.New("420media projection: finalized history conflict")
	ErrRebuildOrder      = errors.New("420media projection: invalid rebuild order")
)

type Action string

const (
	ActionUpsert Action = "UPSERT"
	ActionDelete Action = "DELETE"
)

type Event struct {
	Action Action
	Result searchresult.Result
}

type Entry struct {
	Result searchresult.Result
}

type Index struct {
	mu              sync.RWMutex
	entries         map[string]Entry
	finalizedHeight uint64
}

func NewIndex() *Index {
	return &Index{entries: make(map[string]Entry)}
}

func (i *Index) Apply(event Event) error {
	i.mu.Lock()
	defer i.mu.Unlock()
	return i.apply(event)
}

func (i *Index) apply(event Event) error {
	if event.Action != ActionUpsert && event.Action != ActionDelete {
		return ErrInvalidProjection
	}
	if err := event.Result.Validate(); err != nil {
		return err
	}
	if event.Result.Provenance.Source == "" {
		return ErrInvalidProjection
	}
	if event.Result.Provenance.BlockNumber == nil {
		return ErrInvalidProjection
	}
	block := *event.Result.Provenance.BlockNumber
	previousFinalized := i.finalizedHeight
	if block < previousFinalized {
		return ErrFinalizedConflict
	}

	current, exists := i.entries[event.Result.ID]
	if exists && current.Result.Provenance.BlockNumber != nil {
		currentBlock := *current.Result.Provenance.BlockNumber
		if currentBlock <= previousFinalized && block <= previousFinalized {
			if current.Result.Provenance.LogIndex == nil || event.Result.Provenance.LogIndex == nil {
				return ErrFinalizedConflict
			}
			currentLog := *current.Result.Provenance.LogIndex
			incomingLog := *event.Result.Provenance.LogIndex
			backward := block < currentBlock || (block == currentBlock && incomingLog < currentLog)
			samePositionRewrite := block == currentBlock && incomingLog == currentLog &&
				(strings.ToLower(current.Result.Provenance.BlockHash) != strings.ToLower(event.Result.Provenance.BlockHash) ||
					strings.ToLower(current.Result.Provenance.TransactionHash) != strings.ToLower(event.Result.Provenance.TransactionHash))
			if backward || samePositionRewrite {
				return ErrFinalizedConflict
			}
		}
	}
	if event.Result.Provenance.Finality == searchresult.FinalityFinalized && block > i.finalizedHeight {
		i.finalizedHeight = block
	}
	if event.Action == ActionDelete {
		delete(i.entries, event.Result.ID)
		return nil
	}
	i.entries[event.Result.ID] = Entry{Result: event.Result}
	return nil
}

func (i *Index) Rollback(ancestor uint64) error {
	i.mu.Lock()
	defer i.mu.Unlock()
	if ancestor < i.finalizedHeight {
		return ErrFinalizedConflict
	}
	for id, entry := range i.entries {
		if entry.Result.Provenance.BlockNumber != nil && *entry.Result.Provenance.BlockNumber > ancestor {
			delete(i.entries, id)
		}
	}
	return nil
}

func (i *Index) Rebuild(events []Event) error {
	ordered := append([]Event(nil), events...)
	sort.SliceStable(ordered, func(a, b int) bool {
		ab := uint64(0)
		bb := uint64(0)
		if ordered[a].Result.Provenance.BlockNumber != nil {
			ab = *ordered[a].Result.Provenance.BlockNumber
		}
		if ordered[b].Result.Provenance.BlockNumber != nil {
			bb = *ordered[b].Result.Provenance.BlockNumber
		}
		if ab != bb {
			return ab < bb
		}
		ai := uint64(0)
		bi := uint64(0)
		if ordered[a].Result.Provenance.LogIndex != nil {
			ai = *ordered[a].Result.Provenance.LogIndex
		}
		if ordered[b].Result.Provenance.LogIndex != nil {
			bi = *ordered[b].Result.Provenance.LogIndex
		}
		return ai < bi
	})
	next := NewIndex()
	var previous string
	for _, event := range ordered {
		if event.Result.Provenance.BlockNumber == nil || event.Result.Provenance.LogIndex == nil {
			return ErrRebuildOrder
		}
		key := fmt.Sprintf("%020d:%020d", *event.Result.Provenance.BlockNumber, *event.Result.Provenance.LogIndex)
		if key == previous {
			return ErrRebuildOrder
		}
		previous = key
		if err := next.apply(event); err != nil {
			return err
		}
	}
	i.mu.Lock()
	i.entries = next.entries
	i.finalizedHeight = next.finalizedHeight
	i.mu.Unlock()
	return nil
}

func (i *Index) Get(id string) (searchresult.Result, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()
	entry, ok := i.entries[id]
	return entry.Result, ok
}

func (i *Index) All() []searchresult.Result {
	i.mu.RLock()
	defer i.mu.RUnlock()
	out := make([]searchresult.Result, 0, len(i.entries))
	for _, entry := range i.entries {
		out = append(out, entry.Result)
	}
	sort.Slice(out, func(a, b int) bool { return out[a].ID < out[b].ID })
	return out
}

func (i *Index) FinalizedHeight() uint64 {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.finalizedHeight
}
