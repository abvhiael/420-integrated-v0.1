package mail

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"sort"
	"strings"
	"time"
)

const (
	MaxOrganizationNameBytes = 64
	MaxUserLabels            = 100
	MaxCustomFolders         = 50
	MaxLabelsPerMessage      = 20
	MaxBulkOrganizationItems = 100
)

var (
	ErrOrganizationConflict = errors.New("mail: organization name already exists")
	ErrSystemLabelImmutable = errors.New("mail: system label is immutable")
)

type LabelDefinition struct {
	ID        string    `json:"id"`
	Owner     string    `json:"owner"`
	Name      string    `json:"name"`
	System    bool      `json:"system"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CustomFolder struct {
	ID        string    `json:"id"`
	Owner     string    `json:"owner"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type OrganizationUpdate struct {
	AddLabelIDs    []string `json:"add_label_ids,omitempty"`
	RemoveLabelIDs []string `json:"remove_label_ids,omitempty"`
	CustomFolderID *string  `json:"custom_folder_id,omitempty"`
}

type BulkOrganizationRequest struct {
	MessageIDs     []string `json:"message_ids"`
	AddLabelIDs    []string `json:"add_label_ids,omitempty"`
	RemoveLabelIDs []string `json:"remove_label_ids,omitempty"`
	CustomFolderID *string  `json:"custom_folder_id,omitempty"`
}

type BulkOrganizationResult struct {
	Updated []MailboxState `json:"updated"`
}

var systemLabelNames = []string{"STARRED", "PINNED", "MUTED", "UNREAD"}

func (s *Service) EnsureSystemLabels(ctx context.Context, actor string) ([]LabelDefinition, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return nil, ErrUnauthorized
	}
	var result []LabelDefinition
	err := s.Store.Update(ctx, func(data *storeData) error {
		now := s.Now().UTC()
		for _, name := range systemLabelNames {
			id := systemLabelID(name)
			key := organizationKey(actor, id)
			if _, ok := data.Labels[key]; !ok {
				data.Labels[key] = LabelDefinition{ID: id, Owner: actor, Name: name, System: true, CreatedAt: now, UpdatedAt: now}
			}
		}
		result = labelsForOwner(data, actor)
		return nil
	})
	return result, err
}

func (s *Service) ListLabels(ctx context.Context, actor string) ([]LabelDefinition, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return nil, ErrUnauthorized
	}
	if _, err := s.EnsureSystemLabels(ctx, actor); err != nil {
		return nil, err
	}
	var out []LabelDefinition
	err := s.Store.View(ctx, func(data *storeData) error {
		out = labelsForOwner(data, actor)
		return nil
	})
	return out, err
}

func (s *Service) CreateLabel(ctx context.Context, actor, name string) (LabelDefinition, error) {
	actor = strings.TrimSpace(actor)
	name = normalizeOrganizationName(name)
	if actor == "" {
		return LabelDefinition{}, ErrUnauthorized
	}
	if name == "" || len([]byte(name)) > MaxOrganizationNameBytes {
		return LabelDefinition{}, ErrInvalidInput
	}
	var out LabelDefinition
	err := s.Store.Update(ctx, func(data *storeData) error {
		if countUserLabels(data, actor) >= MaxUserLabels {
			return ErrInvalidInput
		}
		for _, label := range data.Labels {
			if label.Owner == actor && strings.EqualFold(label.Name, name) {
				return ErrOrganizationConflict
			}
		}
		now := s.Now().UTC()
		id := deterministicOrganizationID("label", actor, name)
		out = LabelDefinition{ID: id, Owner: actor, Name: name, CreatedAt: now, UpdatedAt: now}
		data.Labels[organizationKey(actor, id)] = out
		return nil
	})
	return out, err
}

func (s *Service) DeleteLabel(ctx context.Context, actor, labelID string) error {
	actor = strings.TrimSpace(actor)
	labelID = strings.TrimSpace(labelID)
	if actor == "" {
		return ErrUnauthorized
	}
	return s.Store.Update(ctx, func(data *storeData) error {
		key := organizationKey(actor, labelID)
		label, ok := data.Labels[key]
		if !ok {
			return ErrNotFound
		}
		if label.System {
			return ErrSystemLabelImmutable
		}
		delete(data.Labels, key)
		for mailboxKey, state := range data.Mailbox {
			if state.Owner != actor || state.DeletedAt != nil {
				continue
			}
			state.LabelIDs = removeString(state.LabelIDs, labelID)
			state.UpdatedAt = s.Now().UTC()
			state.Version++
			data.Mailbox[mailboxKey] = state
		}
		return nil
	})
}

func (s *Service) ListCustomFolders(ctx context.Context, actor string) ([]CustomFolder, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return nil, ErrUnauthorized
	}
	var out []CustomFolder
	err := s.Store.View(ctx, func(data *storeData) error {
		for _, folder := range data.CustomFolders {
			if folder.Owner == actor {
				out = append(out, folder)
			}
		}
		sort.Slice(out, func(i, j int) bool {
			if strings.EqualFold(out[i].Name, out[j].Name) {
				return out[i].ID < out[j].ID
			}
			return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
		})
		return nil
	})
	return out, err
}

