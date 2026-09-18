package projection

import (
	"errors"
	"sort"
	"strings"
	"sync"
)

type Store struct {
	mu sync.RWMutex
	items map[string]Document
}

func NewStore() *Store {
	return &Store{items: map[string]Document{}}
}

func (s *Store) Replace(doc Document) error {
	if err := doc.Validate(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[doc.ID] = doc
	return nil
}

func (s *Store) Get(id string) (Document, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	doc, ok := s.items[strings.TrimSpace(id)]
	return doc, ok
}

func (s *Store) Remove(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.items, strings.TrimSpace(id))
}

func (s *Store) Rebuild(docs []Document) error {
	next := make(map[string]Document, len(docs))
	for _, doc := range docs {
		if err := doc.Validate(); err != nil {
			return err
		}
		if _, exists := next[doc.ID]; exists {
			return errors.New("duplicate projection id")
		}
		next[doc.ID] = doc
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items = next
	return nil
}

func (s *Store) Snapshot() []Document {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Document,0,len(s.items))
	for _, doc := range s.items {
		out = append(out,doc)
	}
	sort.Slice(out,func(i,j int)bool{
		if out[i].Domain != out[j].Domain { return out[i].Domain < out[j].Domain }
		if out[i].Subject.Type != out[j].Subject.Type { return out[i].Subject.Type < out[j].Subject.Type }
		return out[i].Subject.ID < out[j].Subject.ID
	})
	return out
}
