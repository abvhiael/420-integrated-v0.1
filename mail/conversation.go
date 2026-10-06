package mail

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strings"
	"time"
)

const MaxConversationMessages = 1000

type ConversationState struct {
	Owner          string    `json:"owner"`
	ConversationID string    `json:"conversation_id"`
	Archived       bool      `json:"archived"`
	Muted          bool      `json:"muted"`
	UpdatedAt      time.Time `json:"updated_at"`
	Version        uint32    `json:"version"`
}

type ConversationSummary struct {
	ID           string            `json:"id"`
	Participants []string          `json:"participants"`
	MessageCount int               `json:"message_count"`
	LatestAt     time.Time         `json:"latest_at"`
	State        ConversationState `json:"state"`
}

type ConversationView struct {
	ConversationSummary
	Items []MailboxItem `json:"items"`
}

type ConversationUpdate struct {
	Archived *bool `json:"archived,omitempty"`
	Muted    *bool `json:"muted,omitempty"`
}

type ReplyRequest struct {
	IdempotencyKey string `json:"idempotency_key"`
	Subject        string `json:"subject"`
	Body           string `json:"body"`
	Source         string `json:"source"`
}

func (s *Service) Reply(ctx context.Context, actor, parentMessageID string, req ReplyRequest) (Message, error) {
	actor = strings.TrimSpace(actor)
	parentMessageID = strings.TrimSpace(parentMessageID)
	if actor == "" {
		return Message{}, ErrUnauthorized
	}
	if parentMessageID == "" {
		return Message{}, ErrInvalidInput
	}

	var parent Message
	var owned bool
	if err := s.Store.View(ctx, func(data *storeData) error {
		parent, owned = data.Messages[parentMessageID]
		if !owned {
			return nil
		}
		state, ok := data.Mailbox[mailboxKey(actor, parentMessageID)]
		owned = ok && state.DeletedAt == nil && (parent.Sender == actor || parent.Recipient == actor)
		return nil
	}); err != nil {
		return Message{}, err
	}
	if !owned {
		return Message{}, ErrNotFound
	}

	recipient := parent.Sender
	if recipient == actor {
		recipient = parent.Recipient
	}
	if recipient == actor || recipient == "" {
		return Message{}, ErrInvalidInput
	}

	return s.Send(ctx, actor, SendRequest{
		IdempotencyKey: strings.TrimSpace(req.IdempotencyKey),
		Sender:         actor,
		Recipient:      recipient,
		Subject:        req.Subject,
		Body:           req.Body,
		ReplyTo:        parentMessageID,
		ConversationID: parent.ConversationID,
		Source:         req.Source,
	})
}

func (s *Service) ListConversations(ctx context.Context, actor string) ([]ConversationSummary, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return nil, ErrUnauthorized
	}
	out := make([]ConversationSummary, 0)
	err := s.Store.View(ctx, func(data *storeData) error {
		prefix := actor + "\x00"
		for key, ids := range data.ConversationIndex {
			if !strings.HasPrefix(key, prefix) || len(ids) == 0 {
				continue
			}
			conversationID := strings.TrimPrefix(key, prefix)
			summary, ok := buildConversationSummary(data, actor, conversationID, ids)
			if ok {
				out = append(out, summary)
			}
		}
		return nil
	})
	sort.Slice(out, func(i, j int) bool {
		if out[i].LatestAt.Equal(out[j].LatestAt) {
			return out[i].ID < out[j].ID
		}
		return out[i].LatestAt.After(out[j].LatestAt)
	})
	return out, err
}

func (s *Service) GetConversation(ctx context.Context, actor, conversationID string) (ConversationView, error) {
	actor = strings.TrimSpace(actor)
	conversationID = strings.TrimSpace(conversationID)
	if actor == "" {
		return ConversationView{}, ErrUnauthorized
	}
	if conversationID == "" {
		return ConversationView{}, ErrInvalidInput
	}

	var out ConversationView
	found := false
	err := s.Store.View(ctx, func(data *storeData) error {
		ids := data.ConversationIndex[conversationIndexKey(actor, conversationID)]
		summary, ok := buildConversationSummary(data, actor, conversationID, ids)
		if !ok {
			return nil
		}
		items := make([]MailboxItem, 0, len(ids))
		for _, id := range ids {
			state, ok := data.Mailbox[mailboxKey(actor, id)]
			if !ok || state.DeletedAt != nil {
				continue
			}
			msg, ok := data.Messages[id]
			if !ok || msg.ConversationID != conversationID {
				continue
			}
			items = append(items, MailboxItem{Message: msg, State: state})
		}
		sort.Slice(items, func(i, j int) bool {
			if items[i].Message.CreatedAt.Equal(items[j].Message.CreatedAt) {
				return items[i].Message.ID < items[j].Message.ID
			}
			return items[i].Message.CreatedAt.Before(items[j].Message.CreatedAt)
		})
		out = ConversationView{ConversationSummary: summary, Items: items}
		found = true
		return nil
	})
	if err != nil {
		return ConversationView{}, err
	}
	if !found {
		return ConversationView{}, ErrNotFound
	}
	return out, nil
}

