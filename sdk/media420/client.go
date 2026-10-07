package media420

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	mediaapi "github.com/420integrated/420-integrated/media/api"
	mediasecurity "github.com/420integrated/420-integrated/media/security"
)

const APIVersion = mediaapi.Version

type Client struct {
	baseURL         string
	http            *http.Client
	expectedChainID uint64
	expectedNetwork string
	session         SessionTokenProvider
}

type SessionTokenProvider interface {
	Token(context.Context) (string, error)
}

type Config struct {
	BaseURL         string
	HTTPClient      *http.Client
	Timeout         time.Duration
	ExpectedChainID uint64
	ExpectedNetwork string
	Session         SessionTokenProvider
}

func New(config Config) (*Client, error) {
	base := strings.TrimRight(strings.TrimSpace(config.BaseURL), "/")
	u, err := url.Parse(base)
	if err != nil || u.Scheme == "" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return nil, invalid("invalid base URL")
	}
	host := u.Hostname()
	if u.Scheme != "https" && host != "localhost" && host != "127.0.0.1" && host != "::1" {
		return nil, invalid("non-loopback Media endpoint requires HTTPS")
	}
	if config.ExpectedChainID == 0 || strings.TrimSpace(config.ExpectedNetwork) == "" {
		return nil, invalid("expected chain and network are required")
	}
	hc := config.HTTPClient
	if hc == nil {
		timeout := config.Timeout
		if timeout <= 0 {
			timeout = 15 * time.Second
		}
		hc = &http.Client{Timeout: timeout}
	}
	return &Client{
		baseURL: base, http: hc,
		expectedChainID: config.ExpectedChainID,
		expectedNetwork: strings.TrimSpace(config.ExpectedNetwork),
		session:         config.Session,
	}, nil
}

type WalletSigner interface {
	Sign(context.Context, string) (signature string, err error)
}

type SignedIntent struct {
	Intent    mediaapi.SigningIntent `json:"intent"`
	Signature string                 `json:"signature"`
}

func (c *Client) Status(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	err := c.get(ctx, "/v1/status", &out)
	return out, err
}

func (c *Client) Capabilities(ctx context.Context) (mediaapi.Capabilities, error) {
	var out mediaapi.Capabilities
	err := c.get(ctx, "/v1/capabilities", &out)
	if err != nil {
		return out, err
	}
	if out.ServiceID != mediaapi.ServiceID || out.APIVersion != APIVersion ||
		out.Compatibility != mediaapi.CompatibilityMajor {
		return mediaapi.Capabilities{}, compatibility("unsupported Media capabilities")
	}
	return out, nil
}

func (c *Client) Compatibility(ctx context.Context) (mediaapi.Compatibility, error) {
	var out mediaapi.Compatibility
	err := c.get(ctx, "/v1/compatibility", &out)
	if err != nil {
		return out, err
	}
	if err := c.validateCompatibility(out); err != nil {
		return mediaapi.Compatibility{}, err
	}
	return out, nil
}

func (c *Client) Assets(ctx context.Context, cursor string, limit int) (mediaapi.Page[mediaapi.Asset], error) {
	var out mediaapi.Page[mediaapi.Asset]
	path, err := pagePath("/v1/assets", cursor, limit)
	if err != nil {
		return out, err
	}
	err = c.get(ctx, path, &out)
	return out, err
}

func (c *Client) Asset(ctx context.Context, id string) (mediaapi.Asset, error) {
	var out mediaapi.Asset
	id = strings.TrimSpace(id)
	if id == "" {
		return out, invalid("asset id is required")
	}
	err := c.get(ctx, "/v1/assets/"+url.PathEscape(id), &out)
	return out, err
}

func (c *Client) PrepareUpload(
	ctx context.Context,
	req mediaapi.PrepareUploadRequest,
	idempotencyKey string,
) (mediaapi.UploadPlan, error) {
	var out mediaapi.UploadPlan
	if err := c.ensureCompatibility(ctx); err != nil {
		return out, err
	}
	err := c.write(ctx, http.MethodPost, "/v1/uploads/prepare", req, idempotencyKey, &out)
	return out, err
}