func (s *Service) CreateCustomFolder(ctx context.Context, actor, name string) (CustomFolder, error) {
	actor = strings.TrimSpace(actor)
	name = normalizeOrganizationName(name)
	if actor == "" {
		return CustomFolder{}, ErrUnauthorized
	}
	if name == "" || len([]byte(name)) > MaxOrganizationNameBytes || isReservedFolderName(name) {
		return CustomFolder{}, ErrInvalidInput
	}
	var out CustomFolder
	err := s.Store.Update(ctx, func(data *storeData) error {
		count := 0
		for _, folder := range data.CustomFolders {
			if folder.Owner != actor {
				continue
			}
			count++
			if strings.EqualFold(folder.Name, name) {
				return ErrOrganizationConflict
			}
		}
		if count >= MaxCustomFolders {
			return ErrInvalidInput
		}
		now := s.Now().UTC()
		id := deterministicOrganizationID("folder", actor, name)
		out = CustomFolder{ID: id, Owner: actor, Name: name, CreatedAt: now, UpdatedAt: now}
		data.CustomFolders[organizationKey(actor, id)] = out
		return nil
	})
	return out, err
}

func (s *Service) DeleteCustomFolder(ctx context.Context, actor, folderID string) error {
	actor = strings.TrimSpace(actor)
	folderID = strings.TrimSpace(folderID)
	if actor == "" {
		return ErrUnauthorized
	}
	return s.Store.Update(ctx, func(data *storeData) error {
		key := organizationKey(actor, folderID)
		if _, ok := data.CustomFolders[key]; !ok {
			return ErrNotFound
		}
		delete(data.CustomFolders, key)
		now := s.Now().UTC()
		for mailboxKey, state := range data.Mailbox {
			if state.Owner == actor && state.CustomFolderID == folderID && state.DeletedAt == nil {
				state.CustomFolderID = ""
				state.UpdatedAt = now
				state.Version++
				data.Mailbox[mailboxKey] = state
			}
		}
		return nil
	})
}

func (s *Service) UpdateOrganization(ctx context.Context, actor, messageID string, update OrganizationUpdate) (MailboxState, error) {
	result, err := s.BulkUpdateOrganization(ctx, actor, BulkOrganizationRequest{
		MessageIDs: []string{messageID}, AddLabelIDs: update.AddLabelIDs, RemoveLabelIDs: update.RemoveLabelIDs, CustomFolderID: update.CustomFolderID,
	})
	if err != nil {
		return MailboxState{}, err
	}
	if len(result.Updated) != 1 {
		return MailboxState{}, ErrNotFound
	}
	return result.Updated[0], nil
}

func (s *Service) BulkUpdateOrganization(ctx context.Context, actor string, req BulkOrganizationRequest) (BulkOrganizationResult, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return BulkOrganizationResult{}, ErrUnauthorized
	}
	req.MessageIDs = uniqueNonEmpty(req.MessageIDs)
	req.AddLabelIDs = uniqueNonEmpty(req.AddLabelIDs)
	req.RemoveLabelIDs = uniqueNonEmpty(req.RemoveLabelIDs)
	if len(req.MessageIDs) == 0 || len(req.MessageIDs) > MaxBulkOrganizationItems || len(req.AddLabelIDs)+len(req.RemoveLabelIDs) > MaxLabelsPerMessage {
		return BulkOrganizationResult{}, ErrInvalidInput
	}
	if overlap(req.AddLabelIDs, req.RemoveLabelIDs) {
		return BulkOrganizationResult{}, ErrInvalidInput
	}
	var out BulkOrganizationResult
	err := s.Store.Update(ctx, func(data *storeData) error {
		for _, labelID := range append(append([]string(nil), req.AddLabelIDs...), req.RemoveLabelIDs...) {
			label, ok := data.Labels[organizationKey(actor, labelID)]
			if !ok || label.System {
				return ErrInvalidInput
			}
		}
		targetFolder := ""
		if req.CustomFolderID != nil {
			targetFolder = strings.TrimSpace(*req.CustomFolderID)
			if targetFolder != "" {
				if _, ok := data.CustomFolders[organizationKey(actor, targetFolder)]; !ok {
					return ErrInvalidInput
				}
			}
		}
		now := s.Now().UTC()
		for _, messageID := range req.MessageIDs {
			key := mailboxKey(actor, messageID)
			state, ok := data.Mailbox[key]
			if !ok || state.DeletedAt != nil {
				return ErrNotFound
			}
			labels := append([]string(nil), state.LabelIDs...)
			for _, id := range req.RemoveLabelIDs {
				labels = removeString(labels, id)
			}
			for _, id := range req.AddLabelIDs {
				if !containsString(labels, id) {
					labels = append(labels, id)
				}
			}
			if len(labels) > MaxLabelsPerMessage {
				return ErrInvalidInput
			}
			sort.Strings(labels)
			state.LabelIDs = labels
			if req.CustomFolderID != nil {
				state.CustomFolderID = targetFolder
			}
			state.UpdatedAt = now
			state.Version++
			data.Mailbox[key] = state
			out.Updated = append(out.Updated, state)
		}
		return nil
	})
	return out, err
}

