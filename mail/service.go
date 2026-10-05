package mail

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	ServiceID       = "420/service/mail/v1"
	MaxSubjectBytes = 200
	MaxBodyBytes    = 1 << 20
	DefaultPageSize = 50
	MaxPageSize     = 100
)

var (
	ErrUnauthorized        = errors.New("mail: unauthorized")
	ErrInvalidInput        = errors.New("mail: invalid input")
	ErrNotFound            = errors.New("mail: message not found")
	ErrIdempotencyConflict = errors.New("mail: idempotency key reused with different request")
)

type IdentityDirectory interface {
	ResolveIdentity(context.Context, string) error
}

type MessengerPolicy interface {
	CanMessage(context.Context, string, string) error
}

type PrivateBlobStore interface {
	PutPrivate(context.Context, string, []byte) (ref string, digest string, err error)
	GetPrivate(context.Context, string, string) ([]byte, error)
}

type NotificationSink interface {
	NotifyMail(context.Context, Notification) error
}

type Notification struct {
	MessageID string
	Recipient string
	Sender    string
	Source    string
}

type Message struct {
	ID             string     `json:"id"`
	Sender         string     `json:"sender"`
	Recipient      string     `json:"recipient"`
	Subject        string     `json:"subject"`
	BodyRef        string     `json:"body_ref,omitempty"`
	BodyDigest     string     `json:"body_digest"`
	ConversationID string     `json:"conversation_id,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	ReadAt         *time.Time `json:"read_at,omitempty"`
	Status         string     `json:"status"`
	Visibility     string     `json:"visibility"`
	Source         string     `json:"source"`
	Version        uint32     `json:"version"`
	Fingerprint    string     `json:"-"`
	IdempotencyKey string     `json:"-"`
}

type SendRequest struct {
	IdempotencyKey string `json:"idempotency_key"`
	Sender         string `json:"sender"`
	Recipient      string `json:"recipient"`
	Subject        string `json:"subject"`
	Body           string `json:"body"`
	ConversationID string `json:"conversation_id,omitempty"`
	Source         string `json:"source"`
}

type Page struct {
	Items      []Message `json:"items"`
	NextCursor string    `json:"next_cursor,omitempty"`
}

type MemoryStore struct {
	mu       sync.RWMutex
	messages map[string]Message
	byIdem   map[string]string
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{messages: map[string]Message{}, byIdem: map[string]string{}}
}

type Service struct {
	Identities IdentityDirectory
	Messenger  MessengerPolicy
	Blobs      PrivateBlobStore
	Notify     NotificationSink
	Store      *MemoryStore
	Now        func() time.Time
}

func NewService(ids IdentityDirectory, messenger MessengerPolicy, blobs PrivateBlobStore, notify NotificationSink) *Service {
	return &Service{Identities: ids, Messenger: messenger, Blobs: blobs, Notify: notify, Store: NewMemoryStore(), Now: func() time.Time { return time.Now().UTC() }}
}

func (s *Service) Send(ctx context.Context, actor string, req SendRequest) (Message, error) {
	actor = strings.TrimSpace(actor)
	req.Sender = strings.TrimSpace(req.Sender)
	req.Recipient = strings.TrimSpace(req.Recipient)
	req.Subject = strings.TrimSpace(req.Subject)
	req.Source = strings.TrimSpace(req.Source)
	req.IdempotencyKey = strings.TrimSpace(req.IdempotencyKey)
	if actor == "" || req.Sender == "" || req.Recipient == "" || actor != req.Sender {
		return Message{}, ErrUnauthorized
	}
	if req.IdempotencyKey == "" || req.Subject == "" || req.Body == "" || req.Source == "" || len([]byte(req.Subject)) > MaxSubjectBytes || len([]byte(req.Body)) > MaxBodyBytes {
		return Message{}, ErrInvalidInput
	}
	if s.Identities == nil || s.Messenger == nil || s.Blobs == nil || s.Store == nil {
		return Message{}, errors.New("mail: service dependencies unavailable")
	}
	if err := s.Identities.ResolveIdentity(ctx, req.Sender); err != nil {
		return Message{}, fmt.Errorf("sender identity: %w", err)
	}
	if err := s.Identities.ResolveIdentity(ctx, req.Recipient); err != nil {
		return Message{}, fmt.Errorf("recipient identity: %w", err)
	}
	if err := s.Messenger.CanMessage(ctx, req.Sender, req.Recipient); err != nil {
		return Message{}, fmt.Errorf("messenger policy: %w", err)
	}

	fp := requestFingerprint(req)
	idemKey := req.Sender + "\x00" + req.IdempotencyKey
	s.Store.mu.RLock()
	if id, ok := s.Store.byIdem[idemKey]; ok {
		existing := s.Store.messages[id]
		s.Store.mu.RUnlock()
		if existing.Fingerprint != fp {
			return Message{}, ErrIdempotencyConflict
		}
		return existing, nil
	}
	s.Store.mu.RUnlock()

	ref, digest, err := s.Blobs.PutPrivate(ctx, req.Recipient, []byte(req.Body))
	if err != nil {
		return Message{}, fmt.Errorf("private body storage: %w", err)
	}
	if ref == "" || digest == "" {
		return Message{}, errors.New("mail: storage returned incomplete body evidence")
	}
	now := s.Now().UTC()
	id := deterministicMessageID(req.Sender, req.Recipient, req.IdempotencyKey)
	msg := Message{ID: id, Sender: req.Sender, Recipient: req.Recipient, Subject: req.Subject, BodyRef: ref, BodyDigest: digest, ConversationID: strings.TrimSpace(req.ConversationID), CreatedAt: now, UpdatedAt: now, Status: "DELIVERED", Visibility: "PRIVATE", Source: req.Source, Version: 1, Fingerprint: fp, IdempotencyKey: req.IdempotencyKey}

	s.Store.mu.Lock()
	if existingID, ok := s.Store.byIdem[idemKey]; ok {
		existing := s.Store.messages[existingID]
		s.Store.mu.Unlock()
		if existing.Fingerprint != fp {
			return Message{}, ErrIdempotencyConflict
		}
		return existing, nil
	}
	s.Store.messages[id] = msg
	s.Store.byIdem[idemKey] = id
	s.Store.mu.Unlock()
	if s.Notify != nil {
		_ = s.Notify.NotifyMail(ctx, Notification{MessageID: id, Recipient: req.Recipient, Sender: req.Sender, Source: req.Source})
	}
	return msg, nil
}

func (s *Service) Inbox(ctx context.Context, actor, cursor string, limit int) (Page, error) {
	_ = ctx
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return Page{}, ErrUnauthorized
	}
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	offset, err := decodeCursor(cursor)
	if err != nil {
		return Page{}, ErrInvalidInput
	}
	s.Store.mu.RLock()
	items := make([]Message, 0)
	for _, m := range s.Store.messages {
		if m.Recipient == actor {
			items = append(items, m)
		}
	}
	s.Store.mu.RUnlock()
	sort.Slice(items, func(i, j int) bool {
		if items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].ID < items[j].ID
		}
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})
	if offset >= len(items) {
		return Page{Items: []Message{}}, nil
	}
	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	page := Page{Items: append([]Message(nil), items[offset:end]...)}
	if end < len(items) {
		page.NextCursor = encodeCursor(end)
	}
	return page, nil
}

func (s *Service) ReadBody(ctx context.Context, actor, id string) ([]byte, Message, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return nil, Message{}, ErrUnauthorized
	}
	s.Store.mu.RLock()
	msg, ok := s.Store.messages[id]
	s.Store.mu.RUnlock()
	if !ok {
		return nil, Message{}, ErrNotFound
	}
	if msg.Recipient != actor && msg.Sender != actor {
		return nil, Message{}, ErrUnauthorized
	}
	body, err := s.Blobs.GetPrivate(ctx, actor, msg.BodyRef)
	if err != nil {
		return nil, Message{}, err
	}
	return body, msg, nil
}

func (s *Service) MarkRead(ctx context.Context, actor, id string) (Message, error) {
	_ = ctx
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return Message{}, ErrUnauthorized
	}
	s.Store.mu.Lock()
	defer s.Store.mu.Unlock()
	msg, ok := s.Store.messages[id]
	if !ok {
		return Message{}, ErrNotFound
	}
	if msg.Recipient != actor {
		return Message{}, ErrUnauthorized
	}
	if msg.ReadAt == nil {
		now := s.Now().UTC()
		msg.ReadAt = &now
		msg.UpdatedAt = now
		s.Store.messages[id] = msg
	}
	return msg, nil
}

func deterministicMessageID(sender, recipient, idem string) string {
	sum := sha256.Sum256([]byte("420/MAIL/MESSAGE/V1\x00" + sender + "\x00" + recipient + "\x00" + idem))
	return "mail_" + hex.EncodeToString(sum[:16])
}

func requestFingerprint(req SendRequest) string {
	sum := sha256.Sum256([]byte(req.Sender + "\x00" + req.Recipient + "\x00" + req.Subject + "\x00" + req.Body + "\x00" + req.ConversationID + "\x00" + req.Source))
	return hex.EncodeToString(sum[:])
}

func encodeCursor(offset int) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(offset)))
}

func decodeCursor(cursor string) (int, error) {
	if cursor == "" {
		return 0, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return 0, err
	}
	n, err := strconv.Atoi(string(raw))
	if err != nil || n < 0 {
		return 0, ErrInvalidInput
	}
	return n, nil
}