func (c *Client) CreateLivestream(
	ctx context.Context,
	req mediaapi.CreateLivestreamRequest,
	idempotencyKey string,
) (mediaapi.Livestream, error) {
	var out mediaapi.Livestream
	if err := c.ensureCompatibility(ctx); err != nil {
		return out, err
	}
	err := c.write(ctx, http.MethodPost, "/v1/livestreams", req, idempotencyKey, &out)
	return out, err
}

func (c *Client) Livestream(ctx context.Context, id, controller string) (mediaapi.Livestream, error) {
	var out mediaapi.Livestream
	id = strings.TrimSpace(id)
	controller = strings.TrimSpace(controller)
	if id == "" || controller == "" {
		return out, invalid("livestream id and controller are required")
	}
	path := "/v1/livestreams/" + url.PathEscape(id) + "?controller=" + url.QueryEscape(controller)
	err := c.get(ctx, path, &out)
	return out, err
}

func (c *Client) StartLivestream(
	ctx context.Context,
	id string,
	req mediaapi.LivestreamActionRequest,
	idempotencyKey string,
) (mediaapi.Livestream, error) {
	return c.livestreamAction(ctx, "start", id, req, idempotencyKey)
}

func (c *Client) StopLivestream(
	ctx context.Context,
	id string,
	req mediaapi.LivestreamActionRequest,
	idempotencyKey string,
) (mediaapi.Livestream, error) {
	return c.livestreamAction(ctx, "stop", id, req, idempotencyKey)
}

func (c *Client) livestreamAction(
	ctx context.Context,
	action, id string,
	req mediaapi.LivestreamActionRequest,
	idempotencyKey string,
) (mediaapi.Livestream, error) {
	var out mediaapi.Livestream
	id = strings.TrimSpace(id)
	if id == "" {
		return out, invalid("livestream id is required")
	}
	if err := c.ensureCompatibility(ctx); err != nil {
		return out, err
	}
	err := c.write(
		ctx, http.MethodPost,
		"/v1/livestreams/"+url.PathEscape(id)+"/"+action,
		req, idempotencyKey, &out,
	)
	return out, err
}

func (c *Client) Search(ctx context.Context, cursor string, limit int) (mediaapi.Page[mediaapi.SearchItem], error) {
	var out mediaapi.Page[mediaapi.SearchItem]
	path, err := pagePath("/v1/search", cursor, limit)
	if err != nil {
		return out, err
	}
	err = c.get(ctx, path, &out)
	return out, err
}

func (c *Client) CreateSubscription(
	ctx context.Context,
	req mediaapi.CreateSubscriptionRequest,
	idempotencyKey string,
) (mediaapi.Subscription, error) {
	var out mediaapi.Subscription
	if err := c.ensureCompatibility(ctx); err != nil {
		return out, err
	}
	err := c.write(ctx, http.MethodPost, "/v1/notifications/subscriptions", req, idempotencyKey, &out)
	return out, err
}

func (c *Client) DeleteSubscription(
	ctx context.Context,
	id, userRef, idempotencyKey string,
) error {
	if err := c.ensureCompatibility(ctx); err != nil {
		return err
	}
	id = strings.TrimSpace(id)
	userRef = strings.TrimSpace(userRef)
	if id == "" || userRef == "" {
		return invalid("subscription id and user_ref are required")
	}
	path := "/v1/notifications/subscriptions/" + url.PathEscape(id) + "?user_ref=" + url.QueryEscape(userRef)
	var out map[string]any
	return c.write(ctx, http.MethodDelete, path, nil, idempotencyKey, &out)
}

func (c *Client) ReportMedia(
	ctx context.Context,
	report mediasecurity.Report,
	idempotencyKey string,
) (mediasecurity.Report, error) {
	var out mediasecurity.Report
	if err := c.ensureCompatibility(ctx); err != nil {
		return out, err
	}
	err := c.write(ctx, http.MethodPost, "/v1/moderation/reports", report, idempotencyKey, &out)
	return out, err
}

