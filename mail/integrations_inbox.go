package mail

import (
	"context"
	"sort"
	"strings"
)

type IntegrationsInboxPage struct {
	Items      []MailboxItem `json:"items"`
	NextCursor string        `json:"next_cursor,omitempty"`
}

type IntegrationInboxFilter struct {
	Source string `json:"source,omitempty"`
}

func (s *Service) IntegrationsInbox(ctx context.Context, actor, cursor string, limit int) (IntegrationsInboxPage, error) {
	return s.IntegrationsInboxFiltered(ctx, actor, IntegrationInboxFilter{}, cursor, limit)
}

func (s *Service) IntegrationsInboxFiltered(ctx context.Context, actor string, filter IntegrationInboxFilter, cursor string, limit int) (IntegrationsInboxPage, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return IntegrationsInboxPage{}, ErrUnauthorized
	}
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	filter, err := normalizeIntegrationInboxFilter(filter)
	if err != nil {
		return IntegrationsInboxPage{}, err
	}
	offset, err := decodeCursor(cursor)
	if err != nil {
		return IntegrationsInboxPage{}, ErrInvalidInput
	}

	items := make([]MailboxItem, 0)
	if err := s.Store.View(ctx, func(data *storeData) error {
		keys := data.MailboxIndex[mailboxIndexKey(actor, FolderInbox)]
		for _, key := range keys {
			state, ok := data.Mailbox[key]
			if !ok || state.DeletedAt != nil || state.Folder != FolderInbox {
				continue
			}
			msg, ok := data.Messages[state.MessageID]
			if !ok || !isIntegrationInboxSource(msg.Source) {
				continue
			}
			if filter.Source != "" && !strings.EqualFold(msg.Source, filter.Source) {
				continue
			}
			items = append(items, MailboxItem{Message: msg, State: state})
		}
		return nil
	}); err != nil {
		return IntegrationsInboxPage{}, err
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].Message.CreatedAt.Equal(items[j].Message.CreatedAt) {
			return items[i].Message.ID < items[j].Message.ID
		}
		return items[i].Message.CreatedAt.After(items[j].Message.CreatedAt)
	})
	if offset >= len(items) {
		return IntegrationsInboxPage{Items: []MailboxItem{}}, nil
	}
	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	page := IntegrationsInboxPage{Items: append([]MailboxItem(nil), items[offset:end]...)}
	if end < len(items) {
		page.NextCursor = encodeCursor(end)
	}
	return page, nil
}

func isIntegrationInboxSource(source string) bool {
	switch strings.ToLower(strings.TrimSpace(source)) {
	case DiscordProvider, TelegramProvider:
		return true
	default:
		return false
	}
}

func normalizeIntegrationInboxFilter(filter IntegrationInboxFilter) (IntegrationInboxFilter, error) {
	filter.Source = strings.ToLower(strings.TrimSpace(filter.Source))
	if filter.Source != "" && !isIntegrationInboxSource(filter.Source) {
		return IntegrationInboxFilter{}, ErrInvalidInput
	}
	return filter, nil
}