func (s *Service) UpdateConversation(ctx context.Context, actor, conversationID string, update ConversationUpdate) (ConversationState, error) {
	actor = strings.TrimSpace(actor)
	conversationID = strings.TrimSpace(conversationID)
	if actor == "" {
		return ConversationState{}, ErrUnauthorized
	}
	if conversationID == "" || (update.Archived == nil && update.Muted == nil) {
		return ConversationState{}, ErrInvalidInput
	}

	var out ConversationState
	err := s.Store.Update(ctx, func(data *storeData) error {
		ids := data.ConversationIndex[conversationIndexKey(actor, conversationID)]
		if len(ids) == 0 {
			return ErrNotFound
		}
		now := s.Now().UTC()
		key := conversationStateKey(actor, conversationID)
		state := data.ConversationStates[key]
		state.Owner = actor
		state.ConversationID = conversationID
		if update.Archived != nil {
			state.Archived = *update.Archived
			for _, id := range ids {
				mailKey := mailboxKey(actor, id)
				box, ok := data.Mailbox[mailKey]
				if !ok || box.DeletedAt != nil {
					continue
				}
				msg, ok := data.Messages[id]
				if !ok || msg.Recipient != actor {
					continue
				}
				if *update.Archived && box.Folder == FolderInbox {
					box.PreviousFolder = FolderInbox
					box.Folder = FolderArchive
					t := now
					box.ArchivedAt = &t
					box.UpdatedAt = now
					box.Version++
					data.Mailbox[mailKey] = box
				}
				if !*update.Archived && box.Folder == FolderArchive && box.PreviousFolder == FolderInbox {
					box.PreviousFolder = FolderArchive
					box.Folder = FolderInbox
					box.UpdatedAt = now
					box.Version++
					data.Mailbox[mailKey] = box
				}
			}
		}
		if update.Muted != nil {
			state.Muted = *update.Muted
		}
		state.UpdatedAt = now
		state.Version++
		data.ConversationStates[key] = state
		out = state
		return nil
	})
	return out, err
}

func resolveConversation(data *storeData, actor string, req SendRequest, messageID string) (string, error) {
	replyTo := strings.TrimSpace(req.ReplyTo)
	requested := strings.TrimSpace(req.ConversationID)
	if replyTo == "" {
		if requested != "" {
			return "", ErrInvalidInput
		}
		return deterministicConversationID(messageID), nil
	}

	parent, ok := data.Messages[replyTo]
	if !ok || parent.ConversationID == "" {
		return "", ErrNotFound
	}
	state, ok := data.Mailbox[mailboxKey(actor, replyTo)]
	if !ok || state.DeletedAt != nil || (parent.Sender != actor && parent.Recipient != actor) {
		return "", ErrNotFound
	}
	other := parent.Sender
	if other == actor {
		other = parent.Recipient
	}
	if req.Recipient != other {
		return "", ErrInvalidInput
	}
	if requested != "" && requested != parent.ConversationID {
		return "", ErrInvalidInput
	}
	if len(data.ConversationIndex[conversationIndexKey(actor, parent.ConversationID)]) >= MaxConversationMessages {
		return "", ErrInvalidInput
	}
	return parent.ConversationID, nil
}

func buildConversationSummary(data *storeData, actor, conversationID string, ids []string) (ConversationSummary, bool) {
	participants := map[string]struct{}{}
	latest := time.Time{}
	count := 0
	for _, id := range ids {
		state, ok := data.Mailbox[mailboxKey(actor, id)]
		if !ok || state.DeletedAt != nil {
			continue
		}
		msg, ok := data.Messages[id]
		if !ok || msg.ConversationID != conversationID {
			continue
		}
		participants[msg.Sender] = struct{}{}
		participants[msg.Recipient] = struct{}{}
		count++
		if msg.CreatedAt.After(latest) {
			latest = msg.CreatedAt
		}
	}
	if count == 0 {
		return ConversationSummary{}, false
	}
	names := make([]string, 0, len(participants))
	for participant := range participants {
		names = append(names, participant)
	}
	sort.Strings(names)
	state := data.ConversationStates[conversationStateKey(actor, conversationID)]
	if state.Owner == "" {
		state.Owner = actor
		state.ConversationID = conversationID
	}
	return ConversationSummary{
		ID: conversationID, Participants: names, MessageCount: count,
		LatestAt: latest, State: state,
	}, true
}

func deterministicConversationID(rootMessageID string) string {
	sum := sha256.Sum256([]byte("420/MAIL/CONVERSATION/V1\x00" + rootMessageID))
	return "conv_" + hex.EncodeToString(sum[:16])
}

func conversationIndexKey(owner, conversationID string) string {
	return owner + "\x00" + conversationID
}

func conversationStateKey(owner, conversationID string) string {
	return owner + "\x00" + conversationID
}

func validateConversationData(data *storeData) error {
	for key, state := range data.ConversationStates {
		if key != conversationStateKey(state.Owner, state.ConversationID) || state.Owner == "" || state.ConversationID == "" {
			return ErrInvalidInput
		}
	}
	for key, ids := range data.ConversationIndex {
		parts := strings.SplitN(key, "\x00", 2)
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" || len(ids) > MaxConversationMessages {
			return ErrInvalidInput
		}
		for _, id := range ids {
			msg, ok := data.Messages[id]
			if !ok || msg.ConversationID != parts[1] {
				return ErrInvalidInput
			}
			state, ok := data.Mailbox[mailboxKey(parts[0], id)]
			if !ok || state.DeletedAt != nil {
				return ErrInvalidInput
			}
		}
	}
	return nil
}
