package storage420

import (
	"context"
	"errors"
	"fmt"
	"time"
)

type ErrorKind string

const (
	ErrorInvalidRequest ErrorKind = "invalid_request"
	ErrorUnauthorized   ErrorKind = "unauthorized"
	ErrorUnavailable    ErrorKind = "unavailable"
	ErrorIntegrity      ErrorKind = "integrity"
	ErrorTransport      ErrorKind = "transport"
	ErrorUnsupported    ErrorKind = "unsupported"
)

type Error struct {
	Kind       ErrorKind
	StatusCode int
	Code       string
	Detail     string
	Err        error
}

func (e *Error) Error() string {
	if e == nil { return "" }
	if e.Detail != "" { return fmt.Sprintf("storage420 %s: %s", e.Kind, e.Detail) }
	if e.Err != nil { return fmt.Sprintf("storage420 %s: %v", e.Kind, e.Err) }
	return "storage420 " + string(e.Kind)
}
func (e *Error) Unwrap() error { if e == nil { return nil }; return e.Err }

type Transport interface {
	Retrieve(context.Context, RetrieveRequest) (RetrieveResult, error)
	PrepareUpload(context.Context, UploadPrepareRequest) (UploadPlan, error)
	Discover(context.Context, DiscoveryRequest) (DiscoveryResult, error)
	Status(context.Context) (ResourceStatus, error)
}

type RetryPolicy struct {
	MaxAttempts int
	BaseDelay   time.Duration
}

func DefaultRetryPolicy() RetryPolicy { return RetryPolicy{MaxAttempts: 3, BaseDelay: 100 * time.Millisecond} }

type Client struct {
	Transport Transport
	Retry     RetryPolicy
}

func NewClient(transport Transport) *Client {
	return &Client{Transport: transport, Retry: DefaultRetryPolicy()}
}

func (c *Client) Retrieve(ctx context.Context, req RetrieveRequest) (RetrieveResult, error) {
	if c == nil || c.Transport == nil { return RetrieveResult{}, &Error{Kind: ErrorTransport, Detail: "nil transport"} }
	var out RetrieveResult
	err := c.retry(ctx, func() error { var err error; out, err = c.Transport.Retrieve(ctx, normalizeRetrieve(req)); return err })
	return out, err
}

func (c *Client) PrepareUpload(ctx context.Context, req UploadPrepareRequest) (UploadPlan, error) {
	if c == nil || c.Transport == nil { return UploadPlan{}, &Error{Kind: ErrorTransport, Detail: "nil transport"} }
	if req.IdempotencyKey == "" { return UploadPlan{}, &Error{Kind: ErrorInvalidRequest, Detail: "idempotency key required"} }
	if req.Version == "" { req.Version = APIVersion }
	var out UploadPlan
	err := c.retry(ctx, func() error { var err error; out, err = c.Transport.PrepareUpload(ctx, req); return err })
	return out, err
}

func (c *Client) Discover(ctx context.Context, req DiscoveryRequest) (DiscoveryResult, error) {
	if c == nil || c.Transport == nil { return DiscoveryResult{}, &Error{Kind: ErrorTransport, Detail: "nil transport"} }
	if req.Version == "" { req.Version = APIVersion }
	var out DiscoveryResult
	err := c.retry(ctx, func() error { var err error; out, err = c.Transport.Discover(ctx, req); return err })
	return out, err
}

func (c *Client) Status(ctx context.Context) (ResourceStatus, error) {
	if c == nil || c.Transport == nil { return ResourceStatus{}, &Error{Kind: ErrorTransport, Detail: "nil transport"} }
	var out ResourceStatus
	err := c.retry(ctx, func() error { var err error; out, err = c.Transport.Status(ctx); return err })
	return out, err
}

func normalizeRetrieve(req RetrieveRequest) RetrieveRequest {
	if req.Version == "" { req.Version = APIVersion }
	if req.Access.Mode == "" { req.Access.Mode = AccessPublic }
	return req
}

func (c *Client) retry(ctx context.Context, fn func() error) error {
	policy := c.Retry
	if policy.MaxAttempts <= 0 { policy = DefaultRetryPolicy() }
	if policy.BaseDelay < 0 { policy.BaseDelay = 0 }
	var last error
	for attempt := 1; attempt <= policy.MaxAttempts; attempt++ {
		if err := ctx.Err(); err != nil { return err }
		last = fn()
		if last == nil || !retryable(last) || attempt == policy.MaxAttempts { return last }
		delay := policy.BaseDelay * time.Duration(attempt)
		if delay == 0 { continue }
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done(): timer.Stop(); return ctx.Err()
		case <-timer.C:
		}
	}
	return last
}

func retryable(err error) bool {
	var typed *Error
	if !errors.As(err, &typed) { return false }
	return typed.Kind == ErrorUnavailable || typed.Kind == ErrorTransport
}