func (c *Client) DecideReport(
	ctx context.Context,
	reportID string,
	decision mediasecurity.Decision,
	idempotencyKey string,
) (mediasecurity.Decision, error) {
	var out mediasecurity.Decision
	reportID = strings.TrimSpace(reportID)
	if reportID == "" {
		return out, invalid("report id is required")
	}
	if err := c.ensureCompatibility(ctx); err != nil {
		return out, err
	}
	err := c.write(ctx, http.MethodPost, "/v1/moderation/reports/"+url.PathEscape(reportID)+"/decisions", decision, idempotencyKey, &out)
	return out, err
}

func (c *Client) AppealDecision(
	ctx context.Context,
	decisionID string,
	appeal mediasecurity.Appeal,
	idempotencyKey string,
) (mediasecurity.Appeal, error) {
	var out mediasecurity.Appeal
	decisionID = strings.TrimSpace(decisionID)
	if decisionID == "" {
		return out, invalid("decision id is required")
	}
	if err := c.ensureCompatibility(ctx); err != nil {
		return out, err
	}
	err := c.write(ctx, http.MethodPost, "/v1/moderation/decisions/"+url.PathEscape(decisionID)+"/appeals", appeal, idempotencyKey, &out)
	return out, err
}

func (c *Client) SigningIntent(
	ctx context.Context,
	req mediaapi.SigningIntentRequest,
	idempotencyKey string,
) (mediaapi.SigningIntent, error) {
	var out mediaapi.SigningIntent
	if req.ChainID != c.expectedChainID || strings.TrimSpace(req.Network) != c.expectedNetwork {
		return out, compatibility("signing request chain/network mismatch")
	}
	if err := c.ensureCompatibility(ctx); err != nil {
		return out, err
	}
	err := c.write(ctx, http.MethodPost, "/v1/signing/intents", req, idempotencyKey, &out)
	if err != nil {
		return out, err
	}
	if out.Domain != mediaapi.SigningDomain || out.ChainID != c.expectedChainID ||
		out.Network != c.expectedNetwork || strings.TrimSpace(out.Message) == "" {
		return mediaapi.SigningIntent{}, compatibility("invalid signing intent")
	}
	return out, nil
}

func (c *Client) PrepareAndSign(
	ctx context.Context,
	req mediaapi.SigningIntentRequest,
	idempotencyKey string,
	signer WalletSigner,
) (SignedIntent, error) {
	if signer == nil {
		return SignedIntent{}, invalid("wallet signer is required")
	}
	intent, err := c.SigningIntent(ctx, req, idempotencyKey)
	if err != nil {
		return SignedIntent{}, err
	}
	signature, err := signer.Sign(ctx, intent.Message)
	if err != nil {
		return SignedIntent{}, &Error{Kind: ErrorTransport, Detail: "wallet signing failed", Err: err}
	}
	if strings.TrimSpace(signature) == "" {
		return SignedIntent{}, invalid("wallet signer returned empty signature")
	}
	return SignedIntent{Intent: intent, Signature: signature}, nil
}

func (c *Client) ensureCompatibility(ctx context.Context) error {
	_, err := c.Compatibility(ctx)
	return err
}

func (c *Client) validateCompatibility(out mediaapi.Compatibility) error {
	if out.ServiceID != mediaapi.ServiceID || out.APIVersion != APIVersion ||
		out.CompatibilityMajor != mediaapi.CompatibilityMajor ||
		out.MinimumClientMajor > mediaapi.CompatibilityMajor {
		return compatibility("unsupported Media API compatibility")
	}
	if out.ChainID != 0 && out.ChainID != c.expectedChainID {
		return compatibility("Media API chain mismatch")
	}
	if strings.TrimSpace(out.Network) != "" && out.Network != c.expectedNetwork {
		return compatibility("Media API network mismatch")
	}
	return nil
}

func (c *Client) get(ctx context.Context, path string, out any) error {
	return c.do(ctx, http.MethodGet, path, nil, "", out)
}

