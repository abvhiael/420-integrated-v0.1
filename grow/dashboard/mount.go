package dashboard

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"
)

// MountPrivate installs the private API in a dedicated mux. It cannot be enabled
// without an explicitly supplied unprivileged PostgreSQL pool and server-side
// authenticated session authority. This never mounts on anonymous 420Location.
func MountPrivate(mux *http.ServeMux, db *sql.DB) error {
	if mux == nil || db == nil {
		return errors.New("private API requires its database and router")
	}
	auth := SQLAuthenticator{DB: db}
	service := PrivateServer{
		Login: func(w http.ResponseWriter, r *http.Request) error {
			tenant, subject, fingerprint, err := (CertificateIdentity{DB: db}).Authenticate(r)
			if err != nil {
				return err
			}
			id, err := uuidV4()
			if err != nil {
				return err
			}
			cookie, err := auth.Issue(r.Context(), tenant, subject, id, time.Now().UTC(), fingerprint)
			if err != nil {
				return err
			}
			http.SetCookie(w, cookie)
			return nil
		},
		Handler: Handler{Auth: auth, Reader: SQLReader{DB: db}},
		Actions: SQLActions{DB: db},
		Revoke: func(r *http.Request, session Session) error {
			c, err := r.Cookie(CookieName)
			if err != nil {
				return err
			}
			parts := strings.Split(c.Value, ".")
			if len(parts) != 3 || parts[0] != session.TenantID {
				return errors.New("session scope mismatch")
			}
			return auth.Revoke(r.Context(), session.TenantID, parts[1], session.SubjectID)
		},
	}
	mux.Handle("/v1/private/", service)
	return nil
}
