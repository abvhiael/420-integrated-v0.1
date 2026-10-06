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
	MaxUserRules             = 100
	MaxRuleNameBytes         = 80
	MaxRuleContentMatchBytes = 256
	MaxRuleActionsLabels     = 20
)

var (
	ErrRuleConflict = errors.New("mail: rule name already exists")
)

type RuleCondition struct {
	SenderEquals   string `json:"sender_equals,omitempty"`
	ContentContains string `json:"content_contains,omitempty"`
	SourceEquals   string `json:"source_equals,omitempty"`
}

type RuleAction struct {
	Folder          *MailboxFolder `json:"folder,omitempty"`
	AddLabelIDs     []string       `json:"add_label_ids,omitempty"`
	CustomFolderID  *string        `json:"custom_folder_id,omitempty"`
	MarkRead        *bool          `json:"mark_read,omitempty"`
	Starred         *bool          `json:"starred,omitempty"`
	Pinned          *bool          `json:"pinned,omitempty"`
	Muted           *bool          `json:"muted,omitempty"`
	StopProcessing  bool           `json:"stop_processing,omitempty"`
}

type MailRule struct {
	ID         string        `json:"id"`
	Owner      string        `json:"owner"`
	Name       string        `json:"name"`
	Enabled    bool          `json:"enabled"`
	Priority   int           `json:"priority"`
	Condition  RuleCondition `json:"condition"`
	Action     RuleAction    `json:"action"`
	CreatedAt  time.Time     `json:"created_at"`
	UpdatedAt  time.Time     `json:"updated_at"`
}

type RuleInput struct {
	Name      string        `json:"name"`
	Enabled   *bool         `json:"enabled,omitempty"`
	Priority  int           `json:"priority,omitempty"`
	Condition RuleCondition `json:"condition"`
	Action    RuleAction    `json:"action"`
}

func (s *Service) ListRules(ctx context.Context, actor string) ([]MailRule, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return nil, ErrUnauthorized
	}
	var out []MailRule
	err := s.Store.View(ctx, func(data *storeData) error {
		out = rulesForOwner(data, actor)
		return nil
	})
	return out, err
}

func (s *Service) CreateRule(ctx context.Context, actor string, input RuleInput) (MailRule, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return MailRule{}, ErrUnauthorized
	}
	input = normalizeRuleInput(input)
	var out MailRule
	err := s.Store.Update(ctx, func(data *storeData) error {
		if countRules(data, actor) >= MaxUserRules {
			return ErrInvalidInput
		}
		for _, rule := range data.Rules {
			if rule.Owner == actor && strings.EqualFold(rule.Name, input.Name) {
				return ErrRuleConflict
			}
		}
		if err := validateRuleInput(data, actor, input); err != nil {
			return err
		}
		now := s.Now().UTC()
		enabled := true
		if input.Enabled != nil {
			enabled = *input.Enabled
		}
		stored := MailRule{
			ID: deterministicRuleID(actor, input.Name), Owner: actor, Name: input.Name,
			Enabled: enabled, Priority: input.Priority, Condition: input.Condition, Action: cloneRuleAction(input.Action),
			CreatedAt: now, UpdatedAt: now,
		}
		key := ruleKey(actor, stored.ID)
		if _, exists := data.Rules[key]; exists {
			return ErrRuleConflict
		}
		data.Rules[key] = stored
		out = cloneMailRule(stored)
		return nil
	})
	return out, err
}

func (s *Service) UpdateRule(ctx context.Context, actor, id string, input RuleInput) (MailRule, error) {
	actor = strings.TrimSpace(actor)
	id = strings.TrimSpace(id)
	if actor == "" {
		return MailRule{}, ErrUnauthorized
	}
	input = normalizeRuleInput(input)
	var out MailRule
	err := s.Store.Update(ctx, func(data *storeData) error {
		key := ruleKey(actor, id)
		current, ok := data.Rules[key]
		if !ok {
			return ErrNotFound
		}
		for otherKey, rule := range data.Rules {
			if otherKey != key && rule.Owner == actor && strings.EqualFold(rule.Name, input.Name) {
				return ErrRuleConflict
			}
		}
		if err := validateRuleInput(data, actor, input); err != nil {
			return err
		}
		enabled := current.Enabled
		if input.Enabled != nil {
			enabled = *input.Enabled
		}
		current.Name = input.Name
		current.Enabled = enabled
		current.Priority = input.Priority
		current.Condition = input.Condition
		current.Action = cloneRuleAction(input.Action)
		current.UpdatedAt = s.Now().UTC()
		data.Rules[key] = current
		out = cloneMailRule(current)
		return nil
	})
	return out, err
}