func (c *Client) write(
	ctx context.Context,
	method, path string,
	body any,
	idempotencyKey string,
	out any,
) error {
	idempotencyKey = strings.TrimSpace(idempotencyKey)
	if idempotencyKey == "" || len(idempotencyKey) > 128 {
		return invalid("valid idempotency key is required")
	}
	return c.do(ctx, method, path, body, idempotencyKey, out)
}

func (c *Client) do(
	ctx context.Context,
	method, path string,
	body any,
	idempotencyKey string,
	out any,
) error {
	if c == nil || c.http == nil {
		return &Error{Kind: ErrorTransport, Detail: "nil Media client"}
	}
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return &Error{Kind: ErrorInvalidRequest, Detail: "encode request", Err: err}
		}
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return &Error{Kind: ErrorTransport, Detail: "create request", Err: err}
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if idempotencyKey != "" {
		req.Header.Set("Idempotency-Key", idempotencyKey)
	}
	if c.session != nil {
		token, err := c.session.Token(ctx)
		if err != nil {
			return &Error{Kind: ErrorUnauthorized, Detail: "session token unavailable", Err: err}
		}
		token = strings.TrimSpace(token)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return &Error{Kind: ErrorTransport, Err: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return decodeHTTPError(resp)
	}
	if !strings.HasPrefix(resp.Header.Get("Content-Type"), "application/json") {
		return &Error{Kind: ErrorDecode, Detail: "unexpected Media response content type"}
	}
	decoder := json.NewDecoder(io.LimitReader(resp.Body, mediaapi.MaxResponseBytes+1))
	var env mediaapi.Envelope[json.RawMessage]
	if err := decoder.Decode(&env); err != nil {
		return &Error{Kind: ErrorDecode, Detail: "decode response envelope", Err: err}
	}
	if env.Version != APIVersion {
		return compatibility("unsupported Media response version")
	}
	if out == nil {
		return nil
	}
	if err := json.Unmarshal(env.Data, out); err != nil {
		return &Error{Kind: ErrorDecode, Detail: "decode response data", Err: err}
	}
	return nil
}

func decodeHTTPError(resp *http.Response) error {
	payload, err := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if err != nil {
		return &Error{Kind: ErrorTransport, StatusCode: resp.StatusCode, Err: err}
	}
	var env mediaapi.ErrorEnvelope
	_ = json.Unmarshal(payload, &env)
	kind := errorKind(env.Error.Code)
	detail := strings.TrimSpace(env.Error.Message)
	if detail == "" {
		detail = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}
	return &Error{
		Kind: kind, StatusCode: resp.StatusCode,
		Code: env.Error.Code, Detail: detail,
	}
}

func errorKind(code mediaapi.ErrorCode) ErrorKind {
	switch code {
	case mediaapi.CodeInvalidRequest:
		return ErrorInvalidRequest
	case mediaapi.CodeUnauthorized:
		return ErrorUnauthorized
	case mediaapi.CodeForbidden:
		return ErrorForbidden
	case mediaapi.CodeNotFound:
		return ErrorNotFound
	case mediaapi.CodeConflict:
		return ErrorConflict
	case mediaapi.CodeIdempotencyConflict:
		return ErrorIdempotencyConflict
	case mediaapi.CodeRateLimited:
		return ErrorRateLimited
	case mediaapi.CodeUnavailable:
		return ErrorUnavailable
	case mediaapi.CodeUnsupportedVersion:
		return ErrorCompatibility
	default:
		return ErrorTransport
	}
}

func pagePath(base, cursor string, limit int) (string, error) {
	if limit < 1 || limit > mediaapi.MaxPageLimit {
		return "", invalid("limit must be between 1 and 200")
	}
	cursor = strings.TrimSpace(cursor)
	if len(cursor) > 512 {
		return "", invalid("cursor is too long")
	}
	values := url.Values{"limit": {strconv.Itoa(limit)}}
	if cursor != "" {
		values.Set("cursor", cursor)
	}
	return base + "?" + values.Encode(), nil
}

func invalid(detail string) error {
	return &Error{Kind: ErrorInvalidRequest, Detail: detail}
}

func compatibility(detail string) error {
	return &Error{Kind: ErrorCompatibility, Detail: detail}
}
