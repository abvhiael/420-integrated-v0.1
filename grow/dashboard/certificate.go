package dashboard

import (
	"crypto/sha256"
	"database/sql"
	"errors"
	"net/http"
	"regexp"
	"strings"
)

var tenantUUID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
var subjectName = regexp.MustCompile(`^[A-Za-z0-9_.@:-]{1,180}$`)

// CertificateIdentity accepts only certificates already verified by the TLS
// handshake against the configured private operator CA. A matching SPIFFE SAN
// and active tenant/database fingerprint binding are both mandatory.
type CertificateIdentity struct{ DB *sql.DB }

func (v CertificateIdentity) Authenticate(r *http.Request) (string, string, []byte, error) {
	if v.DB == nil || r.TLS == nil || len(r.TLS.VerifiedChains) == 0 || len(r.TLS.PeerCertificates) == 0 {
		return "", "", nil, errors.New("verified client certificate required")
	}
	cert := r.TLS.PeerCertificates[0]
	tenant, subject := "", ""
	for _, uri := range cert.URIs {
		if uri.Scheme != "spiffe" || uri.Host != "420integrated.org" {
			continue
		}
		parts := strings.Split(strings.Trim(uri.Path, "/"), "/")
		if len(parts) != 5 || parts[0] != "grow" || parts[1] != "tenants" || parts[3] != "subjects" {
			continue
		}
		if !tenantUUID.MatchString(parts[2]) || !subjectName.MatchString(parts[4]) {
			continue
		}
		if tenant != "" {
			return "", "", nil, errors.New("ambiguous certificate identity")
		}
		tenant = parts[2]
		subject = parts[4]
	}
	if tenant == "" || subject == "" {
		return "", "", nil, errors.New("certificate identity absent")
	}
	fingerprint := sha256.Sum256(cert.Raw)
	tx, err := v.DB.BeginTx(r.Context(), nil)
	if err != nil {
		return "", "", nil, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(r.Context(), "SELECT set_config('grow.tenant_id',$1,true)", tenant); err != nil {
		return "", "", nil, err
	}
	var permitted bool
	err = tx.QueryRowContext(r.Context(), `SELECT EXISTS(
SELECT 1 FROM grow_private.dashboard_identities i
JOIN grow_private.memberships m ON m.tenant_id=i.tenant_id AND m.subject_id=i.subject_id
WHERE i.tenant_id=$1::uuid AND i.subject_id=$2 AND i.cert_fingerprint=$3
AND i.enabled=true AND i.revoked_at IS NULL AND m.state='ACTIVE')`,
		tenant, subject, fingerprint[:]).Scan(&permitted)
	if err != nil || !permitted {
		return "", "", nil, errors.New("certificate not enrolled or membership inactive")
	}
	if err = tx.Commit(); err != nil {
		return "", "", nil, err
	}
	return tenant, subject, fingerprint[:], nil
}
