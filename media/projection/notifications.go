package projection

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	searchresult "github.com/420integrated/420-integrated/search/result"
)

var (
	ErrInvalidSubscription = errors.New("420media notifications: invalid subscription")
	ErrNotSubscribed       = errors.New("420media notifications: no matching subscription")
)

type Severity uint8

const (
	SeverityInfo Severity = iota + 1
	SeverityAction
	SeveritySecurity
)

type Subscription struct {
	UserRef          string
	Topic            string
	Channel          string
	MinimumSeverity  Severity
	MinimumFinality  searchresult.Finality
	PromotionalOptIn bool
	Muted            bool
}

type Notification struct {
	ID              string
	UserRef         string
	Topic           string
	Channel         string
	Severity        Severity
	SourceResultID  string
	SourceBlockHash string
	SourceTxHash    string
	SourceLogIndex  uint64
	Finality        searchresult.Finality
	Retracted       bool
	CreatedAt       time.Time
}

type Notifications struct {
	mu            sync.Mutex
	subscriptions map[string]Subscription
	delivered     map[string]Notification
	now           func() time.Time
}

func NewNotifications() *Notifications {
	return &Notifications{
		subscriptions: make(map[string]Subscription),
		delivered:     make(map[string]Notification),
		now:           time.Now,
	}
}

func (n *Notifications) Subscribe(s Subscription) error {
	s.UserRef = strings.TrimSpace(s.UserRef)
	s.Topic = strings.ToLower(strings.TrimSpace(s.Topic))
	s.Channel = strings.ToLower(strings.TrimSpace(s.Channel))
	if s.UserRef == "" || s.Topic == "" || s.Channel == "" ||
		s.MinimumSeverity < SeverityInfo || s.MinimumSeverity > SeveritySecurity ||
		finalityRank(s.MinimumFinality) == 0 {
		return ErrInvalidSubscription
	}
	n.mu.Lock()
	n.subscriptions[subscriptionKey(s.UserRef, s.Topic, s.Channel)] = s
	n.mu.Unlock()
	return nil
}

func (n *Notifications) Unsubscribe(userRef, topic, channel string) {
	n.mu.Lock()
	delete(n.subscriptions, subscriptionKey(userRef, topic, channel))
	n.mu.Unlock()
}

func (n *Notifications) Notify(
	result searchresult.Result,
	topic string,
	severity Severity,
	promotional bool,
) ([]Notification, error) {
	if err := result.Validate(); err != nil {
		return nil, err
	}
	if result.Provenance.Source != "420Indexer" || result.Domain != "asset" ||
		result.Presentation.Category != "media_asset" || result.Provenance.BlockNumber == nil ||
		result.Provenance.LogIndex == nil || finalityRank(result.Provenance.Finality) == 0 {
		return nil, ErrInvalidProjection
	}
	topic = strings.ToLower(strings.TrimSpace(topic))
	if topic == "" || severity < SeverityInfo || severity > SeveritySecurity {
		return nil, ErrInvalidProjection
	}

	n.mu.Lock()
	defer n.mu.Unlock()
	out := make([]Notification, 0)
	matched := false
	for _, sub := range n.subscriptions {
		if sub.Muted || sub.Topic != topic || severity < sub.MinimumSeverity ||
			finalityRank(result.Provenance.Finality) < finalityRank(sub.MinimumFinality) ||
			(promotional && !sub.PromotionalOptIn) {
			continue
		}
		matched = true
		id := notificationID(sub.UserRef, topic, result, false)
		if _, ok := n.delivered[id]; ok {
			continue
		}
		item := Notification{
			ID: id, UserRef: sub.UserRef, Topic: topic, Channel: sub.Channel,
			Severity: severity, SourceResultID: result.ID,
			SourceBlockHash: result.Provenance.BlockHash,
			SourceTxHash: result.Provenance.TransactionHash,
			SourceLogIndex: *result.Provenance.LogIndex,
			Finality: result.Provenance.Finality, CreatedAt: n.now().UTC(),
		}
		n.delivered[id] = item
		out = append(out, item)
	}
	if len(out) == 0 && !matched {
		return nil, ErrNotSubscribed
	}
	return out, nil
}

func (n *Notifications) RetractBlock(blockHash string) []Notification {
	blockHash = strings.ToLower(strings.TrimSpace(blockHash))
	if blockHash == "" {
		return nil
	}
	n.mu.Lock()
	defer n.mu.Unlock()
	out := make([]Notification, 0)
	for id, delivered := range n.delivered {
		if delivered.Retracted || strings.ToLower(delivered.SourceBlockHash) != blockHash {
			continue
		}
		retractID := "retract_" + id
		if _, ok := n.delivered[retractID]; ok {
			continue
		}
		retraction := delivered
		retraction.ID = retractID
		retraction.Retracted = true
		retraction.CreatedAt = n.now().UTC()
		n.delivered[retractID] = retraction
		out = append(out, retraction)
	}
	return out
}

func (n *Notifications) History(userRef string) []Notification {
	n.mu.Lock()
	defer n.mu.Unlock()
	out := make([]Notification, 0)
	for _, item := range n.delivered {
		if item.UserRef == userRef {
			out = append(out, item)
		}
	}
	return out
}

func subscriptionKey(userRef, topic, channel string) string {
	return strings.TrimSpace(userRef) + "|" + strings.ToLower(strings.TrimSpace(topic)) + "|" + strings.ToLower(strings.TrimSpace(channel))
}

func notificationID(userRef, topic string, result searchresult.Result, retracted bool) string {
	material := fmt.Sprintf(
		"420/media/notification/v1|%s|%s|%s|%s|%s|%d|%t",
		userRef, topic, result.ID, strings.ToLower(result.Provenance.BlockHash),
		strings.ToLower(result.Provenance.TransactionHash), *result.Provenance.LogIndex, retracted,
	)
	sum := sha256.Sum256([]byte(material))
	return "media_notif_" + hex.EncodeToString(sum[:])
}

func finalityRank(f searchresult.Finality) int {
	switch f {
	case searchresult.FinalityHead:
		return 1
	case searchresult.FinalitySafe:
		return 2
	case searchresult.FinalityFinalized:
		return 3
	default:
		return 0
	}
}
