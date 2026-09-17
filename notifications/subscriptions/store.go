package subscriptions

import (
	"errors"
	"sort"
	"strings"
	"sync"
)

var (
	ErrNotFound = errors.New("subscription not found")
	ErrExists   = errors.New("subscription already exists")
)

type Store struct {
	mu    sync.RWMutex
	items map[string]Subscription
}

func NewStore() *Store {
	return &Store{items: make(map[string]Subscription)}
}

func (s *Store) Create(sub Subscription) (Subscription, error) {
	sub = Normalize(sub)
	if err := sub.Validate(); err != nil {
		return Subscription{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.items[sub.ID]; ok {
		return Subscription{}, ErrExists
	}
	s.items[sub.ID] = clone(sub)
	return clone(sub), nil
}

func (s *Store) Get(id string) (Subscription, error) {
	id = strings.TrimSpace(id)
	s.mu.RLock()
	defer s.mu.RUnlock()
	sub, ok := s.items[id]
	if !ok {
		return Subscription{}, ErrNotFound
	}
	return clone(sub), nil
}

func (s *Store) List() []Subscription {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Subscription, 0, len(s.items))
	for _, sub := range s.items {
		out = append(out, clone(sub))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

func (s *Store) Update(sub Subscription) (Subscription, error) {
	sub = Normalize(sub)
	if err := sub.Validate(); err != nil {
		return Subscription{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.items[sub.ID]; !ok {
		return Subscription{}, ErrNotFound
	}
	s.items[sub.ID] = clone(sub)
	return clone(sub), nil
}

func (s *Store) SetMuted(id string, muted bool) (Subscription, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sub, ok := s.items[strings.TrimSpace(id)]
	if !ok {
		return Subscription{}, ErrNotFound
	}
	sub.Muted = muted
	s.items[sub.ID] = sub
	return clone(sub), nil
}

func (s *Store) SetPromotionalConsent(id string, consent bool) (Subscription, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sub, ok := s.items[strings.TrimSpace(id)]
	if !ok {
		return Subscription{}, ErrNotFound
	}
	sub.PromotionalConsent = consent
	s.items[sub.ID] = sub
	return clone(sub), nil
}

func (s *Store) Unsubscribe(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	id = strings.TrimSpace(id)
	if _, ok := s.items[id]; !ok {
		return ErrNotFound
	}
	delete(s.items, id)
	return nil
}

func clone(in Subscription) Subscription {
	out := in
	out.Filters.Sources = append([]string(nil), in.Filters.Sources...)
	out.Filters.Topics = append([]string(nil), in.Filters.Topics...)
	out.Filters.Events = append([]string(nil), in.Filters.Events...)
	out.Channels = append([]Channel(nil), in.Channels...)
	return out
}
