package projection

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
)

const SchemaVersion = "420-reputation-public-projection-v1"

type Document struct {
	Schema                string
	ID                    string
	Domain                model.Domain
	Subject               model.SubjectRef
	PolicyVersion         string
	VisibleReviewCount    uint64
	VerifiedReviewCount   uint64
	UnverifiedReviewCount uint64
	ResponseCount         uint64
	ModeratedReviewCount  uint64
	RatingDistribution    model.RatingDistribution
	AverageRating         float64
	UpdatedAt             time.Time
	Source                 string
	Authoritative          bool
}

func StableID(domain model.Domain, subject model.SubjectRef) (string, error) {
	if !model.ValidDomain(domain) {
		return "", errors.New("projection domain is invalid")
	}
	if err := subject.Validate(); err != nil {
		return "", err
	}
	material := strings.Join([]string{
		SchemaVersion,
		string(domain),
		strings.ToUpper(strings.TrimSpace(subject.Type)),
		strings.TrimSpace(subject.ID),
	}, "|")
	sum := sha256.Sum256([]byte(material))
	return "rep_" + hex.EncodeToString(sum[:]), nil
}

func (d Document) Validate() error {
	if d.Schema != SchemaVersion {
		return errors.New("projection schema is invalid")
	}
	expected, err := StableID(d.Domain, d.Subject)
	if err != nil {
		return err
	}
	if d.ID != expected {
		return errors.New("projection id is unstable or forged")
	}
	if strings.TrimSpace(d.PolicyVersion) == "" {
		return errors.New("projection policy version is required")
	}
	if strings.TrimSpace(d.Source) == "" {
		return errors.New("projection source is required")
	}
	if d.Authoritative {
		return errors.New("public reputation projection must remain non-authoritative")
	}
	if d.VerifiedReviewCount+d.UnverifiedReviewCount != d.VisibleReviewCount {
		return errors.New("projection visible review counts are inconsistent")
	}
	dist := d.RatingDistribution.One+d.RatingDistribution.Two+d.RatingDistribution.Three+d.RatingDistribution.Four+d.RatingDistribution.Five
	if dist != d.VisibleReviewCount {
		return errors.New("projection rating distribution is inconsistent")
	}
	if d.VisibleReviewCount == 0 && d.AverageRating != 0 {
		return errors.New("empty projection average must be zero")
	}
	return nil
}
