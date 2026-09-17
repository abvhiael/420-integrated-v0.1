package feed

import (
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/420integrated/420-integrated/notifications/security"
)

type DeliveryStatus string

const (
	DeliveryPending   DeliveryStatus = "pending"
	DeliveryDelivered DeliveryStatus = "delivered"
	DeliveryFailed    DeliveryStatus = "failed"
	DeliveryDead      DeliveryStatus = "dead_letter"
)

type Item struct {
	ID              string
	EventID         string
	SubscriptionID  string
	Title           string
	Body            string
	Read            bool
	DeliveryStatus  DeliveryStatus
	Provenance      security.Provenance
	CreatedAt       time.Time
	UpdatedAt       time.Time
	Authoritative   bool
}

type Page struct {
	Items      []Item
	NextCursor string
}

type Store struct {
	mu    sync.RWMutex
	items map[string]Item
}

func NewStore() *Store { return &Store{items: map[string]Item{}} }

func (s *Store) Put(item Item) (Item, error) {
	item.ID = strings.TrimSpace(item.ID)
	item.EventID = strings.TrimSpace(item.EventID)
	item.SubscriptionID = strings.TrimSpace(item.SubscriptionID)
	if item.ID == "" || item.EventID == "" || item.SubscriptionID == "" { return Item{}, errors.New("notification identity is required") }
	if item.CreatedAt.IsZero() { return Item{}, errors.New("created time is required") }
	if err := security.ValidateProvenance(item.Provenance); err != nil { return Item{}, err }
	if item.Authoritative { return Item{}, errors.New("notification feed item cannot be authoritative") }
	if item.DeliveryStatus == "" { item.DeliveryStatus = DeliveryPending }
	if !validDeliveryStatus(item.DeliveryStatus) { return Item{}, errors.New("invalid delivery status") }
	if item.UpdatedAt.IsZero() { item.UpdatedAt = item.CreatedAt }

	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.items[item.ID]; exists { return Item{}, errors.New("notification already exists") }
	s.items[item.ID] = item
	return item, nil
}

func (s *Store) Get(id string) (Item, error) {
	s.mu.RLock(); defer s.mu.RUnlock()
	item, ok := s.items[strings.TrimSpace(id)]
	if !ok { return Item{}, errors.New("notification not found") }
	return item, nil
}

func (s *Store) SetRead(id string, read bool, now time.Time) (Item, error) {
	if now.IsZero() { return Item{}, errors.New("update time is required") }
	s.mu.Lock(); defer s.mu.Unlock()
	item, ok := s.items[strings.TrimSpace(id)]
	if !ok { return Item{}, errors.New("notification not found") }
	item.Read = read
	item.UpdatedAt = now
	s.items[item.ID] = item
	return item, nil
}

func (s *Store) SetDeliveryStatus(id string, status DeliveryStatus, now time.Time) (Item, error) {
	if !validDeliveryStatus(status) { return Item{}, errors.New("invalid delivery status") }
	if now.IsZero() { return Item{}, errors.New("update time is required") }
	s.mu.Lock(); defer s.mu.Unlock()
	item, ok := s.items[strings.TrimSpace(id)]
	if !ok { return Item{}, errors.New("notification not found") }
	item.DeliveryStatus = status
	item.UpdatedAt = now
	s.items[item.ID] = item
	return item, nil
}

func (s *Store) List(after string, limit int) Page {
	s.mu.RLock(); defer s.mu.RUnlock()
	items := make([]Item, 0, len(s.items))
	for _, item := range s.items { items = append(items, item) }
	sort.Slice(items, func(i, j int) bool {
		if !items[i].CreatedAt.Equal(items[j].CreatedAt) { return items[i].CreatedAt.After(items[j].CreatedAt) }
		return items[i].ID < items[j].ID
	})
	start := 0
	if after != "" {
		for i := range items {
			if cursor(items[i]) == after { start = i + 1; break }
		}
	}
	if limit <= 0 { limit = 50 }
	end := start + limit
	if end > len(items) { end = len(items) }
	pageItems := append([]Item(nil), items[start:end]...)
	next := ""
	if end < len(items) && len(pageItems) > 0 { next = cursor(pageItems[len(pageItems)-1]) }
	return Page{Items: pageItems, NextCursor: next}
}

func cursor(item Item) string { return item.CreatedAt.UTC().Format(time.RFC3339Nano) + "|" + item.ID }
func validDeliveryStatus(v DeliveryStatus) bool { return v == DeliveryPending || v == DeliveryDelivered || v == DeliveryFailed || v == DeliveryDead }
