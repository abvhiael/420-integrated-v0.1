package reeferreview

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"path"
	"sort"
	"strings"
	"time"

	mail420 "github.com/420integrated/420-integrated/mail"
	notifyarch "github.com/420integrated/420-integrated/notifications/architecture"
	searcharch "github.com/420integrated/420-integrated/search/architecture"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

var (
	ErrIntegrationConfiguration = errors.New("reefer review: ecosystem integration configuration invalid")
	ErrProjectionNotPublic      = errors.New("reefer review: publication not eligible for public projection")
	ErrNotificationReceipt      = errors.New("reefer review: invalid 420Notifications receipt")
)

const (
	ReeferSearchCategory = "reefer_review_article"
	ReeferSearchPrefix   = "reefer-review:"
)

type SearchProjectionWriter interface {
	UpsertSearchResult(context.Context, searchresult.Result) error
	DeleteSearchResult(context.Context, string) error
	ListSearchResults(context.Context) ([]searchresult.Result, error)
}

type Search420Adapter struct {
	Writer         SearchProjectionWriter
	ArticleBaseURL string
	Now            func() time.Time
}

type SearchReconcileReport struct {
	Desired int
	Upserts int
	Deletes int
}

func (a Search420Adapter) now() time.Time {
	if a.Now != nil {
		return a.Now().UTC()
	}
	return time.Now().UTC()
}

func (a Search420Adapter) articleURL(id string) (string, error) {
	base := strings.TrimSpace(a.ArticleBaseURL)
	if base == "" {
		return "", ErrIntegrationConfiguration
	}
	u, err := url.Parse(base)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Hostname() == "" || u.User != nil {
		return "", ErrIntegrationConfiguration
	}
	u.Path = path.Join(strings.TrimSuffix(u.Path, "/"), "articles", strings.TrimSpace(id))
	u.RawQuery = ""
	u.Fragment = ""
	return u.String(), nil
}

func (a Search420Adapter) buildResult(p Publication) (searchresult.Result, error) {
	if a.Writer == nil {
		return searchresult.Result{}, ErrIntegrationConfiguration
	}
	if p.Status != StatusPublished || p.Visibility != VisibilityPublic || strings.TrimSpace(p.ID) == "" ||
		strings.TrimSpace(p.Title) == "" || p.RightsProvenance == nil {
		return searchresult.Result{}, ErrProjectionNotPublic
	}
	rp := p.RightsProvenance
	if rp.ServiceID != RightsServiceID || rp.ChainID == 0 || strings.TrimSpace(rp.RightID) == "" ||
		strings.TrimSpace(rp.ClaimID) == "" || strings.TrimSpace(rp.BodyDigest) == "" ||
		!strings.EqualFold(rp.BodyDigest, p.BodyDigest) {
		return searchresult.Result{}, ErrProjectionNotPublic
	}
	canonicalURL, err := a.articleURL(p.ID)
	if err != nil {
		return searchresult.Result{}, err
	}
	var blockNumber *uint64
	if rp.BlockNumber > 0 {
		v := rp.BlockNumber
		blockNumber = &v
	}
	result, err := searchresult.New(
		searcharch.DomainAsset,
		ReeferSearchPrefix+strings.ToLower(strings.TrimSpace(p.ID)),
		searcharch.SearchModeDiscovery,
		searchresult.Provenance{
			Source:      searcharch.SourceRights,
			Authority:   "ReeferReview PUBLIC publication derived from qualified 420Rights provenance; ReeferReview remains publication authority",
			ChainID:     rp.ChainID,
			BlockNumber: blockNumber,
			BlockHash:   strings.ToLower(strings.TrimSpace(rp.BlockHash)),
			Finality:    searchresult.FinalityUnknown,
			IndexedAt:   a.now(),
		},
		searchresult.Presentation{
			Title:        strings.TrimSpace(p.Title),
			Subtitle:     strings.TrimSpace(p.Author),
			Snippet:      strings.TrimSpace(p.Summary),
			Category:     ReeferSearchCategory,
			CanonicalURL: canonicalURL,
			Tags:         []string{"reefer-review", "article"},
		},
	)
	if err != nil {
		return searchresult.Result{}, err
	}
	if err := result.Validate(); err != nil {
		return searchresult.Result{}, err
	}
	return result, nil
}

