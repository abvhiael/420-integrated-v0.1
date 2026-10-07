package mail

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"
)

const (
	MaxSearchQueryBytes = 256
	MaxSearchScanItems  = 500
)

type SearchRequest struct {
	Query          string         `json:"query,omitempty"`
	Folder         *MailboxFolder `json:"folder,omitempty"`
	LabelID        string         `json:"label_id,omitempty"`
	CustomFolderID string         `json:"custom_folder_id,omitempty"`
	Sender         string         `json:"sender,omitempty"`
	Recipient      string         `json:"recipient,omitempty"`
	Source         string         `json:"source,omitempty"`
	Unread         *bool          `json:"unread,omitempty"`
	Starred        *bool          `json:"starred,omitempty"`
	After          *time.Time     `json:"after,omitempty"`
	Before         *time.Time     `json:"before,omitempty"`
	Cursor         string         `json:"cursor,omitempty"`
	Limit          int            `json:"limit,omitempty"`
}

type SearchResult struct {
	Items      []MailboxItem `json:"items"`
	NextCursor string        `json:"next_cursor,omitempty"`
	Scanned    int           `json:"scanned"`
}

func (s *Service) SearchMailbox(ctx context.Context, actor string, req SearchRequest) (SearchResult, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return SearchResult{}, ErrUnauthorized
	}
	req.Query = strings.TrimSpace(req.Query)
	req.LabelID = strings.TrimSpace(req.LabelID)
	req.CustomFolderID = strings.TrimSpace(req.CustomFolderID)
	req.Sender = strings.TrimSpace(req.Sender)
	req.Recipient = strings.TrimSpace(req.Recipient)
	req.Source = strings.TrimSpace(req.Source)
	if len([]byte(req.Query)) > MaxSearchQueryBytes {
		return SearchResult{}, ErrInvalidInput
	}
	if req.Folder != nil && !isMailboxFolder(*req.Folder) {
		return SearchResult{}, ErrInvalidInput
	}
	if req.After != nil && req.Before != nil && !req.After.Before(*req.Before) {
		return SearchResult{}, ErrInvalidInput
	}
	if req.Limit <= 0 {
		req.Limit = DefaultPageSize
	}
	if req.Limit > MaxPageSize {
		req.Limit = MaxPageSize
	}
	offset, err := decodeCursor(req.Cursor)
	if err != nil {
		return SearchResult{}, ErrInvalidInput
	}

	var labelName string
	labelNames := map[string]string{}
	customFolderNames := map[string]string{}
	candidates := make([]MailboxItem, 0)
	if err := s.Store.View(ctx, func(data *storeData) error {
		for _, label := range data.Labels {
			if label.Owner == actor {
				labelNames[label.ID] = label.Name
			}
		}
		for _, folder := range data.CustomFolders {
			if folder.Owner == actor {
				customFolderNames[folder.ID] = folder.Name
			}
		}
		if req.LabelID != "" {
			label, ok := data.Labels[organizationKey(actor, req.LabelID)]
			if !ok {
				return ErrNotFound
			}
			labelName = label.Name
		}
		if req.CustomFolderID != "" {
			_, ok := data.CustomFolders[organizationKey(actor, req.CustomFolderID)]
			if !ok {
				return ErrNotFound
			}
		}
		for _, state := range data.Mailbox {
			if state.Owner != actor || state.DeletedAt != nil {
				continue
			}
			msg, ok := data.Messages[state.MessageID]
			if !ok {
				continue
			}
			if req.Folder != nil && state.Folder != *req.Folder {
				continue
			}
			if req.LabelID != "" && !containsString(state.LabelIDs, req.LabelID) && !matchesSystemLabel(state, labelName) {
				continue
			}
			if req.CustomFolderID != "" && state.CustomFolderID != req.CustomFolderID {
				continue
			}
			if req.Sender != "" && !strings.EqualFold(msg.Sender, req.Sender) {
				continue
			}
			if req.Recipient != "" && !strings.EqualFold(msg.Recipient, req.Recipient) {
				continue
			}
			if req.Source != "" && !strings.EqualFold(msg.Source, req.Source) {
				continue
			}
			if req.Unread != nil && (state.ReadAt == nil) != *req.Unread {
				continue
			}
			if req.Starred != nil && state.Starred != *req.Starred {
				continue
			}
			if req.After != nil && msg.CreatedAt.Before(req.After.UTC()) {
				continue
			}
			if req.Before != nil && !msg.CreatedAt.Before(req.Before.UTC()) {
				continue
			}
			candidates = append(candidates, MailboxItem{Message: msg, State: state})
		}
		return nil
	}); err != nil {
		return SearchResult{}, err
	}

	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].Message.CreatedAt.Equal(candidates[j].Message.CreatedAt) {
			return candidates[i].Message.ID < candidates[j].Message.ID
		}
		return candidates[i].Message.CreatedAt.After(candidates[j].Message.CreatedAt)
	})

	if offset >= len(candidates) {
		return SearchResult{Items: []MailboxItem{}}, nil
	}

	query := strings.ToLower(req.Query)
	results := make([]MailboxItem, 0, req.Limit)
	scanned := 0
	nextOffset := offset
	for nextOffset < len(candidates) && scanned < MaxSearchScanItems && len(results) < req.Limit {
		item := candidates[nextOffset]
		nextOffset++
		scanned++

		matched := query == ""
		if !matched {
			metaParts := []string{
				item.Message.Sender,
				item.Message.Recipient,
				item.Message.Subject,
				item.Message.Source,
				string(item.State.Folder),
			}
			for _, labelID := range item.State.LabelIDs {
				metaParts = append(metaParts, labelNames[labelID])
			}
			if item.State.CustomFolderID != "" {
				metaParts = append(metaParts, customFolderNames[item.State.CustomFolderID])
			}
			matched = strings.Contains(strings.ToLower(strings.Join(metaParts, "\n")), query)
		}
		if !matched {
			if s.Blobs == nil {
				return SearchResult{}, errors.New("mail: private body storage unavailable for search")
			}
			body, err := getPrivateVerified(ctx, s.Blobs, actor, item.Message.BodyRef, item.Message.BodyDigest)
			if err != nil {
				return SearchResult{}, err
			}
			matched = strings.Contains(strings.ToLower(string(body)), query)
		}
		if matched {
			results = append(results, item)
		}
	}

	out := SearchResult{Items: results, Scanned: scanned}
	if nextOffset < len(candidates) {
		out.NextCursor = encodeCursor(nextOffset)
	}
	return out, nil
}
