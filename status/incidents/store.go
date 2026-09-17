package incidents

import (
	"errors"
	"fmt"
	"sort"
	"sync"
)

type Store struct {
	mu    sync.RWMutex
	items map[string]Incident
}

func NewStore() *Store { return &Store{items: map[string]Incident{}} }

func (s *Store) Create(i Incident) error {
	if err := i.Validate(); err != nil { return err }
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.items[i.ID]; exists { return fmt.Errorf("incident %q already exists", i.ID) }
	i.AffectedComponents = NormalizeAffected(i.AffectedComponents)
	s.items[i.ID] = clone(i)
	return nil
}

func (s *Store) Append(id string, u Update) error {
	if err := u.Validate(); err != nil { return err }
	s.mu.Lock()
	defer s.mu.Unlock()
	i, ok := s.items[id]
	if !ok { return fmt.Errorf("incident %q not found", id) }
	if i.CurrentState() == StateResolved { return errors.New("resolved incident history is immutable") }
	last := i.Updates[len(i.Updates)-1]
	if u.At.Before(last.At) { return errors.New("incident updates must be append-only by time") }
	if !AllowedTransition(last.State, u.State) { return fmt.Errorf("invalid incident transition %s -> %s", last.State, u.State) }
	i.Updates = append(i.Updates, u)
	if err := i.Validate(); err != nil { return err }
	s.items[id] = clone(i)
	return nil
}

func (s *Store) Get(id string) (Incident, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	i, ok := s.items[id]
	if !ok { return Incident{}, false }
	return clone(i), true
}

func (s *Store) Active() []Incident {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Incident, 0)
	for _, i := range s.items {
		if i.CurrentState() != StateResolved { out = append(out, clone(i)) }
	}
	sort.Slice(out, func(a, b int) bool {
		if out[a].StartedAt.Equal(out[b].StartedAt) { return out[a].ID < out[b].ID }
		return out[a].StartedAt.Before(out[b].StartedAt)
	})
	return out
}

func clone(i Incident) Incident {
	i.AffectedComponents = append([]string(nil), i.AffectedComponents...)
	i.Updates = append([]Update(nil), i.Updates...)
	for n := range i.Updates {
		i.Updates[n].Evidence = append([]evidence.Reference(nil), i.Updates[n].Evidence...)
	}
	return i
}