func (a Search420Adapter) Upsert(ctx context.Context, p Publication) error {
	result, err := a.buildResult(p)
	if err != nil {
		return err
	}
	return a.Writer.UpsertSearchResult(ctx, result)
}

func (a Search420Adapter) Delete(ctx context.Context, publicationID string) error {
	if a.Writer == nil || strings.TrimSpace(publicationID) == "" {
		return ErrIntegrationConfiguration
	}
	id, err := searchresult.StableID(
		searcharch.DomainAsset,
		searcharch.SourceRights,
		ReeferSearchPrefix+strings.ToLower(strings.TrimSpace(publicationID)),
	)
	if err != nil {
		return err
	}
	return a.Writer.DeleteSearchResult(ctx, id)
}

func (a Search420Adapter) Reconcile(ctx context.Context, store Store) (SearchReconcileReport, error) {
	if a.Writer == nil || store == nil {
		return SearchReconcileReport{}, ErrIntegrationConfiguration
	}
	all, err := store.ListAll(ctx)
	if err != nil {
		return SearchReconcileReport{}, err
	}
	report := SearchReconcileReport{}
	desired := map[string]struct{}{}
	var errs []error
	for _, p := range all {
		if p.Status != StatusPublished || p.Visibility != VisibilityPublic {
			continue
		}
		result, buildErr := a.buildResult(p)
		if buildErr != nil {
			errs = append(errs, fmt.Errorf("search projection %s: %w", p.ID, buildErr))
			continue
		}
		desired[result.ID] = struct{}{}
		report.Desired++
		if err := a.Writer.UpsertSearchResult(ctx, result); err != nil {
			errs = append(errs, fmt.Errorf("search upsert %s: %w", p.ID, err))
			continue
		}
		report.Upserts++
	}
	actual, err := a.Writer.ListSearchResults(ctx)
	if err != nil {
		errs = append(errs, err)
		return report, errors.Join(errs...)
	}
	sort.Slice(actual, func(i, j int) bool { return actual[i].ID < actual[j].ID })
	for _, item := range actual {
		if item.Presentation.Category != ReeferSearchCategory || !strings.HasPrefix(strings.ToLower(item.SourceKey), ReeferSearchPrefix) {
			continue
		}
		if _, ok := desired[item.ID]; ok {
			continue
		}
		if err := a.Writer.DeleteSearchResult(ctx, item.ID); err != nil {
			errs = append(errs, fmt.Errorf("search delete %s: %w", item.ID, err))
			continue
		}
		report.Deletes++
	}
	return report, errors.Join(errs...)
}

type NotificationPublishRequest struct {
	TargetService  string
	EventID        string
	SourceService  string
	PublicationID  string
	Revision       int
	Title          string
	CanonicalURL   string
	RightsClaim    string
	ChainID        uint64
	BlockNumber    uint64
	BlockHash      string
	IdempotencyKey string
}

type NotificationPublishReceipt struct {
	DeliveryID string
	AcceptedAt time.Time
	Accepted   bool
	Suppressed bool
}

type NotificationPublishAuthority interface {
	PublishReeferReview(context.Context, NotificationPublishRequest) (NotificationPublishReceipt, error)
}

type Notifications420Adapter struct {
	Authority      NotificationPublishAuthority
	ArticleBaseURL string
}