func (s *Service) DeleteRule(ctx context.Context, actor, id string) error {
	actor = strings.TrimSpace(actor)
	id = strings.TrimSpace(id)
	if actor == "" {
		return ErrUnauthorized
	}
	return s.Store.Update(ctx, func(data *storeData) error {
		key := ruleKey(actor, id)
		if _, ok := data.Rules[key]; !ok {
			return ErrNotFound
		}
		delete(data.Rules, key)
		return nil
	})
}

func applyIncomingRules(data *storeData, owner string, msg Message, body string, state *MailboxState, now time.Time) error {
	if state == nil || state.Owner != owner || msg.Recipient != owner {
		return ErrUnauthorized
	}
	for _, rule := range rulesForOwner(data, owner) {
		if !rule.Enabled || !ruleMatches(rule.Condition, msg, body) {
			continue
		}
		if err := applyRuleAction(data, owner, rule.Action, state, now); err != nil {
			return err
		}
		if rule.Action.StopProcessing {
			break
		}
	}
	return nil
}

func ruleMatches(condition RuleCondition, msg Message, body string) bool {
	if condition.SenderEquals != "" && !strings.EqualFold(msg.Sender, condition.SenderEquals) {
		return false
	}
	if condition.SourceEquals != "" && !strings.EqualFold(msg.Source, condition.SourceEquals) {
		return false
	}
	if condition.ContentContains != "" {
		needle := strings.ToLower(condition.ContentContains)
		content := strings.ToLower(msg.Subject + "\n" + body)
		if !strings.Contains(content, needle) {
			return false
		}
	}
	return true
}

func applyRuleAction(data *storeData, owner string, action RuleAction, state *MailboxState, now time.Time) error {
	if action.Folder != nil && *action.Folder != state.Folder {
		if !ruleFolderAllowed(*action.Folder) {
			return ErrInvalidInput
		}
		state.PreviousFolder = state.Folder
		state.Folder = *action.Folder
		switch *action.Folder {
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
	for _, labelID := range action.AddLabelIDs {
		if _, ok := data.Labels[organizationKey(owner, labelID)]; !ok {
			return ErrInvalidInput
		}
		if !containsString(state.LabelIDs, labelID) {
			state.LabelIDs = append(state.LabelIDs, labelID)
		}
	}
	if len(state.LabelIDs) > MaxLabelsPerMessage {
		return ErrInvalidInput
	}
	sort.Strings(state.LabelIDs)
	if action.CustomFolderID != nil {
		target := strings.TrimSpace(*action.CustomFolderID)
		if target != "" {
			if _, ok := data.CustomFolders[organizationKey(owner, target)]; !ok {
				return ErrInvalidInput
			}
		}
		state.CustomFolderID = target
	}
	if action.MarkRead != nil {
		if *action.MarkRead {
			t := now
			state.ReadAt = &t
		} else {
			state.ReadAt = nil
		}
	}
	if action.Starred != nil {
		state.Starred = *action.Starred
	}
	if action.Pinned != nil {
		state.Pinned = *action.Pinned
	}
	if action.Muted != nil {
		state.Muted = *action.Muted
	}
	state.UpdatedAt = now
	state.Version++
	return nil
}

func validateRuleInput(data *storeData, owner string, input RuleInput) error {
	if input.Name == "" || len([]byte(input.Name)) > MaxRuleNameBytes || input.Priority < 0 {
		return ErrInvalidInput
	}
	condition := input.Condition
	if condition.SenderEquals == "" && condition.ContentContains == "" && condition.SourceEquals == "" {
		return ErrInvalidInput
	}
	if len([]byte(condition.ContentContains)) > MaxRuleContentMatchBytes || len([]byte(condition.SenderEquals)) > MaxRuleContentMatchBytes || len([]byte(condition.SourceEquals)) > MaxRuleContentMatchBytes {
		return ErrInvalidInput
	}
	action := input.Action
	if action.Folder == nil && len(action.AddLabelIDs) == 0 && action.CustomFolderID == nil && action.MarkRead == nil && action.Starred == nil && action.Pinned == nil && action.Muted == nil {
		return ErrInvalidInput
	}
	if action.Folder != nil && !ruleFolderAllowed(*action.Folder) {
		return ErrInvalidInput
	}
	action.AddLabelIDs = uniqueNonEmpty(action.AddLabelIDs)
	if len(action.AddLabelIDs) > MaxRuleActionsLabels {
		return ErrInvalidInput
	}
	for _, labelID := range action.AddLabelIDs {
		label, ok := data.Labels[organizationKey(owner, labelID)]
		if !ok || label.System {
			return ErrInvalidInput
		}
	}
	if action.CustomFolderID != nil {
		target := strings.TrimSpace(*action.CustomFolderID)
		if target != "" {
			if _, ok := data.CustomFolders[organizationKey(owner, target)]; !ok {
				return ErrInvalidInput
			}
		}
	}
	return nil
}

func normalizeRuleInput(input RuleInput) RuleInput {
	input.Name = normalizeOrganizationName(input.Name)
	input.Condition.SenderEquals = strings.TrimSpace(input.Condition.SenderEquals)
	input.Condition.ContentContains = strings.TrimSpace(input.Condition.ContentContains)
	input.Condition.SourceEquals = strings.TrimSpace(input.Condition.SourceEquals)
	input.Action.AddLabelIDs = uniqueNonEmpty(input.Action.AddLabelIDs)
	if input.Action.CustomFolderID != nil {
		target := strings.TrimSpace(*input.Action.CustomFolderID)
		input.Action.CustomFolderID = &target
	}
	return input
}

func rulesForOwner(data *storeData, owner string) []MailRule {
	out := make([]MailRule, 0)
	for _, rule := range data.Rules {
		if rule.Owner == owner {
			out = append(out, cloneMailRule(rule))
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Priority != out[j].Priority {
			return out[i].Priority < out[j].Priority
		}
		if out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].ID < out[j].ID
		}
		return out[i].CreatedAt.Before(out[j].CreatedAt)
	})
	return out
}

