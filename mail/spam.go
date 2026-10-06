package mail

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"
)

// MAIL-2.7 thresholds are deterministic repository policy; later operational
// rate limiting remains owned by the dedicated abuse-controls roadmap step.
const (
	MaxQuarantineReasons    = 8
	MaxFingerprintCount     = 1000000
	SpamReputationThreshold = 3
	DuplicateSpamThreshold  = 4
	PhishingQuarantineScore = 3
)

type AbuseKind string
type QuarantineStatus string

const (
	AbuseSpam     AbuseKind = "SPAM"
	AbusePhishing AbuseKind = "PHISHING"

	QuarantineActive   QuarantineStatus = "QUARANTINED"
	QuarantineReleased QuarantineStatus = "RELEASED"
)

var (
	ErrAbuseReportConflict = errors.New("mail: abuse report already exists with different classification")
	ErrQuarantineReview    = errors.New("mail: quarantined message requires explicit review")
)

type SenderReputation struct {
	Owner           string    `json:"owner"`
	Sender          string    `json:"sender"`
	Deliveries      uint64    `json:"deliveries"`
	Quarantines     uint64    `json:"quarantines"`
	SpamReports     uint64    `json:"spam_reports"`
	PhishingReports uint64    `json:"phishing_reports"`
	FalsePositives  uint64    `json:"false_positives"`
	RiskScore       int       `json:"risk_score"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type AbuseReport struct {
	ID        string    `json:"id"`
	Owner     string    `json:"owner"`
	MessageID string    `json:"message_id"`
	Sender    string    `json:"sender"`
	Kind      AbuseKind `json:"kind"`
	CreatedAt time.Time `json:"created_at"`
}

type QuarantineRecord struct {
	Owner         string           `json:"owner"`
	MessageID     string           `json:"message_id"`
	Sender        string           `json:"sender"`
	Status        QuarantineStatus `json:"status"`
	Reasons       []string         `json:"reasons"`
	SpamScore     int              `json:"spam_score"`
	PhishingScore int              `json:"phishing_score"`
	CreatedAt     time.Time        `json:"created_at"`
	UpdatedAt     time.Time        `json:"updated_at"`
	ReleasedAt    *time.Time       `json:"released_at,omitempty"`
}

type AbuseReportInput struct {
	Kind AbuseKind `json:"kind"`
}

type spamDecision struct {
	Quarantine    bool
	SpamScore     int
	PhishingScore int
	Reasons       []string
}

var urlPattern = regexp.MustCompile(`(?i)https?://[^\s<>"']+`)

func (s *Service) ListQuarantine(ctx context.Context, actor string) ([]QuarantineRecord, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return nil, ErrUnauthorized
	}
	out := make([]QuarantineRecord, 0)
	err := s.Store.View(ctx, func(data *storeData) error {
		for _, record := range data.Quarantine {
			if record.Owner == actor && record.Status == QuarantineActive {
				record.Reasons = append([]string(nil), record.Reasons...)
				out = append(out, record)
			}
		}
		return nil
	})
	sort.Slice(out, func(i, j int) bool {
		if out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].MessageID < out[j].MessageID
		}
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out, err
}

func (s *Service) GetSenderReputation(ctx context.Context, actor, sender string) (SenderReputation, error) {
	actor = strings.TrimSpace(actor)
	sender = strings.ToLower(strings.TrimSpace(sender))
	if actor == "" {
		return SenderReputation{}, ErrUnauthorized
	}
	if sender == "" {
		return SenderReputation{}, ErrInvalidInput
	}
	out := SenderReputation{Owner: actor, Sender: sender}
	err := s.Store.View(ctx, func(data *storeData) error {
		if current, ok := data.Reputation[reputationKey(actor, sender)]; ok {
			out = current
		}
		return nil
	})
	return out, err
}

