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
	"time"
)

const (
	ServiceID       = "420/service/mail/v1"
	MaxSubjectBytes = 200
	MaxBodyBytes    = 1 << 20
	DefaultPageSize = 50
	MaxPageSize     = 100
)

type MailboxFolder string

const (
	FolderInbox   MailboxFolder = "INBOX"
	FolderSent    MailboxFolder = "SENT"
	FolderOutbox  MailboxFolder = "OUTBOX"
	FolderDrafts  MailboxFolder = "DRAFTS"
	FolderArchive MailboxFolder = "ARCHIVE"
	FolderJunk    MailboxFolder = "JUNK"
	FolderTrash   MailboxFolder = "TRASH"
)

var (
	ErrUnauthorized         = errors.New("mail: unauthorized")
	ErrInvalidInput         = errors.New("mail: invalid input")
	ErrInvalidTransition    = errors.New("mail: invalid mailbox transition")
	ErrNotFound             = errors.New("mail: message not found")
	ErrIdempotencyConflict  = errors.New("mail: idempotency key reused with different request")
	ErrPrivateBlobIntegrity = errors.New("mail: private blob integrity failure")
	ErrPrivateBlobSecurity  = errors.New("mail: private blob security requirements unsatisfied")
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

type PrivateBlobSecurityProfile struct {
	EncryptedAtRest   bool
	ExternalKeyCustody bool
	OwnerScopedAccess bool
}

type PrivateBlobSecurityProvider interface {
	PrivateBlobSecurity() PrivateBlobSecurityProfile
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
	ReplyTo        string     `json:"reply_to,omitempty"`
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

type MailboxState struct {
	MessageID      string        `json:"message_id"`
	Owner          string        `json:"owner"`
	Folder         MailboxFolder `json:"folder"`
	PreviousFolder MailboxFolder `json:"previous_folder,omitempty"`
	LabelIDs       []string      `json:"label_ids,omitempty"`
	CustomFolderID string        `json:"custom_folder_id,omitempty"`
	ReadAt         *time.Time    `json:"read_at,omitempty"`
	Starred        bool          `json:"starred"`
	Pinned         bool          `json:"pinned"`
	Muted          bool          `json:"muted"`
	ArchivedAt     *time.Time    `json:"archived_at,omitempty"`
	JunkedAt       *time.Time    `json:"junked_at,omitempty"`
	TrashedAt      *time.Time    `json:"trashed_at,omitempty"`
	DeletedAt      *time.Time    `json:"deleted_at,omitempty"`
	UpdatedAt      time.Time     `json:"updated_at"`
	Version        uint32        `json:"version"`
}

type MailboxItem struct {
	Message Message      `json:"message"`
	State   MailboxState `json:"state"`
}

type SendRequest struct {
	IdempotencyKey string `json:"idempotency_key"`
	Sender         string `json:"sender"`
	Recipient      string `json:"recipient"`
	Subject        string `json:"subject"`
	Body           string `json:"body"`
	ConversationID string `json:"conversation_id,omitempty"`
	ReplyTo        string `json:"reply_to,omitempty"`
	Source         string `json:"source"`
}

type MailboxUpdate struct {
	Folder  *MailboxFolder `json:"folder,omitempty"`
	Read    *bool          `json:"read,omitempty"`
	Starred *bool          `json:"starred,omitempty"`
	Pinned  *bool          `json:"pinned,omitempty"`
	Muted   *bool          `json:"muted,omitempty"`
}

type Page struct {
	Items      []Message `json:"items"`
	NextCursor string    `json:"next_cursor,omitempty"`
}

type MailboxPage struct {
	Items      []MailboxItem `json:"items"`
	NextCursor string        `json:"next_cursor,omitempty"`
}

type Service struct {
	Identities IdentityDirectory
	Messenger  MessengerPolicy
	Blobs      PrivateBlobStore
	Notify     NotificationSink
	Store      MailStore
	Now        func() time.Time
}

func NewService(ids IdentityDirectory, messenger MessengerPolicy, blobs PrivateBlobStore, notify NotificationSink, store MailStore) *Service {
	return &Service{Identities: ids, Messenger: messenger, Blobs: blobs, Notify: notify, Store: store, Now: func() time.Time { return time.Now().UTC() }}
}

func NewServiceWithStore(ids IdentityDirectory, messenger MessengerPolicy, blobs PrivateBlobStore, notify NotificationSink, store MailStore) *Service {
	return NewService(ids, messenger, blobs, notify, store)
}

func NewDurableService(ids IdentityDirectory, messenger MessengerPolicy, blobs PrivateBlobStore, notify NotificationSink, path string) (*Service, error) {
	if err := validatePrivateBlobSecurity(blobs); err != nil {
		return nil, err
	}
	store, err := OpenDurableStore(path)
	if err != nil {
		return nil, err
	}
	return NewService(ids, messenger, blobs, notify, store), nil
}

func validatePrivateBlobSecurity(blobs PrivateBlobStore) error {
	security, ok := blobs.(PrivateBlobSecurityProvider)
	if !ok {
		return ErrPrivateBlobSecurity
	}
	profile := security.PrivateBlobSecurity()
	if !profile.EncryptedAtRest || !profile.ExternalKeyCustody || !profile.OwnerScopedAccess {
		return ErrPrivateBlobSecurity
	}
	return nil
}

func privateBodyDigest(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

func putPrivateVerified(ctx context.Context, blobs PrivateBlobStore, owner string, body []byte) (string, string, error) {
	ref, digest, err := blobs.PutPrivate(ctx, owner, body)
	if err != nil {
		return "", "", err
	}
	ref = strings.TrimSpace(ref)
	digest = strings.ToLower(strings.TrimSpace(digest))
	if ref == "" || digest == "" || digest != privateBodyDigest(body) {
		return "", "", ErrPrivateBlobIntegrity
	}
	return ref, digest, nil
}

func getPrivateVerified(ctx context.Context, blobs PrivateBlobStore, owner, ref, expectedDigest string) ([]byte, error) {
	body, err := blobs.GetPrivate(ctx, owner, ref)
	if err != nil {
		return nil, err
	}
	if strings.ToLower(strings.TrimSpace(expectedDigest)) != privateBodyDigest(body) {
		return nil, ErrPrivateBlobIntegrity
	}
	return body, nil
}

func (s *Service) Send(ctx context.Context, actor string, req SendRequest) (Message, error) {
	actor = strings.TrimSpace(actor)
	req.Sender = strings.TrimSpace(req.Sender)
	req.Recipient = strings.TrimSpace(req.Recipient)
	req.Subject = strings.TrimSpace(req.Subject)
	req.Source = strings.TrimSpace(req.Source)
	req.IdempotencyKey = strings.TrimSpace(req.IdempotencyKey)
	req.ConversationID = strings.TrimSpace(req.ConversationID)
	req.ReplyTo = strings.TrimSpace(req.ReplyTo)
	if actor == "" || req.Sender == "" || req.Recipient == "" || actor != req.Sender {
		return Message{}, ErrUnauthorized
	}
	if req.IdempotencyKey == "" || req.Subject == "" || req.Body == "" || req.Source != ServiceID || len([]byte(req.Subject)) > MaxSubjectBytes || len([]byte(req.Body)) > MaxBodyBytes {
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
	var existing Message
	var found bool
	if err := s.Store.View(ctx, func(data *storeData) error {
		if id, ok := data.ByIdem[idemKey]; ok {
			existing = data.Messages[id]
			found = true
		}
		return nil
	}); err != nil {
		return Message{}, fmt.Errorf("mail: read metadata store: %w", err)
	}
	if found {
		if existing.Fingerprint != fp {
			return Message{}, ErrIdempotencyConflict
		}
		return existing, nil
	}

	id := deterministicMessageID(req.Sender, req.Recipient, req.IdempotencyKey)
	var conversationID string
	if err := s.Store.View(ctx, func(data *storeData) error {
		var err error
		conversationID, err = resolveConversation(data, actor, req, id)
		if err != nil {
			return err
		}
		preview := Message{ID: id, Sender: req.Sender, Recipient: req.Recipient, Subject: req.Subject, ConversationID: conversationID, ReplyTo: req.ReplyTo, Source: req.Source}
		_, err = evaluateTrustPolicy(data, req.Recipient, preview, req.Body)
		return err
	}); err != nil {
		return Message{}, err
	}

	ref, digest, err := putPrivateVerified(ctx, s.Blobs, req.Recipient, []byte(req.Body))
	if err != nil {
		return Message{}, fmt.Errorf("private body storage: %w", err)
	}
	if ref == "" || digest == "" {
		return Message{}, errors.New("mail: storage returned incomplete body evidence")
	}
	now := s.Now().UTC()
	msg := Message{ID: id, Sender: req.Sender, Recipient: req.Recipient, Subject: req.Subject, BodyRef: ref, BodyDigest: digest, ConversationID: conversationID, ReplyTo: req.ReplyTo, CreatedAt: now, UpdatedAt: now, Status: "DELIVERED", Visibility: "PRIVATE", Source: req.Source, Version: 1, Fingerprint: fp, IdempotencyKey: req.IdempotencyKey}
	senderReadAt := now
	senderState := MailboxState{MessageID: id, Owner: req.Sender, Folder: FolderSent, ReadAt: &senderReadAt, UpdatedAt: now, Version: 1}
	recipientState := MailboxState{MessageID: id, Owner: req.Recipient, Folder: FolderInbox, UpdatedAt: now, Version: 1}

	result := msg
	created := false
	recipientMuted := false
	if err := s.Store.Update(ctx, func(data *storeData) error {
		if existingID, ok := data.ByIdem[idemKey]; ok {
			existing := data.Messages[existingID]
			if existing.Fingerprint != fp {
				return ErrIdempotencyConflict
			}
			result = existing
			return nil
		}
		resolvedConversationID, err := resolveConversation(data, actor, req, id)
		if err != nil {
			return err
		}
		if resolvedConversationID != msg.ConversationID {
			return ErrInvalidInput
		}
		decision, err := evaluateTrustPolicy(data, req.Recipient, msg, req.Body)
		if err != nil {
			return err
		}
		protection := evaluateSpamProtection(data, req.Recipient, msg, req.Body, decision)
		if err := applyIncomingRules(data, req.Recipient, msg, req.Body, &recipientState, now); err != nil {
			return err
		}
		threadState := data.ConversationStates[conversationStateKey(req.Recipient, msg.ConversationID)]
		if threadState.Archived && recipientState.Folder == FolderInbox {
			recipientState.PreviousFolder = FolderInbox
			recipientState.Folder = FolderArchive
			t := now
			recipientState.ArchivedAt = &t
		}
		if threadState.Muted {
			recipientState.Muted = true
			recipientMuted = true
		}
		if protection.Quarantine {
			if recipientState.Folder != FolderJunk {
				recipientState.PreviousFolder = recipientState.Folder
			}
			recipientState.Folder = FolderJunk
			t := now
			recipientState.JunkedAt = &t
			recipientState.Muted = true
			recipientMuted = true
		}
		if decision.Muted {
			recipientState.Muted = true
			recipientMuted = true
		}
		data.Messages[id] = msg
		data.ByIdem[idemKey] = id
		data.Mailbox[mailboxKey(req.Sender, id)] = senderState
		data.Mailbox[mailboxKey(req.Recipient, id)] = recipientState
		recordDeliveryProtection(data, req.Recipient, msg, req.Body, protection, now)
		result = msg
		created = true
		return nil
	}); err != nil {
		return Message{}, err
	}
	if created && !recipientMuted && s.Notify != nil {
		_ = s.Notify.NotifyMail(ctx, Notification{MessageID: id, Recipient: req.Recipient, Sender: req.Sender, Source: req.Source})
	}
	return result, nil
}

func (s *Service) Inbox(ctx context.Context, actor, cursor string, limit int) (Page, error) {
	page, err := s.Mailbox(ctx, actor, FolderInbox, cursor, limit)
	if err != nil {
		return Page{}, err
	}
	items := make([]Message, 0, len(page.Items))
	for _, item := range page.Items {
		items = append(items, item.Message)
	}
	return Page{Items: items, NextCursor: page.NextCursor}, nil
}

func (s *Service) Mailbox(ctx context.Context, actor string, folder MailboxFolder, cursor string, limit int) (MailboxPage, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return MailboxPage{}, ErrUnauthorized
	}
	if !isMailboxFolder(folder) {
		return MailboxPage{}, ErrInvalidInput
	}
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	offset, err := decodeCursor(cursor)
	if err != nil {
		return MailboxPage{}, ErrInvalidInput
	}
	items := make([]MailboxItem, 0)
	if err := s.Store.View(ctx, func(data *storeData) error {
		keys := data.MailboxIndex[mailboxIndexKey(actor, folder)]
		for _, key := range keys {
			state, ok := data.Mailbox[key]
			if !ok || state.DeletedAt != nil {
				continue
			}
			msg, ok := data.Messages[state.MessageID]
			if !ok {
				continue
			}
			items = append(items, MailboxItem{Message: msg, State: state})
		}
		return nil
	}); err != nil {
		return MailboxPage{}, err
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Message.CreatedAt.Equal(items[j].Message.CreatedAt) {
			return items[i].Message.ID < items[j].Message.ID
		}
		return items[i].Message.CreatedAt.After(items[j].Message.CreatedAt)
	})
	if offset >= len(items) {
		return MailboxPage{Items: []MailboxItem{}}, nil
	}
	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	page := MailboxPage{Items: append([]MailboxItem(nil), items[offset:end]...)}
	if end < len(items) {
		page.NextCursor = encodeCursor(end)
	}
	return page, nil
}

func (s *Service) GetMailboxState(ctx context.Context, actor, id string) (MailboxState, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return MailboxState{}, ErrUnauthorized
	}
	var state MailboxState
	var ok bool
	if err := s.Store.View(ctx, func(data *storeData) error {
		state, ok = data.Mailbox[mailboxKey(actor, id)]
		return nil
	}); err != nil {
		return MailboxState{}, err
	}
	if !ok || state.DeletedAt != nil {
		return MailboxState{}, ErrNotFound
	}
	return state, nil
}

func (s *Service) UpdateMailbox(ctx context.Context, actor, id string, update MailboxUpdate) (MailboxState, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return MailboxState{}, ErrUnauthorized
	}
	var result MailboxState
	if err := s.Store.Update(ctx, func(data *storeData) error {
		key := mailboxKey(actor, id)
		state, ok := data.Mailbox[key]
		if !ok || state.DeletedAt != nil {
			return ErrNotFound
		}
		msg, ok := data.Messages[id]
		if !ok {
			return ErrNotFound
		}
		now := s.Now().UTC()
		if update.Folder != nil {
			target := *update.Folder
			if quarantine, ok := data.Quarantine[quarantineKey(actor, id)]; ok && quarantine.Status == QuarantineActive && target != FolderJunk && target != FolderTrash {
				return ErrQuarantineReview
			}
			if state.Folder == FolderTrash && target != FolderTrash {
				return ErrInvalidTransition
			}
			if !canMoveMailbox(actor, msg, state.Folder, target) {
				return ErrInvalidTransition
			}
			if target != state.Folder {
				state.PreviousFolder = state.Folder
				state.Folder = target
				switch target {
				case FolderArchive:
					t := now
					state.ArchivedAt = &t
				case FolderJunk:
					t := now
					state.JunkedAt = &t
				case FolderTrash:
					t := now
					state.TrashedAt = &t
				}
			}
		}
		if update.Read != nil {
			if actor != msg.Recipient {
				return ErrUnauthorized
			}
			if *update.Read {
				if state.ReadAt == nil {
					t := now
					state.ReadAt = &t
				}
				if msg.ReadAt == nil {
					t := now
					msg.ReadAt = &t
					msg.UpdatedAt = now
					msg.Version++
					data.Messages[id] = msg
				}
			} else {
				state.ReadAt = nil
			}
		}
		if update.Starred != nil {
			state.Starred = *update.Starred
		}
		if update.Pinned != nil {
			state.Pinned = *update.Pinned
		}
		if update.Muted != nil {
			state.Muted = *update.Muted
		}
		state.UpdatedAt = now
		state.Version++
		data.Mailbox[key] = state
		result = state
		return nil
	}); err != nil {
		return MailboxState{}, err
	}
	return result, nil
}

