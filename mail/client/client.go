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
	var ignored any
	return c.do(ctx, http.MethodDelete, "/v1/messages/"+url.PathEscape(id), nil, &ignored)
}