func (s *Service) ReportAbuse(ctx context.Context, actor, messageID string, kind AbuseKind) (AbuseReport, error) {
	actor = strings.TrimSpace(actor)
	messageID = strings.TrimSpace(messageID)
	if actor == "" {
		return AbuseReport{}, ErrUnauthorized
	}
	if messageID == "" || !validAbuseKind(kind) {
		return AbuseReport{}, ErrInvalidInput
	}
	var out AbuseReport
	err := s.Store.Update(ctx, func(data *storeData) error {
		msg, ok := data.Messages[messageID]
		if !ok {
			return ErrNotFound
		}
		stateKey := mailboxKey(actor, messageID)
		state, ok := data.Mailbox[stateKey]
		if !ok || state.DeletedAt != nil {
			return ErrNotFound
		}
		if msg.Recipient != actor {
			return ErrUnauthorized
		}
		key := abuseReportKey(actor, messageID)
		if existing, ok := data.AbuseReports[key]; ok {
			if existing.Kind != kind {
				return ErrAbuseReportConflict
			}
			out = existing
			return nil
		}

		now := s.Now().UTC()
		out = AbuseReport{
			ID: deterministicAbuseReportID(actor, messageID), Owner: actor, MessageID: messageID,
			Sender: msg.Sender, Kind: kind, CreatedAt: now,
		}
		data.AbuseReports[key] = out

		rep := data.Reputation[reputationKey(actor, msg.Sender)]
		rep.Owner = actor
		rep.Sender = strings.ToLower(strings.TrimSpace(msg.Sender))
		switch kind {
		case AbuseSpam:
			rep.SpamReports++
		case AbusePhishing:
			rep.PhishingReports++
		}
		reasons := []string{"USER_REPORTED_" + string(kind)}
		qKey := quarantineKey(actor, messageID)
		existingQuarantine, hadQuarantine := data.Quarantine[qKey]
		if !hadQuarantine || existingQuarantine.Status != QuarantineActive {
			rep.Quarantines++
		}
		rep.RiskScore = reputationRisk(rep)
		rep.UpdatedAt = now
		data.Reputation[reputationKey(actor, msg.Sender)] = rep

		if hadQuarantine {
			reasons = mergeReasons(existingQuarantine.Reasons, reasons...)
		}
		record := QuarantineRecord{
			Owner: actor, MessageID: messageID, Sender: msg.Sender, Status: QuarantineActive,
			Reasons: reasons, CreatedAt: now, UpdatedAt: now,
		}
		if hadQuarantine {
			record.CreatedAt = existingQuarantine.CreatedAt
			record.SpamScore = existingQuarantine.SpamScore
			record.PhishingScore = existingQuarantine.PhishingScore
		}
		if kind == AbuseSpam && record.SpamScore < SpamReputationThreshold {
			record.SpamScore = SpamReputationThreshold
		}
		if kind == AbusePhishing && record.PhishingScore < PhishingQuarantineScore {
			record.PhishingScore = PhishingQuarantineScore
		}
		data.Quarantine[qKey] = record

		if state.Folder != FolderJunk && state.Folder != FolderTrash {
			state.PreviousFolder = state.Folder
			state.Folder = FolderJunk
			t := now
			state.JunkedAt = &t
		}
		state.Muted = true
		state.UpdatedAt = now
		state.Version++
		data.Mailbox[stateKey] = state
		return nil
	})
	return out, err
}