func (s *Service) RestoreFromTrash(ctx context.Context, actor, id string) (MailboxState, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return MailboxState{}, ErrUnauthorized
	}
	var result MailboxState
	if err := s.Store.Update(ctx, func(data *storeData) error {
		key := mailboxKey(actor, id)
		state, ok := data.Mailbox[key]
		if !ok || state.DeletedAt != nil {
			return ErrNotFound
		}
		msg, ok := data.Messages[id]
		if !ok {
			return ErrNotFound
		}
		if state.Folder != FolderTrash {
			return ErrInvalidTransition
		}
		target := state.PreviousFolder
		if target == "" || target == FolderTrash || target == FolderDrafts || target == FolderOutbox || !canMoveMailbox(actor, msg, FolderTrash, target) {
			if actor == msg.Recipient {
				target = FolderInbox
			} else if actor == msg.Sender {
				target = FolderSent
			} else {
				return ErrUnauthorized
			}
		}
		now := s.Now().UTC()
		state.Folder = target
		state.PreviousFolder = FolderTrash
		state.UpdatedAt = now
		state.Version++
		data.Mailbox[key] = state
		result = state
		return nil
	}); err != nil {
		return MailboxState{}, err
	}
	return result, nil
}

func (s *Service) PermanentlyDelete(ctx context.Context, actor, id string) error {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return ErrUnauthorized
	}
	return s.Store.Update(ctx, func(data *storeData) error {
		key := mailboxKey(actor, id)
		state, ok := data.Mailbox[key]
		if !ok || state.DeletedAt != nil {
			return ErrNotFound
		}
		if state.Folder != FolderTrash {
			return ErrInvalidTransition
		}
		now := s.Now().UTC()
		state.DeletedAt = &now
		state.UpdatedAt = now
		state.Version++
		data.Mailbox[key] = state
		return nil
	})
}

