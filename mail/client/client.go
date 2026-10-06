package client

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/420integrated/420-integrated/mail"
)

type Client struct {
	BaseURL    string
	HTTP       *http.Client
	AuthHeader func(context.Context) (string, error)
}

func (c Client) do(ctx context.Context, method, path string, in, out any) error {
	if c.HTTP == nil {
		c.HTTP = http.DefaultClient
	}
	base := strings.TrimRight(c.BaseURL, "/")
	if base == "" {
		return errors.New("420mail client: base URL required")
	}
	var body io.Reader
	if in != nil {
		raw, err := json.Marshal(in)
		if err != nil {
			return err
		}
		body = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, base+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.AuthHeader != nil {
		token, err := c.AuthHeader(ctx)
		if err != nil {
			return err
		}
		if token != "" {
			req.Header.Set("Authorization", token)
		}
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var e map[string]string
		_ = json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&e)
		return fmt.Errorf("420mail client: http %d: %s", resp.StatusCode, e["code"])
	}
	if out == nil || resp.StatusCode == http.StatusNoContent {
		return nil
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(out)
}

func (c Client) Send(ctx context.Context, req mail.SendRequest) (mail.Message, error) {
	var out mail.Message
	err := c.do(ctx, http.MethodPost, "/v1/messages", req, &out)
	return out, err
}

func (c Client) Inbox(ctx context.Context, cursor string, limit int) (mail.Page, error) {
	q := url.Values{}
	if cursor != "" {
		q.Set("cursor", cursor)
	}
	if limit > 0 {
		q.Set("limit", strconv.Itoa(limit))
	}
	path := "/v1/inbox"
	if encoded := q.Encode(); encoded != "" {
		path += "?" + encoded
	}
	var out mail.Page
	err := c.do(ctx, http.MethodGet, path, nil, &out)
	return out, err
}

func (c Client) MarkRead(ctx context.Context, id string) (mail.Message, error) {
	var out mail.Message
	err := c.do(ctx, http.MethodPost, "/v1/messages/"+url.PathEscape(id)+"/read", nil, &out)
	return out, err
}

func (c Client) Mailbox(ctx context.Context, folder mail.MailboxFolder, cursor string, limit int) (mail.MailboxPage, error) {
	q := url.Values{}
	if cursor != "" {
		q.Set("cursor", cursor)
	}
	if limit > 0 {
		q.Set("limit", strconv.Itoa(limit))
	}
	path := "/v1/mailboxes/" + url.PathEscape(string(folder))
	if encoded := q.Encode(); encoded != "" {
		path += "?" + encoded
	}
	var out mail.MailboxPage
	err := c.do(ctx, http.MethodGet, path, nil, &out)
	return out, err
}

func (c Client) MailboxState(ctx context.Context, id string) (mail.MailboxState, error) {
	var out mail.MailboxState
	err := c.do(ctx, http.MethodGet, "/v1/messages/"+url.PathEscape(id)+"/mailbox", nil, &out)
	return out, err
}

func (c Client) UpdateMailbox(ctx context.Context, id string, update mail.MailboxUpdate) (mail.MailboxState, error) {
	var out mail.MailboxState
	err := c.do(ctx, http.MethodPatch, "/v1/messages/"+url.PathEscape(id)+"/mailbox", update, &out)
	return out, err
}

func (c Client) MarkUnread(ctx context.Context, id string) (mail.MailboxState, error) {
	var out mail.MailboxState
	err := c.do(ctx, http.MethodPost, "/v1/messages/"+url.PathEscape(id)+"/unread", nil, &out)
	return out, err
}

func (c Client) RestoreFromTrash(ctx context.Context, id string) (mail.MailboxState, error) {
	var out mail.MailboxState
	err := c.do(ctx, http.MethodPost, "/v1/messages/"+url.PathEscape(id)+"/restore", nil, &out)
	return out, err
}

func (c Client) PermanentlyDelete(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/v1/messages/"+url.PathEscape(id), nil, nil)
}

func (c Client) ListLabels(ctx context.Context) ([]mail.LabelDefinition, error) {
	var out []mail.LabelDefinition
	err := c.do(ctx, http.MethodGet, "/v1/labels", nil, &out)
	return out, err
}

func (c Client) CreateLabel(ctx context.Context, name string) (mail.LabelDefinition, error) {
	var out mail.LabelDefinition
	err := c.do(ctx, http.MethodPost, "/v1/labels", map[string]string{"name": name}, &out)
	return out, err
}

func (c Client) DeleteLabel(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/v1/labels/"+url.PathEscape(id), nil, nil)
}

func (c Client) ListCustomFolders(ctx context.Context) ([]mail.CustomFolder, error) {
	var out []mail.CustomFolder
	err := c.do(ctx, http.MethodGet, "/v1/custom-folders", nil, &out)
	return out, err
}

func (c Client) CreateCustomFolder(ctx context.Context, name string) (mail.CustomFolder, error) {
	var out mail.CustomFolder
	err := c.do(ctx, http.MethodPost, "/v1/custom-folders", map[string]string{"name": name}, &out)
	return out, err
}

func (c Client) DeleteCustomFolder(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/v1/custom-folders/"+url.PathEscape(id), nil, nil)
}

func (c Client) UpdateOrganization(ctx context.Context, messageID string, update mail.OrganizationUpdate) (mail.MailboxState, error) {
	var out mail.MailboxState
	err := c.do(ctx, http.MethodPatch, "/v1/messages/"+url.PathEscape(messageID)+"/organization", update, &out)
	return out, err
}

func (c Client) BulkUpdateOrganization(ctx context.Context, req mail.BulkOrganizationRequest) (mail.BulkOrganizationResult, error) {
	var out mail.BulkOrganizationResult
	err := c.do(ctx, http.MethodPatch, "/v1/organization/bulk", req, &out)
	return out, err
}

func (c Client) MessagesByLabel(ctx context.Context, labelID, cursor string, limit int) (mail.MailboxPage, error) {
	q := url.Values{}
	if cursor != "" {
		q.Set("cursor", cursor)
	}
	if limit > 0 {
		q.Set("limit", strconv.Itoa(limit))
	}
	path := "/v1/labels/" + url.PathEscape(labelID) + "/messages"
	if encoded := q.Encode(); encoded != "" {
		path += "?" + encoded
	}
	var out mail.MailboxPage
	err := c.do(ctx, http.MethodGet, path, nil, &out)
	return out, err
}

func (c Client) MessagesByCustomFolder(ctx context.Context, folderID, cursor string, limit int) (mail.MailboxPage, error) {
	q := url.Values{}
	if cursor != "" {
		q.Set("cursor", cursor)
	}
	if limit > 0 {
		q.Set("limit", strconv.Itoa(limit))
	}
	path := "/v1/custom-folders/" + url.PathEscape(folderID) + "/messages"
	if encoded := q.Encode(); encoded != "" {
		path += "?" + encoded
	}
	var out mail.MailboxPage
	err := c.do(ctx, http.MethodGet, path, nil, &out)
	return out, err
}

func (c Client) SearchMailbox(ctx context.Context, req mail.SearchRequest) (mail.SearchResult, error) {
	var out mail.SearchResult
	err := c.do(ctx, http.MethodPost, "/v1/search", req, &out)
	return out, err
}

func (c Client) ListRules(ctx context.Context) ([]mail.MailRule, error) {
	var out []mail.MailRule
	err := c.do(ctx, http.MethodGet, "/v1/rules", nil, &out)
	return out, err
}

func (c Client) CreateRule(ctx context.Context, input mail.RuleInput) (mail.MailRule, error) {
	var out mail.MailRule
	err := c.do(ctx, http.MethodPost, "/v1/rules", input, &out)
	return out, err
}

func (c Client) UpdateRule(ctx context.Context, id string, input mail.RuleInput) (mail.MailRule, error) {
	var out mail.MailRule
	err := c.do(ctx, http.MethodPut, "/v1/rules/"+url.PathEscape(id), input, &out)
	return out, err
}

func (c Client) DeleteRule(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/v1/rules/"+url.PathEscape(id), nil, nil)
}

func (c Client) ListTrustEntries(ctx context.Context) ([]mail.TrustEntry, error) {
	var out []mail.TrustEntry
	err := c.do(ctx, http.MethodGet, "/v1/trust/entries", nil, &out)
	return out, err
}

func (c Client) PutTrustEntry(ctx context.Context, input mail.TrustEntryInput) (mail.TrustEntry, error) {
	var out mail.TrustEntry
	err := c.do(ctx, http.MethodPut, "/v1/trust/entries", input, &out)
	return out, err
}

func (c Client) DeleteTrustEntry(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/v1/trust/entries/"+url.PathEscape(id), nil, nil)
}

func (c Client) GetTrustSettings(ctx context.Context) (mail.TrustSettings, error) {
	var out mail.TrustSettings
	err := c.do(ctx, http.MethodGet, "/v1/trust/settings", nil, &out)
	return out, err
}

func (c Client) UpdateTrustSettings(ctx context.Context, requireTrusted bool) (mail.TrustSettings, error) {
	var out mail.TrustSettings
	err := c.do(ctx, http.MethodPut, "/v1/trust/settings", mail.TrustSettingsInput{RequireTrusted: requireTrusted}, &out)
	return out, err
}

func (c Client) ListQuarantine(ctx context.Context) ([]mail.QuarantineRecord, error) {
	var out []mail.QuarantineRecord
	err := c.do(ctx, http.MethodGet, "/v1/quarantine", nil, &out)
	return out, err
}

func (c Client) ReleaseQuarantine(ctx context.Context, messageID string) (mail.MailboxState, error) {
	var out mail.MailboxState
	err := c.do(ctx, http.MethodPost, "/v1/quarantine/"+url.PathEscape(messageID)+"/release", nil, &out)
	return out, err
}

func (c Client) ReportAbuse(ctx context.Context, messageID string, kind mail.AbuseKind) (mail.AbuseReport, error) {
	var out mail.AbuseReport
	err := c.do(ctx, http.MethodPost, "/v1/messages/"+url.PathEscape(messageID)+"/abuse", mail.AbuseReportInput{Kind: kind}, &out)
	return out, err
}

func (c Client) GetSenderReputation(ctx context.Context, sender string) (mail.SenderReputation, error) {
	var out mail.SenderReputation
	err := c.do(ctx, http.MethodGet, "/v1/reputation/"+url.PathEscape(sender), nil, &out)
	return out, err
}

func (c Client) Reply(ctx context.Context, parentMessageID string, req mail.ReplyRequest) (mail.Message, error) {
	var out mail.Message
	err := c.do(ctx, http.MethodPost, "/v1/messages/"+url.PathEscape(parentMessageID)+"/reply", req, &out)
	return out, err
}

func (c Client) ListConversations(ctx context.Context) ([]mail.ConversationSummary, error) {
	var out []mail.ConversationSummary
	err := c.do(ctx, http.MethodGet, "/v1/conversations", nil, &out)
	return out, err
}

func (c Client) GetConversation(ctx context.Context, conversationID string) (mail.ConversationView, error) {
	var out mail.ConversationView
	err := c.do(ctx, http.MethodGet, "/v1/conversations/"+url.PathEscape(conversationID), nil, &out)
	return out, err
}

func (c Client) UpdateConversation(ctx context.Context, conversationID string, update mail.ConversationUpdate) (mail.ConversationState, error) {
	var out mail.ConversationState
	err := c.do(ctx, http.MethodPatch, "/v1/conversations/"+url.PathEscape(conversationID), update, &out)
	return out, err
}

func (c Client) CreateDraft(ctx context.Context, req mail.DraftCreateRequest) (mail.DraftView, error) {
	var out mail.DraftView
	err := c.do(ctx, http.MethodPost, "/v1/drafts", req, &out)
	return out, err
}

func (c Client) ListDrafts(ctx context.Context) ([]mail.Draft, error) {
	var out []mail.Draft
	err := c.do(ctx, http.MethodGet, "/v1/drafts", nil, &out)
	return out, err
}

func (c Client) GetDraft(ctx context.Context, draftID string) (mail.DraftView, error) {
	var out mail.DraftView
	err := c.do(ctx, http.MethodGet, "/v1/drafts/"+url.PathEscape(draftID), nil, &out)
	return out, err
}

func (c Client) SaveDraft(ctx context.Context, draftID string, req mail.DraftSaveRequest) (mail.DraftView, error) {
	var out mail.DraftView
	err := c.do(ctx, http.MethodPut, "/v1/drafts/"+url.PathEscape(draftID), req, &out)
	return out, err
}

func (c Client) DiscardDraft(ctx context.Context, draftID string, expectedVersion uint32) error {
	return c.do(ctx, http.MethodDelete, "/v1/drafts/"+url.PathEscape(draftID)+"?expected_version="+strconv.FormatUint(uint64(expectedVersion), 10), nil, nil)
}

func (c Client) QueueDelivery(ctx context.Context, req mail.SendRequest) (mail.Delivery, error) {
	var out mail.Delivery
	err := c.do(ctx, http.MethodPost, "/v1/outbox", req, &out)
	return out, err
}

func (c Client) ListOutbox(ctx context.Context) ([]mail.Delivery, error) {
	var out []mail.Delivery
	err := c.do(ctx, http.MethodGet, "/v1/outbox", nil, &out)
	return out, err
}

func (c Client) GetDelivery(ctx context.Context, id string) (mail.Delivery, error) {
	var out mail.Delivery
	err := c.do(ctx, http.MethodGet, "/v1/outbox/"+url.PathEscape(id), nil, &out)
	return out, err
}

func (c Client) ProcessDelivery(ctx context.Context, id string) (mail.Delivery, error) {
	var out mail.Delivery
	err := c.do(ctx, http.MethodPost, "/v1/outbox/"+url.PathEscape(id)+"/process", nil, &out)
	return out, err
}

func (c Client) RetryDelivery(ctx context.Context, id string) (mail.Delivery, error) {
	var out mail.Delivery
	err := c.do(ctx, http.MethodPost, "/v1/outbox/"+url.PathEscape(id)+"/retry", nil, &out)
	return out, err
}

func (c Client) CancelDelivery(ctx context.Context, id string) (mail.Delivery, error) {
	var out mail.Delivery
	err := c.do(ctx, http.MethodPost, "/v1/outbox/"+url.PathEscape(id)+"/cancel", nil, &out)
	return out, err
}

func (c Client) GoogleOnboarding(ctx context.Context, req mail.GoogleOnboardingRequest) (mail.OnboardingResult, error) {
	var out mail.OnboardingResult
	err := c.do(ctx, http.MethodPost, "/v1/onboarding/google", req, &out)
	return out, err
}

func (c Client) AppleOnboarding(ctx context.Context, req mail.AppleOnboardingRequest) (mail.OnboardingResult, error) {
	var out mail.OnboardingResult
	err := c.do(ctx, http.MethodPost, "/v1/onboarding/apple", req, &out)
	return out, err
}

func (c Client) PasskeyOnboarding(ctx context.Context, req mail.PasskeyOnboardingRequest) (mail.OnboardingResult, error) {
	var out mail.OnboardingResult
	err := c.do(ctx, http.MethodPost, "/v1/onboarding/passkey", req, &out)
	return out, err
}

func (c Client) ExistingWalletOnboarding(ctx context.Context, req mail.WalletOnboardingRequest) (mail.OnboardingResult, error) {
	var out mail.OnboardingResult
	err := c.do(ctx, http.MethodPost, "/v1/onboarding/wallet", req, &out)
	return out, err
}

func (c Client) SecurityState(ctx context.Context) (mail.SecurityState, error) {
	var out mail.SecurityState
	err := c.do(ctx, http.MethodGet, "/v1/security", nil, &out)
	return out, err
}

func (c Client) EnrollPasskey(ctx context.Context, req mail.PasskeyEnrollmentRequest) (mail.SecurityState, error) {
	var out mail.SecurityState
	err := c.do(ctx, http.MethodPost, "/v1/security/passkeys", req, &out)
	return out, err
}

func (c Client) RevokePasskey(ctx context.Context, id string) (mail.SecurityState, error) {
	var out mail.SecurityState
	err := c.do(ctx, http.MethodDelete, "/v1/security/passkeys/"+url.PathEscape(id), nil, &out)
	return out, err
}

func (c Client) EnrollDevice(ctx context.Context, req mail.DeviceEnrollmentRequest) (mail.SecurityState, error) {
	var out mail.SecurityState
	err := c.do(ctx, http.MethodPost, "/v1/security/devices", req, &out)
	return out, err
}

func (c Client) RevokeDevice(ctx context.Context, id string) (mail.SecurityState, error) {
	var out mail.SecurityState
	err := c.do(ctx, http.MethodDelete, "/v1/security/devices/"+url.PathEscape(id), nil, &out)
	return out, err
}

func (c Client) Recovery(ctx context.Context, req mail.RecoveryRequest) (mail.SecurityState, error) {
	var out mail.SecurityState
	err := c.do(ctx, http.MethodPost, "/v1/security/recovery", req, &out)
	return out, err
}

func (c Client) RevokeSession(ctx context.Context, id string) (mail.SecurityState, error) {
	var out mail.SecurityState
	err := c.do(ctx, http.MethodPost, "/v1/security/sessions/"+url.PathEscape(id)+"/revoke", nil, &out)
	return out, err
}

func (c Client) AcknowledgeSecurityAlert(ctx context.Context, id string) (mail.SecurityState, error) {
	var out mail.SecurityState
	err := c.do(ctx, http.MethodPost, "/v1/security/alerts/"+url.PathEscape(id)+"/ack", nil, &out)
	return out, err
}

func (c Client) PrepareWalletAction(ctx context.Context, req mail.WalletActionRequest) (mail.WalletHandoff, error) {
	var out mail.WalletHandoff
	err := c.do(ctx, http.MethodPost, "/v1/wallet/actions", req, &out)
	return out, err
}

func (c Client) VerifyWalletEvidence(ctx context.Context, req mail.WalletVerificationRequest) (mail.WalletVerification, error) {
	var out mail.WalletVerification
	err := c.do(ctx, http.MethodPost, "/v1/wallet/verifications", req, &out)
	return out, err
}

func (c Client) ConnectorProviders(ctx context.Context) ([]mail.ConnectorDescriptor, error) {
	var out []mail.ConnectorDescriptor
	err := c.do(ctx, http.MethodGet, "/v1/connectors/providers", nil, &out)
	return out, err
}

func (c Client) LinkConnector(ctx context.Context, req mail.ConnectorLinkRequest) (mail.ConnectorConnection, error) {
	var out mail.ConnectorConnection
	err := c.do(ctx, http.MethodPost, "/v1/connectors/link", req, &out)
	return out, err
}

func (c Client) UnlinkConnector(ctx context.Context, provider, connectionID string) error {
	req := map[string]string{"provider": provider, "connection_id": connectionID}
	return c.do(ctx, http.MethodPost, "/v1/connectors/unlink", req, nil)
}

func (c Client) PullConnector(ctx context.Context, req mail.ConnectorPullRequest) (mail.ConnectorPullResult, error) {
	var out mail.ConnectorPullResult
	err := c.do(ctx, http.MethodPost, "/v1/connectors/pull", req, &out)
	return out, err
}

func (c Client) PushConnector(ctx context.Context, req mail.ConnectorPushRequest) (mail.ConnectorPushResult, error) {
	var out mail.ConnectorPushResult
	err := c.do(ctx, http.MethodPost, "/v1/connectors/push", req, &out)
	return out, err
}