func (s *Service) ReleaseQuarantine(ctx context.Context, actor, messageID string) (MailboxState, error) {
	actor = strings.TrimSpace(actor)
	messageID = strings.TrimSpace(messageID)
	if actor == "" {
		return MailboxState{}, ErrUnauthorized
	}
	var out MailboxState
	err := s.Store.Update(ctx, func(data *storeData) error {
		qKey := quarantineKey(actor, messageID)
		record, ok := data.Quarantine[qKey]
		if !ok || record.Status != QuarantineActive {
			return ErrNotFound
		}
		msg, ok := data.Messages[messageID]
		if !ok || msg.Recipient != actor {
			return ErrNotFound
		}
		stateKey := mailboxKey(actor, messageID)
		state, ok := data.Mailbox[stateKey]
		if !ok || state.DeletedAt != nil {
			return ErrNotFound
		}
		now := s.Now().UTC()
		if state.Folder == FolderJunk {
			state.PreviousFolder = FolderJunk
			state.Folder = FolderInbox
		}
		state.Muted = false
		state.UpdatedAt = now
		state.Version++
		data.Mailbox[stateKey] = state

		record.Status = QuarantineReleased
		record.UpdatedAt = now
		record.ReleasedAt = &now
		data.Quarantine[qKey] = record

		rep := data.Reputation[reputationKey(actor, msg.Sender)]
		rep.Owner = actor
		rep.Sender = strings.ToLower(strings.TrimSpace(msg.Sender))
		rep.FalsePositives++
		rep.RiskScore = reputationRisk(rep)
		rep.UpdatedAt = now
		data.Reputation[reputationKey(actor, msg.Sender)] = rep
		out = state
		return nil
	})
	return out, err
}

func evaluateSpamProtection(data *storeData, owner string, msg Message, body string, trust TrustDecision) spamDecision {
	decision := spamDecision{}
	if !trust.Trusted {
		rep := data.Reputation[reputationKey(owner, msg.Sender)]
		if rep.RiskScore >= SpamReputationThreshold {
			decision.SpamScore += rep.RiskScore
			decision.Reasons = append(decision.Reasons, "SENDER_REPUTATION")
		}
		fp := spamFingerprint(msg.Subject, body)
		if count := data.ContentFingerprints[fingerprintKey(msg.Sender, fp)]; count >= DuplicateSpamThreshold-1 {
			decision.SpamScore += SpamReputationThreshold
			decision.Reasons = append(decision.Reasons, "DUPLICATE_CONTENT")
		}
	}
	decision.PhishingScore, decision.Reasons = phishingSignals(msg.Subject, body, decision.Reasons)
	decision.Quarantine = decision.SpamScore >= SpamReputationThreshold || decision.PhishingScore >= PhishingQuarantineScore
	decision.Reasons = uniqueReasons(decision.Reasons)
	return decision
}

func recordDeliveryProtection(data *storeData, owner string, msg Message, body string, decision spamDecision, now time.Time) {
	fp := spamFingerprint(msg.Subject, body)
	key := fingerprintKey(msg.Sender, fp)
	if data.ContentFingerprints[key] < MaxFingerprintCount {
		data.ContentFingerprints[key]++
	}

	repKey := reputationKey(owner, msg.Sender)
	rep := data.Reputation[repKey]
	rep.Owner = owner
	rep.Sender = strings.ToLower(strings.TrimSpace(msg.Sender))
	rep.Deliveries++
	if decision.Quarantine {
		rep.Quarantines++
	}
	rep.RiskScore = reputationRisk(rep)
	rep.UpdatedAt = now
	data.Reputation[repKey] = rep

	if decision.Quarantine {
		data.Quarantine[quarantineKey(owner, msg.ID)] = QuarantineRecord{
			Owner: owner, MessageID: msg.ID, Sender: msg.Sender, Status: QuarantineActive,
			Reasons: append([]string(nil), decision.Reasons...), SpamScore: decision.SpamScore,
			PhishingScore: decision.PhishingScore, CreatedAt: now, UpdatedAt: now,
		}
	}
}

