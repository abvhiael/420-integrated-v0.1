package dashboard

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"
)

const CookieName = "__Host-grow_session"

type SQLAuthenticator struct {
	DB *sql.DB
}

// Issue must be invoked exclusively after an external identity provider has
// authenticated the subject. It never authenticates a username/password itself.
func (a SQLAuthenticator) Issue(ctx context.Context, verifiedTenant, verifiedSubject, sessionID string, now time.Time, certificateFingerprint []byte) (*http.Cookie, error) {
	if a.DB == nil || verifiedTenant == "" || verifiedSubject == "" || sessionID == "" || len(certificateFingerprint) != 32 {
		return nil, errors.New("verified identity required")
	}
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return nil, err
	}
	secret := hex.EncodeToString(random)
	hash := sha256.Sum256([]byte(secret))
	tx, err := a.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "SELECT set_config('grow.tenant_id',$1,true)", verifiedTenant); err != nil {
		return nil, err
	}
	var active bool
	err = tx.QueryRowContext(ctx, `SELECT EXISTS(
SELECT 1 FROM grow_private.memberships
WHERE tenant_id=$1::uuid AND subject_id=$2 AND state='ACTIVE')`, verifiedTenant, verifiedSubject).Scan(&active)
	if err != nil || !active {
		return nil, errors.New("inactive membership")
	}
	expiry := now.UTC().Add(8 * time.Hour)
	_, err = tx.ExecContext(ctx, `INSERT INTO grow_private.dashboard_sessions
(tenant_id,session_id,subject_id,token_hash,issued_at,expires_at,identity_fingerprint)
VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7)`, verifiedTenant, sessionID, verifiedSubject, hash[:], now.UTC(), expiry, certificateFingerprint)
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return &http.Cookie{Name: CookieName, Value: verifiedTenant + "." + sessionID + "." + secret,
		Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode,
		Expires: expiry, MaxAge: int(expiry.Sub(now).Seconds())}, nil
}

func (a SQLAuthenticator) Verify(r *http.Request) (Session, error) {
	if a.DB == nil || r.TLS == nil {
		return Session{}, errors.New("TLS and session database required")
	}
	cookie, err := r.Cookie(CookieName)
	if err != nil {
		return Session{}, errors.New("missing session")
	}
	parts := strings.Split(cookie.Value, ".")
	if len(parts) != 3 || len(parts[0]) != 36 || len(parts[1]) != 36 || len(parts[2]) != 64 {
		return Session{}, errors.New("malformed session")
	}
	token, err := hex.DecodeString(parts[2])
	if err != nil || len(token) != 32 {
		return Session{}, errors.New("malformed token")
	}
	hash := sha256.Sum256([]byte(parts[2]))
	tx, err := a.DB.BeginTx(r.Context(), nil)
	if err != nil {
		return Session{}, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(r.Context(), "SELECT set_config('grow.tenant_id',$1,true)", parts[0]); err != nil {
		return Session{}, err
	}
	var s Session
	var role string
	var facility, zone sql.NullString
	err = tx.QueryRowContext(r.Context(), `SELECT s.tenant_id::text,s.subject_id,s.expires_at,m.role,m.facility_id::text,m.zone_id::text
FROM grow_private.dashboard_sessions s
JOIN grow_private.memberships m ON m.tenant_id=s.tenant_id AND m.subject_id=s.subject_id
JOIN grow_private.dashboard_identities i ON i.tenant_id=s.tenant_id AND i.subject_id=s.subject_id
 AND i.cert_fingerprint=s.identity_fingerprint AND i.enabled=true AND i.revoked_at IS NULL
WHERE s.tenant_id=$1::uuid AND s.session_id=$2::uuid AND s.token_hash=$3
AND s.revoked_at IS NULL AND s.expires_at>now() AND m.state='ACTIVE'`,
		parts[0], parts[1], hash[:]).Scan(&s.TenantID, &s.SubjectID, &s.ExpiresAt, &role, &facility, &zone)
	if err != nil {
		return Session{}, errors.New("expired, revoked or invalid session")
	}
	s.Sections = []string{"overview", "facilities", "plants", "environment", "cultivation", "harvests", "inventory", "advice", "notifications"}
	if role == "MAINTAINER" {
		s.Sections = []string{"equipment"}
	} else {
		if role != "REVIEWER" {
			s.Sections = append(s.Sections, "equipment")
		}
		switch role {
		case "OWNER", "MANAGER":
			s.Actions = []string{"facilities.create", "facilities.rename", "plants.create", "plants.transition",
				"cultivation.record", "harvests.record", "inventory.create", "inventory.adjust",
				"inventory.export", "advice.review"}
		case "TECHNICIAN":
			s.Actions = []string{"plants.create", "plants.transition", "cultivation.record", "harvests.record", "advice.review"}
		case "REVIEWER":
			s.Actions = []string{"inventory.export"}
		}
	}
	if err = tx.Commit(); err != nil {
		return Session{}, err
	}
	return s, nil
}

func (a SQLAuthenticator) Revoke(ctx context.Context, tenant, sessionID, verifiedSubject string) error {
	if a.DB == nil || verifiedSubject == "" {
		return errors.New("authenticated subject required")
	}
	tx, err := a.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "SELECT set_config('grow.tenant_id',$1,true)", tenant); err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, `UPDATE grow_private.dashboard_sessions
SET revoked_at=now() WHERE tenant_id=$1::uuid AND session_id=$2::uuid
AND subject_id=$3 AND revoked_at IS NULL`, tenant, sessionID, verifiedSubject)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n != 1 {
		return errors.New("session already revoked or missing")
	}
	return tx.Commit()
}