func (s *Service) ReadBody(ctx context.Context, actor, id string) ([]byte, Message, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return nil, Message{}, ErrUnauthorized
	}
	var msg Message
	var msgOK bool
	var state MailboxState
	var owns bool
	if err := s.Store.View(ctx, func(data *storeData) error {
		msg, msgOK = data.Messages[id]
		state, owns = data.Mailbox[mailboxKey(actor, id)]
		return nil
	}); err != nil {
		return nil, Message{}, err
	}
	if !msgOK {
		return nil, Message{}, ErrNotFound
	}
	if msg.Recipient != actor && msg.Sender != actor {
		return nil, Message{}, ErrUnauthorized
	}
	if !owns || state.DeletedAt != nil {
		return nil, Message{}, ErrNotFound
	}
	body, err := getPrivateVerified(ctx, s.Blobs, actor, msg.BodyRef, msg.BodyDigest)
	if err != nil {
		return nil, Message{}, err
	}
	return body, msg, nil
}

func (s *Service) MarkRead(ctx context.Context, actor, id string) (Message, error) {
	read := true
	if _, err := s.UpdateMailbox(ctx, actor, id, MailboxUpdate{Read: &read}); err != nil {
		return Message{}, err
	}
	var msg Message
	var ok bool
	if err := s.Store.View(ctx, func(data *storeData) error {
		msg, ok = data.Messages[id]
		return nil
	}); err != nil {
		return Message{}, err
	}
	if !ok {
		return Message{}, ErrNotFound
	}
	return msg, nil
}

