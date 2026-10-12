package complianceauth

import (
	"context"
	"crypto/sha256"
	"database/sql"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"
)

//go:embed migrations/0002_author_drafts.sql
var C064AuthorSchemaSQL string

// Draft and version data remain in the private primary database, never in the
// public catalogue. INSERT-only revision operations preserve prior drafts.
type C064PostgreSQLDrafts struct { DB *sql.DB }

func (s C064PostgreSQLDrafts) Migrate(ctx context.Context) error {
	if s.DB == nil || ctx == nil || ctx.Err() != nil { return ErrUnavailable }
	_, err := s.DB.ExecContext(ctx, C064AuthorSchemaSQL)
	return err
}
func c064DocumentDigest(schema CompliancePolicySchema, citations []C064CitedText) string {
	doc := struct {
		Schema CompliancePolicySchema `json:"schema"`
		Citations []C064CitedText `json:"citations"`
	}{schema, citations}
	data, _ := json.Marshal(doc)
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
func (s C064PostgreSQLDrafts) Save(ctx context.Context, scope C064AuthorScope, id, author string, expected uint64, schema CompliancePolicySchema, citations []C064CitedText, now time.Time) (C064DraftVersion, error) {
	if s.DB == nil || ctx == nil || ctx.Err() != nil || !c064ID.MatchString(id) || !c064ID.MatchString(author) ||
		expected >= maxC064Revision || now.IsZero() || !c064SchemaValid(schema, id, scope) || len(citations) == 0 || len(citations) > 32 {
		return C064DraftVersion{}, ErrAuthorInvalid
	}
	tx, err := s.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil { return C064DraftVersion{}, ErrUnavailable }
	defer tx.Rollback()
	var replica bool
	if err := tx.QueryRowContext(ctx, "SELECT pg_is_in_recovery()").Scan(&replica); err != nil || replica { return C064DraftVersion{}, ErrUnavailable }
	// A concurrent initial writer waits on the unique head key, then observes
	// the committed revision under READ COMMITTED before the locked comparison.
	_, err = tx.ExecContext(ctx, `INSERT INTO compliance_author_heads (tenant,domain,jurisdiction,draft_id,author_id,revision)
		VALUES($1,$2,$3,$4,$5,0) ON CONFLICT (tenant,domain,jurisdiction,draft_id) DO NOTHING`,
		scope.Tenant, scope.Domain, scope.Jurisdiction, id, author)
	if err != nil { return C064DraftVersion{}, ErrUnavailable }
	var owner string
	var current uint64
	err = tx.QueryRowContext(ctx, `SELECT author_id,revision FROM compliance_author_heads
		WHERE tenant=$1 AND domain=$2 AND jurisdiction=$3 AND draft_id=$4 FOR UPDATE`,
		scope.Tenant, scope.Domain, scope.Jurisdiction, id).Scan(&owner, &current)
	if err != nil { return C064DraftVersion{}, ErrUnavailable }
	if owner != author { return C064DraftVersion{}, ErrAuthorDenied }
	if current != expected { return C064DraftVersion{}, ErrAuthorConflict }
	version := C064DraftVersion{Scope: scope, ID: id, AuthorID: author, Revision: current+1, CreatedAt: now.UTC().Truncate(time.Microsecond), Schema: schema, Citations: citations}
	version.DocumentDigest = c064DocumentDigest(schema, citations)
	doc, err := json.Marshal(version)
	if err != nil { return C064DraftVersion{}, ErrAuthorInvalid }
	_, err = tx.ExecContext(ctx, `INSERT INTO compliance_author_versions
		(tenant,domain,jurisdiction,draft_id,revision,author_id,created_at,document_digest,document)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		scope.Tenant, scope.Domain, scope.Jurisdiction, id, int64(version.Revision), author, version.CreatedAt, version.DocumentDigest, string(doc))
	if err != nil { return C064DraftVersion{}, ErrUnavailable }
	updated, err := tx.ExecContext(ctx, `UPDATE compliance_author_heads SET revision=$1
		WHERE tenant=$2 AND domain=$3 AND jurisdiction=$4 AND draft_id=$5 AND author_id=$6 AND revision=$7`,
		int64(version.Revision), scope.Tenant, scope.Domain, scope.Jurisdiction, id, author, int64(expected))
	if err != nil || ctx.Err() != nil { return C064DraftVersion{}, ErrUnavailable }
	count, err := updated.RowsAffected()
	if err != nil || count != 1 { return C064DraftVersion{}, ErrUnavailable }
	if err := tx.Commit(); err != nil { return C064DraftVersion{}, ErrUnavailable }
	return version, nil
}
func (s C064PostgreSQLDrafts) Load(ctx context.Context, scope C064AuthorScope, id, author string, revision uint64) (C064DraftVersion, error) {
	if s.DB == nil || ctx == nil || ctx.Err() != nil || !c064ID.MatchString(id) || !c064ID.MatchString(author) || revision > maxC064Revision {
		return C064DraftVersion{}, ErrAuthorDenied
	}
	var doc []byte
	var rowDigest string
	var rowRevision uint64
	err := s.DB.QueryRowContext(ctx, `SELECT v.document,v.document_digest,v.revision
		FROM compliance_author_versions v JOIN compliance_author_heads h
		ON h.tenant=v.tenant AND h.domain=v.domain AND h.jurisdiction=v.jurisdiction AND h.draft_id=v.draft_id
		WHERE v.tenant=$1 AND v.domain=$2 AND v.jurisdiction=$3 AND v.draft_id=$4 AND v.author_id=$5 AND h.author_id=$5
		AND v.revision=CASE WHEN $6::bigint=0 THEN h.revision ELSE $6::bigint END
		AND NOT pg_is_in_recovery()`, scope.Tenant, scope.Domain, scope.Jurisdiction, id, author, int64(revision)).Scan(&doc, &rowDigest, &rowRevision)
	if errors.Is(err, sql.ErrNoRows) { return C064DraftVersion{}, ErrAuthorDenied }
	if err != nil { return C064DraftVersion{}, ErrUnavailable }
	var version C064DraftVersion
	if json.Unmarshal(doc, &version) != nil || version.Scope != scope || version.ID != id || version.AuthorID != author ||
		version.Revision != rowRevision || version.DocumentDigest != rowDigest || rowDigest != c064DocumentDigest(version.Schema, version.Citations) ||
		!c064SchemaValid(version.Schema, id, scope) {
		return C064DraftVersion{}, ErrUnavailable
	}
	return version, nil
}