func (a Notifications420Adapter) Published(ctx context.Context, p Publication) error {
	if a.Authority == nil {
		return ErrIntegrationConfiguration
	}
	searchAdapter := Search420Adapter{Writer: discardSearchWriter{}, ArticleBaseURL: a.ArticleBaseURL}
	if _, err := searchAdapter.buildResult(p); err != nil {
		return err
	}
	canonicalURL, err := searchAdapter.articleURL(p.ID)
	if err != nil {
		return err
	}
	req := NotificationPublishRequest{
		TargetService:  notifyarch.ServiceID,
		EventID:        fmt.Sprintf("reefer-review:%s:revision:%d", p.ID, p.Revision),
		SourceService:  ServiceID,
		PublicationID:  p.ID,
		Revision:       p.Revision,
		Title:          strings.TrimSpace(p.Title),
		CanonicalURL:   canonicalURL,
		RightsClaim:    p.RightsClaim,
		ChainID:        p.RightsProvenance.ChainID,
		BlockNumber:    p.RightsProvenance.BlockNumber,
		BlockHash:      p.RightsProvenance.BlockHash,
		IdempotencyKey: integrationKey("notifications", p.ID, p.Revision, ""),
	}
	receipt, err := a.Authority.PublishReeferReview(ctx, req)
	if err != nil {
		return err
	}
	receipt.DeliveryID = strings.TrimSpace(receipt.DeliveryID)
	if receipt.Accepted == receipt.Suppressed {
		return ErrNotificationReceipt
	}
	if receipt.Accepted {
		if receipt.DeliveryID == "" || receipt.AcceptedAt.IsZero() {
			return ErrNotificationReceipt
		}
		return nil
	}
	if receipt.DeliveryID != "" || !receipt.AcceptedAt.IsZero() {
		return ErrNotificationReceipt
	}
	return nil
}

type discardSearchWriter struct{}

func (discardSearchWriter) UpsertSearchResult(context.Context, searchresult.Result) error { return nil }
func (discardSearchWriter) DeleteSearchResult(context.Context, string) error              { return nil }
func (discardSearchWriter) ListSearchResults(context.Context) ([]searchresult.Result, error) {
	return nil, nil
}

type MailSender interface {
	Send(context.Context, mail420.SendRequest) (mail420.Message, error)
}

type MailAudience interface {
	Recipients(context.Context, Publication) ([]string, error)
}

type Mail420Adapter struct {
	Sender         MailSender
	Audience       MailAudience
	FromIdentity   string
	ArticleBaseURL string
}

func (a Mail420Adapter) Published(ctx context.Context, p Publication) error {
	if a.Sender == nil || a.Audience == nil || strings.TrimSpace(a.FromIdentity) == "" {
		return ErrIntegrationConfiguration
	}
	if p.Status != StatusPublished || p.Visibility != VisibilityPublic {
		return ErrProjectionNotPublic
	}
	canonicalURL, err := (Search420Adapter{Writer: discardSearchWriter{}, ArticleBaseURL: a.ArticleBaseURL}).articleURL(p.ID)
	if err != nil {
		return err
	}
	recipients, err := a.Audience.Recipients(ctx, p)
	if err != nil {
		return err
	}
	unique := map[string]struct{}{}
	for _, recipient := range recipients {
		recipient = strings.TrimSpace(recipient)
		if recipient != "" {
			unique[recipient] = struct{}{}
		}
	}
	ordered := make([]string, 0, len(unique))
	for recipient := range unique {
		ordered = append(ordered, recipient)
	}
	sort.Strings(ordered)
	var errs []error
	for _, recipient := range ordered {
		req := mail420.SendRequest{
			IdempotencyKey: integrationKey("mail", p.ID, p.Revision, recipient),
			Sender:         strings.TrimSpace(a.FromIdentity),
			Recipient:      recipient,
			Subject:        "Reefer Review: " + strings.TrimSpace(p.Title),
			Body:           strings.TrimSpace(p.Summary) + "\n\n" + canonicalURL,
			Source:         mail420.ServiceID,
		}
		if strings.TrimSpace(req.Body) == canonicalURL {
			req.Body = canonicalURL
		}
		if _, err := a.Sender.Send(ctx, req); err != nil {
			errs = append(errs, fmt.Errorf("420Mail recipient %s: %w", recipient, err))
		}
	}
	return errors.Join(errs...)
}

func integrationKey(kind, publicationID string, revision int, subject string) string {
	material := strings.Join([]string{
		"420/REEFER-REVIEW/INTEGRATION/V1",
		strings.ToLower(strings.TrimSpace(kind)),
		strings.ToLower(strings.TrimSpace(publicationID)),
		fmt.Sprint(revision),
		strings.ToLower(strings.TrimSpace(subject)),
	}, "\x00")
	sum := sha256.Sum256([]byte(material))
	return "reefer-" + strings.ToLower(strings.TrimSpace(kind)) + "-" + hex.EncodeToString(sum[:])
}