func phishingSignals(subject, body string, reasons []string) (int, []string) {
	text := strings.ToLower(subject + "\n" + body)
	score := 0
	links := urlPattern.FindAllString(text, -1)
	for _, raw := range links {
		trimmed := strings.TrimRight(raw, ".,);!?]")
		u, err := url.Parse(trimmed)
		if err != nil || u.Host == "" {
			continue
		}
		host := strings.ToLower(u.Hostname())
		if u.User != nil {
			score += 3
			reasons = append(reasons, "URL_USERINFO")
		}
		if net.ParseIP(host) != nil {
			score += 2
			reasons = append(reasons, "IP_LITERAL_LINK")
		}
		if strings.Contains(host, "xn--") {
			score++
			reasons = append(reasons, "PUNYCODE_LINK")
		}
		if u.Scheme == "http" {
			score++
			reasons = append(reasons, "INSECURE_LINK")
		}
	}
	if len(links) > 0 {
		for _, phrase := range []string{
			"seed phrase", "recovery phrase", "private key", "verify your wallet",
			"validate your wallet", "connect your wallet", "urgent action required",
			"account will be suspended", "confirm your credentials",
		} {
			if strings.Contains(text, phrase) {
				score += 2
				reasons = append(reasons, "CREDENTIAL_OR_URGENCY_LURE")
				break
			}
		}
	}
	return score, reasons
}

func reputationRisk(rep SenderReputation) int {
	risk := int(rep.SpamReports) + int(rep.PhishingReports)*2 - int(rep.FalsePositives)
	if risk < 0 {
		return 0
	}
	if risk > 100 {
		return 100
	}
	return risk
}

func spamFingerprint(subject, body string) string {
	normalized := strings.ToLower(strings.Join(strings.Fields(subject+"\n"+body), " "))
	sum := sha256.Sum256([]byte(normalized))
	return hex.EncodeToString(sum[:16])
}

func fingerprintKey(sender, fingerprint string) string {
	return strings.ToLower(strings.TrimSpace(sender)) + "\x00" + fingerprint
}

func reputationKey(owner, sender string) string {
	return owner + "\x00" + strings.ToLower(strings.TrimSpace(sender))
}

func quarantineKey(owner, messageID string) string {
	return owner + "\x00" + messageID
}

func abuseReportKey(owner, messageID string) string {
	return owner + "\x00" + messageID
}

func deterministicAbuseReportID(owner, messageID string) string {
	sum := sha256.Sum256([]byte("420/MAIL/ABUSE/V1\x00" + owner + "\x00" + messageID))
	return "abuse_" + hex.EncodeToString(sum[:8])
}

func validAbuseKind(kind AbuseKind) bool {
	return kind == AbuseSpam || kind == AbusePhishing
}

func mergeReasons(existing []string, added ...string) []string {
	return uniqueReasons(append(append([]string(nil), existing...), added...))
}

func uniqueReasons(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, reason := range in {
		reason = strings.TrimSpace(reason)
		if reason == "" {
			continue
		}
		if _, ok := seen[reason]; ok {
			continue
		}
		seen[reason] = struct{}{}
		out = append(out, reason)
		if len(out) == MaxQuarantineReasons {
			break
		}
	}
	sort.Strings(out)
	return out
}

func validateSpamData(data *storeData) error {
	for key, rep := range data.Reputation {
		if key != reputationKey(rep.Owner, rep.Sender) || rep.Owner == "" || rep.Sender == "" || rep.RiskScore != reputationRisk(rep) {
			return ErrInvalidInput
		}
	}
	for key, report := range data.AbuseReports {
		if key != abuseReportKey(report.Owner, report.MessageID) || report.ID != deterministicAbuseReportID(report.Owner, report.MessageID) || report.Owner == "" || report.MessageID == "" || report.Sender == "" || !validAbuseKind(report.Kind) {
			return ErrInvalidInput
		}
	}
	for key, record := range data.Quarantine {
		if key != quarantineKey(record.Owner, record.MessageID) || record.Owner == "" || record.MessageID == "" || record.Sender == "" || (record.Status != QuarantineActive && record.Status != QuarantineReleased) || len(record.Reasons) > MaxQuarantineReasons {
			return ErrInvalidInput
		}
		if _, ok := data.Messages[record.MessageID]; !ok {
			return ErrInvalidInput
		}
	}
	for key, count := range data.ContentFingerprints {
		if key == "" || count > MaxFingerprintCount {
			return ErrInvalidInput
		}
	}
	return nil
}
