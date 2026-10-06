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