func (s *Service) MarkUnread(ctx context.Context, actor, id string) (MailboxState, error) {
	read := false
	return s.UpdateMailbox(ctx, actor, id, MailboxUpdate{Read: &read})
}

func mailboxKey(owner, id string) string {
	return owner + "\x00" + id
}

func isMailboxFolder(folder MailboxFolder) bool {
	switch folder {
	case FolderInbox, FolderSent, FolderOutbox, FolderDrafts, FolderArchive, FolderJunk, FolderTrash:
		return true
	default:
		return false
	}
}

func canMoveMailbox(actor string, msg Message, from, to MailboxFolder) bool {
	if !isMailboxFolder(to) || to == FolderDrafts || to == FolderOutbox || from == FolderDrafts || from == FolderOutbox {
		return false
	}
	if from == FolderTrash {
		if actor == msg.Recipient {
			return to == FolderInbox || to == FolderArchive || to == FolderJunk
		}
		if actor == msg.Sender {
			return to == FolderSent || to == FolderArchive
		}
		return false
	}
	if actor == msg.Recipient {
		switch from {
		case FolderInbox:
			return to == FolderInbox || to == FolderArchive || to == FolderJunk || to == FolderTrash
		case FolderArchive:
			return to == FolderArchive || to == FolderInbox || to == FolderJunk || to == FolderTrash
		case FolderJunk:
			return to == FolderJunk || to == FolderInbox || to == FolderArchive || to == FolderTrash
		}
	}
	if actor == msg.Sender {
		switch from {
		case FolderSent:
			return to == FolderSent || to == FolderArchive || to == FolderTrash
		case FolderArchive:
			return to == FolderArchive || to == FolderSent || to == FolderTrash
		}
	}
	return false
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
