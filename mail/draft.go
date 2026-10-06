package mail

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

var (
	ErrDraftConflict          = errors.New("mail: draft version conflict")
	ErrDraftDeleteUnavailable = errors.New("mail: private draft deletion unavailable")
)

const (
	MaxDraftsPerUser = 500
	MaxDraftKeyBytes = 128
)

type PrivateBlobDeleteStore interface {
	DeletePrivate(context.Context, string, string) error
}

type Draft struct {
	ID             string    `json:"id"`
	Owner          string    `json:"owner"`
	Recipient      string    `json:"recipient,omitempty"`
	Subject        string    `json:"subject,omitempty"`
	BodyRef        string    `json:"body_ref,omitempty"`
	BodyDigest     string    `json:"body_digest,omitempty"`
	ConversationID string    `json:"conversation_id,omitempty"`
	ReplyTo        string    `json:"reply_to,omitempty"`
	Source         string    `json:"source"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	Version        uint32    `json:"version"`
}

type DraftView struct {
	Draft Draft  `json:"draft"`
	Body  string `json:"body"`
}

type DraftCreateRequest struct {
	AutosaveKey    string `json:"autosave_key"`
	Recipient      string `json:"recipient,omitempty"`
	Subject        string `json:"subject,omitempty"`
	Body           string `json:"body,omitempty"`
	ConversationID string `json:"conversation_id,omitempty"`
	ReplyTo        string `json:"reply_to,omitempty"`
	Source         string `json:"source"`
}

type DraftSaveRequest struct {
	ExpectedVersion uint32 `json:"expected_version"`
	Recipient       string `json:"recipient,omitempty"`
	Subject         string `json:"subject,omitempty"`
	Body            string `json:"body,omitempty"`
	ConversationID  string `json:"conversation_id,omitempty"`
	ReplyTo         string `json:"reply_to,omitempty"`
	Source          string `json:"source"`
}

func (s *Service) CreateDraft(ctx context.Context, actor string, req DraftCreateRequest) (DraftView, error) {
	actor = strings.TrimSpace(actor)
	req.AutosaveKey = strings.TrimSpace(req.AutosaveKey)
	req.Recipient = strings.TrimSpace(req.Recipient)
	req.Subject = strings.TrimSpace(req.Subject)
	req.ConversationID = strings.TrimSpace(req.ConversationID)
	req.ReplyTo = strings.TrimSpace(req.ReplyTo)
	req.Source = strings.TrimSpace(req.Source)
	if actor == "" {
		return DraftView{}, ErrUnauthorized
	}
	if req.AutosaveKey == "" || len([]byte(req.AutosaveKey)) > MaxDraftKeyBytes || req.Source != ServiceID || len([]byte(req.Subject)) > MaxSubjectBytes || len([]byte(req.Body)) > MaxBodyBytes {
		return DraftView{}, ErrInvalidInput
	}
	if s.Blobs == nil || s.Store == nil {
		return DraftView{}, errors.New("mail: service dependencies unavailable")
	}
	id := deterministicDraftID(actor, req.AutosaveKey)
	var existing Draft
	found := false
	if err := s.Store.View(ctx, func(data *storeData) error {
		existing, found = data.Drafts[draftKey(actor, id)]
		if !found && draftCount(data, actor) >= MaxDraftsPerUser {
			return ErrInvalidInput
		}
		return nil
	}); err != nil {
		return DraftView{}, err
	}
	if found {
		body, err := s.Blobs.GetPrivate(ctx, actor, existing.BodyRef)
		if err != nil {
			return DraftView{}, err
		}
		return DraftView{Draft: existing, Body: string(body)}, nil
	}
	ref, digest, err := s.Blobs.PutPrivate(ctx, actor, []byte(req.Body))
	if err != nil || ref == "" || digest == "" {
		if err != nil {
			return DraftView{}, err
		}
		return DraftView{}, errors.New("mail: storage returned incomplete draft evidence")
	}
	now := s.Now().UTC()
	draft := Draft{ID: id, Owner: actor, Recipient: req.Recipient, Subject: req.Subject, BodyRef: ref, BodyDigest: digest, ConversationID: req.ConversationID, ReplyTo: req.ReplyTo, Source: req.Source, CreatedAt: now, UpdatedAt: now, Version: 1}
	if err := s.Store.Update(ctx, func(data *storeData) error {
		key := draftKey(actor, id)
		if existing, ok := data.Drafts[key]; ok {
			draft = existing
			return nil
		}
		if draftCount(data, actor) >= MaxDraftsPerUser {
			return ErrInvalidInput
		}
		data.Drafts[key] = draft
		return nil
	}); err != nil {
		return DraftView{}, err
	}
	return DraftView{Draft: draft, Body: req.Body}, nil
}

func (s *Service) SaveDraft(ctx context.Context, actor, id string, req DraftSaveRequest) (DraftView, error) {
	actor = strings.TrimSpace(actor)
	id = strings.TrimSpace(id)
	req.Recipient = strings.TrimSpace(req.Recipient)
	req.Subject = strings.TrimSpace(req.Subject)
	req.ConversationID = strings.TrimSpace(req.ConversationID)
	req.ReplyTo = strings.TrimSpace(req.ReplyTo)
	req.Source = strings.TrimSpace(req.Source)
	if actor == "" {
		return DraftView{}, ErrUnauthorized
	}
	if id == "" || req.ExpectedVersion == 0 || req.Source != ServiceID || len([]byte(req.Subject)) > MaxSubjectBytes || len([]byte(req.Body)) > MaxBodyBytes {
		return DraftView{}, ErrInvalidInput
	}
	var current Draft
	var ok bool
	if err := s.Store.View(ctx, func(data *storeData) error {
		current, ok = data.Drafts[draftKey(actor, id)]
		return nil
	}); err != nil {
		return DraftView{}, err
	}
	if !ok {
		return DraftView{}, ErrNotFound
	}
	if current.Version != req.ExpectedVersion {
		return DraftView{}, ErrDraftConflict
	}
	ref, digest, err := s.Blobs.PutPrivate(ctx, actor, []byte(req.Body))
	if err != nil || ref == "" || digest == "" {
		if err != nil {
			return DraftView{}, err
		}
		return DraftView{}, errors.New("mail: storage returned incomplete draft evidence")
	}
	now := s.Now().UTC()
	var updated Draft
	if err := s.Store.Update(ctx, func(data *storeData) error {
		key := draftKey(actor, id)
		draft, ok := data.Drafts[key]
		if !ok {
			return ErrNotFound
		}
		if draft.Version != req.ExpectedVersion {
			return ErrDraftConflict
		}
		draft.Recipient = req.Recipient
		draft.Subject = req.Subject
		draft.BodyRef = ref
		draft.BodyDigest = digest
		draft.ConversationID = req.ConversationID
		draft.ReplyTo = req.ReplyTo
		draft.Source = req.Source
		draft.UpdatedAt = now
		draft.Version++
		data.Drafts[key] = draft
		updated = draft
		return nil
	}); err != nil {
		return DraftView{}, err
	}
	return DraftView{Draft: updated, Body: req.Body}, nil
}

func (s *Service) GetDraft(ctx context.Context, actor, id string) (DraftView, error) {
	actor = strings.TrimSpace(actor)
	id = strings.TrimSpace(id)
	if actor == "" {
		return DraftView{}, ErrUnauthorized
	}
	var draft Draft
	var ok bool
	if err := s.Store.View(ctx, func(data *storeData) error {
		draft, ok = data.Drafts[draftKey(actor, id)]
		return nil
	}); err != nil {
		return DraftView{}, err
	}
	if !ok {
		return DraftView{}, ErrNotFound
	}
	body, err := s.Blobs.GetPrivate(ctx, actor, draft.BodyRef)
	if err != nil {
		return DraftView{}, err
	}
	return DraftView{Draft: draft, Body: string(body)}, nil
}

func (s *Service) ListDrafts(ctx context.Context, actor string) ([]Draft, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return nil, ErrUnauthorized
	}
	out := []Draft{}
	err := s.Store.View(ctx, func(data *storeData) error {
		for _, draft := range data.Drafts {
			if draft.Owner == actor {
				out = append(out, draft)
			}
		}
		return nil
	})
	sort.Slice(out, func(i, j int) bool {
		if out[i].UpdatedAt.Equal(out[j].UpdatedAt) {
			return out[i].ID < out[j].ID
		}
		return out[i].UpdatedAt.After(out[j].UpdatedAt)
	})
	return out, err
}

func (s *Service) DiscardDraft(ctx context.Context, actor, id string, expectedVersion uint32) error {
	actor = strings.TrimSpace(actor)
	id = strings.TrimSpace(id)
	if actor == "" {
		return ErrUnauthorized
	}
	if id == "" || expectedVersion == 0 {
		return ErrInvalidInput
	}
	deleter, ok := s.Blobs.(PrivateBlobDeleteStore)
	if !ok {
		return ErrDraftDeleteUnavailable
	}
	var removed Draft
	if err := s.Store.Update(ctx, func(data *storeData) error {
		key := draftKey(actor, id)
		draft, ok := data.Drafts[key]
		if !ok {
			return ErrNotFound
		}
		if draft.Version != expectedVersion {
			return ErrDraftConflict
		}
		removed = draft
		delete(data.Drafts, key)
		return nil
	}); err != nil {
		return err
	}
	if err := deleter.DeletePrivate(ctx, actor, removed.BodyRef); err != nil {
		rollbackErr := s.Store.Update(ctx, func(data *storeData) error {
			key := draftKey(actor, id)
			if _, exists := data.Drafts[key]; exists {
				return ErrDraftConflict
			}
			data.Drafts[key] = removed
			return nil
		})
		if rollbackErr != nil {
			return fmt.Errorf("%w: blob delete failed: %v; metadata rollback failed: %v", ErrDraftDeleteUnavailable, err, rollbackErr)
		}
		return fmt.Errorf("%w: %v", ErrDraftDeleteUnavailable, err)
	}
	return nil
}

func deterministicDraftID(owner, autosaveKey string) string {
	sum := sha256.Sum256([]byte("420/MAIL/DRAFT/V1\x00" + owner + "\x00" + autosaveKey))
	return "draft_" + hex.EncodeToString(sum[:16])
}

func draftKey(owner, id string) string { return owner + "\x00" + id }

func draftCount(data *storeData, owner string) int {
	n := 0
	for _, draft := range data.Drafts {
		if draft.Owner == owner {
			n++
		}
	}
	return n
}

func validateDraftData(data *storeData) error {
	for key, draft := range data.Drafts {
		if key != draftKey(draft.Owner, draft.ID) || draft.Owner == "" || draft.ID == "" || draft.Source != ServiceID || draft.Version == 0 || draft.BodyRef == "" || draft.BodyDigest == "" {
			return ErrInvalidInput
		}
	}
	return nil
}
