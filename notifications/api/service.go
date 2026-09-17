package api

import (
	"errors"
	"time"

	"github.com/420integrated/420-integrated/notifications/feed"
	"github.com/420integrated/420-integrated/notifications/subscriptions"
)

type Service struct {
	subscriptions *subscriptions.Store
	feed          *feed.Store
}

func NewService(subs *subscriptions.Store, history *feed.Store) (*Service, error) {
	if subs == nil { return nil, errors.New("subscription store is required") }
	if history == nil { return nil, errors.New("feed store is required") }
	return &Service{subscriptions: subs, feed: history}, nil
}

func (s *Service) CreateSubscription(sub subscriptions.Subscription) (subscriptions.Subscription, error) {
	return s.subscriptions.Create(sub)
}

func (s *Service) GetSubscription(id string) (subscriptions.Subscription, error) {
	return s.subscriptions.Get(id)
}

func (s *Service) ListSubscriptions() []subscriptions.Subscription {
	return s.subscriptions.List()
}

func (s *Service) UpdateSubscription(sub subscriptions.Subscription) (subscriptions.Subscription, error) {
	return s.subscriptions.Update(sub)
}

func (s *Service) DeleteSubscription(id string) error {
	return s.subscriptions.Unsubscribe(id)
}

func (s *Service) Feed(cursor string, limit int) feed.Page {
	return s.feed.List(cursor, limit)
}

func (s *Service) Notification(id string) (feed.Item, error) {
	return s.feed.Get(id)
}

func (s *Service) SetRead(id string, read bool, now time.Time) (feed.Item, error) {
	return s.feed.SetRead(id, read, now)
}

func (s *Service) SetDeliveryStatus(id string, status feed.DeliveryStatus, now time.Time) (feed.Item, error) {
	return s.feed.SetDeliveryStatus(id, status, now)
}
