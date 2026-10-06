package security

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"sync"
	"time"
)

var (
	ErrWebhookSignature = errors.New("420media security: invalid webhook signature")
	ErrWebhookExpired   = errors.New("420media security: webhook outside allowed time window")
	ErrWebhookReplay    = errors.New("420media security: webhook replay")
	ErrWebhookKey       = errors.New("420media security: unknown webhook key")
)

type WebhookVerifier struct {
	mu      sync.Mutex
	Keys    map[string][]byte
	MaxSkew time.Duration
	Now     func() time.Time
	seen    map[string]time.Time
}

func NewWebhookVerifier(keys map[string][]byte, maxSkew time.Duration) (*WebhookVerifier, error) {
	if len(keys) == 0 || maxSkew <= 0 {
		return nil, errors.New("420media security: invalid webhook verifier")
	}
	copied := make(map[string][]byte, len(keys))
	for id, key := range keys {
		if strings.TrimSpace(id) == "" || len(key) < 32 {
			return nil, errors.New("420media security: invalid webhook key")
		}
		copied[id] = append([]byte(nil), key...)
	}
	return &WebhookVerifier{Keys: copied, MaxSkew: maxSkew, Now: time.Now, seen: make(map[string]time.Time)}, nil
}

func (v *WebhookVerifier) Verify(eventID, keyID string, at time.Time, payload []byte, signatureHex string) error {
	if v == nil || strings.TrimSpace(eventID) == "" || at.IsZero() {
		return ErrWebhookSignature
	}
	key, ok := v.Keys[keyID]
	if !ok {
		return ErrWebhookKey
	}
	now := v.Now().UTC()
	delta := now.Sub(at.UTC())
	if delta < -v.MaxSkew || delta > v.MaxSkew {
		return ErrWebhookExpired
	}
	signature, err := hex.DecodeString(strings.TrimPrefix(strings.TrimSpace(signatureHex), "sha256="))
	if err != nil {
		return ErrWebhookSignature
	}
	expected := webhookMAC(key, eventID, at.UTC(), payload)
	if !hmac.Equal(signature, expected) {
		return ErrWebhookSignature
	}

	v.mu.Lock()
	defer v.mu.Unlock()
	for id, seenAt := range v.seen {
		if now.Sub(seenAt) > 2*v.MaxSkew {
			delete(v.seen, id)
		}
	}
	if _, exists := v.seen[eventID]; exists {
		return ErrWebhookReplay
	}
	v.seen[eventID] = now
	return nil
}

func webhookMAC(key []byte, eventID string, at time.Time, payload []byte) []byte {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(eventID))
	_, _ = mac.Write([]byte("\n"))
	_, _ = mac.Write([]byte(at.Format(time.RFC3339Nano)))
	_, _ = mac.Write([]byte("\n"))
	_, _ = mac.Write(payload)
	return mac.Sum(nil)
}