func (s *Service) MessagesByLabel(ctx context.Context, actor, labelID string, cursor string, limit int) (MailboxPage, error) {
	actor = strings.TrimSpace(actor)
	labelID = strings.TrimSpace(labelID)
	if actor == "" {
		return MailboxPage{}, ErrUnauthorized
	}
	if _, err := s.EnsureSystemLabels(ctx, actor); err != nil {
		return MailboxPage{}, err
	}
	var definition LabelDefinition
	var ok bool
	if err := s.Store.View(ctx, func(data *storeData) error {
		definition, ok = data.Labels[organizationKey(actor, labelID)]
		return nil
	}); err != nil {
		return MailboxPage{}, err
	}
	if !ok {
		return MailboxPage{}, ErrNotFound
	}
	if definition.System {
		return s.systemLabelPage(ctx, actor, definition.Name, cursor, limit)
	}
	return s.organizationPage(ctx, actor, organizationIndexKey(actor, labelID), true, cursor, limit)
}

func (s *Service) MessagesByCustomFolder(ctx context.Context, actor, folderID string, cursor string, limit int) (MailboxPage, error) {
	return s.organizationPage(ctx, actor, organizationIndexKey(actor, folderID), false, cursor, limit)
}

func (s *Service) systemLabelPage(ctx context.Context, actor, name, cursor string, limit int) (MailboxPage, error) {
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
	items := []MailboxItem{}
	err = s.Store.View(ctx, func(data *storeData) error {
		for _, state := range data.Mailbox {
			if state.Owner != actor || state.DeletedAt != nil || !matchesSystemLabel(state, name) {
				continue
			}
			msg, ok := data.Messages[state.MessageID]
			if ok {
				items = append(items, MailboxItem{Message: msg, State: state})
			}
		}
		return nil
	})
	if err != nil {
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

func matchesSystemLabel(state MailboxState, name string) bool {
	switch strings.ToUpper(name) {
	case "STARRED":
		return state.Starred
	case "PINNED":
		return state.Pinned
	case "MUTED":
		return state.Muted
	case "UNREAD":
		return state.ReadAt == nil
	default:
		return false
	}
}

func (s *Service) organizationPage(ctx context.Context, actor, indexKey string, label bool, cursor string, limit int) (MailboxPage, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return MailboxPage{}, ErrUnauthorized
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
	items := []MailboxItem{}
	err = s.Store.View(ctx, func(data *storeData) error {
		var keys []string
		if label {
			keys = data.LabelIndex[indexKey]
		} else {
			keys = data.CustomFolderIndex[indexKey]
		}
		for _, key := range keys {
			state, ok := data.Mailbox[key]
			if !ok || state.Owner != actor || state.DeletedAt != nil {
				continue
			}
			msg, ok := data.Messages[state.MessageID]
			if ok {
				items = append(items, MailboxItem{Message: msg, State: state})
			}
		}
		return nil
	})
	if err != nil {
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

func labelsForOwner(data *storeData, owner string) []LabelDefinition {
	var out []LabelDefinition
	for _, label := range data.Labels {
		if label.Owner == owner {
			out = append(out, label)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].System != out[j].System {
			return out[i].System
		}
		if strings.EqualFold(out[i].Name, out[j].Name) {
			return out[i].ID < out[j].ID
		}
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	return out
}

func countUserLabels(data *storeData, owner string) int {
	n := 0
	for _, label := range data.Labels {
		if label.Owner == owner && !label.System {
			n++
		}
	}
	return n
}

func systemLabelID(name string) string {
	return "sys_" + strings.ToLower(name)
}

func organizationKey(owner, id string) string {
	return owner + "\x00" + id
}

func organizationIndexKey(owner, id string) string {
	return organizationKey(owner, id)
}

func deterministicOrganizationID(kind, owner, name string) string {
	sum := sha256.Sum256([]byte("420/MAIL/ORG/V1\x00" + kind + "\x00" + owner + "\x00" + strings.ToLower(name)))
	return kind + "_" + hex.EncodeToString(sum[:8])
}

func normalizeOrganizationName(name string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(name)), " ")
}

func isReservedFolderName(name string) bool {
	for _, folder := range []MailboxFolder{FolderInbox, FolderSent, FolderOutbox, FolderDrafts, FolderArchive, FolderJunk, FolderTrash} {
		if strings.EqualFold(name, string(folder)) {
			return true
		}
	}
	return false
}

func uniqueNonEmpty(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, value := range in {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func containsString(in []string, value string) bool {
	for _, item := range in {
		if item == value {
			return true
		}
	}
	return false
}

func removeString(in []string, value string) []string {
	out := in[:0]
	for _, item := range in {
		if item != value {
			out = append(out, item)
		}
	}
	return out
}

func overlap(a, b []string) bool {
	for _, x := range a {
		if containsString(b, x) {
			return true
		}
	}
	return false
}