func countRules(data *storeData, owner string) int {
	n := 0
	for _, rule := range data.Rules {
		if rule.Owner == owner {
			n++
		}
	}
	return n
}

func cleanupRulesAfterLabelDelete(data *storeData, owner, labelID string) {
	for key, rule := range data.Rules {
		if rule.Owner != owner {
			continue
		}
		rule.Action.AddLabelIDs = removeString(rule.Action.AddLabelIDs, labelID)
		if !ruleActionHasEffect(rule.Action) {
			delete(data.Rules, key)
			continue
		}
		data.Rules[key] = rule
	}
}

func cleanupRulesAfterCustomFolderDelete(data *storeData, owner, folderID string) {
	for key, rule := range data.Rules {
		if rule.Owner != owner || rule.Action.CustomFolderID == nil || *rule.Action.CustomFolderID != folderID {
			continue
		}
		rule.Action.CustomFolderID = nil
		if !ruleActionHasEffect(rule.Action) {
			delete(data.Rules, key)
			continue
		}
		data.Rules[key] = rule
	}
}

func ruleActionHasEffect(action RuleAction) bool {
	return action.Folder != nil || len(action.AddLabelIDs) > 0 || action.CustomFolderID != nil || action.MarkRead != nil || action.Starred != nil || action.Pinned != nil || action.Muted != nil
}

func cloneMailRule(rule MailRule) MailRule {
	out := rule
	out.Action = cloneRuleAction(rule.Action)
	return out
}

func cloneRuleAction(action RuleAction) RuleAction {
	out := action
	out.AddLabelIDs = append([]string(nil), action.AddLabelIDs...)
	if action.Folder != nil {
		v := *action.Folder
		out.Folder = &v
	}
	if action.CustomFolderID != nil {
		v := *action.CustomFolderID
		out.CustomFolderID = &v
	}
	if action.MarkRead != nil {
		v := *action.MarkRead
		out.MarkRead = &v
	}
	if action.Starred != nil {
		v := *action.Starred
		out.Starred = &v
	}
	if action.Pinned != nil {
		v := *action.Pinned
		out.Pinned = &v
	}
	if action.Muted != nil {
		v := *action.Muted
		out.Muted = &v
	}
	return out
}

func ruleFolderAllowed(folder MailboxFolder) bool {
	switch folder {
	case FolderInbox, FolderArchive, FolderJunk, FolderTrash:
		return true
	default:
		return false
	}
}

func validateStoredRule(data *storeData, key string, rule MailRule) error {
	if key != ruleKey(rule.Owner, rule.ID) || rule.Owner == "" || rule.ID == "" || rule.Name == "" {
		return ErrInvalidInput
	}
	input := RuleInput{Name: rule.Name, Priority: rule.Priority, Condition: rule.Condition, Action: rule.Action}
	enabled := rule.Enabled
	input.Enabled = &enabled
	return validateRuleInput(data, rule.Owner, input)
}

func ruleKey(owner, id string) string {
	return owner + "\x00" + id
}

func deterministicRuleID(owner, name string) string {
	sum := sha256.Sum256([]byte("420/MAIL/RULE/V1\x00" + owner + "\x00" + strings.ToLower(name)))
	return "rule_" + hex.EncodeToString(sum[:8])
}
