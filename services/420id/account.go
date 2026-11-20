// Package account is the server-side shared account foundation. It is not an
// authenticator, wallet, credential issuer, public API or authorization grant.
package account

import (
 "context"
 "crypto/rand"
 "database/sql"
 "embed"
 "errors"
 "fmt"
 "regexp"
)

//go:embed migrations/*.sql
var migration embed.FS

var (
 ErrInvalid = errors.New("invalid account input")
 ErrUnavailable = errors.New("account unavailable")
 ErrConflict = errors.New("account revision conflict")
 appPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}$`)
 uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
)

type Status string
const (
 Active Status = "active"
 Suspended Status = "suspended"
 Closed Status = "closed"
)

// AccountID is private to the account authority; applications receive only Subject.
type AccountID string
type Account struct {
 ID AccountID
 Status Status
 Revision int64
}
type Subject struct {
 App string `json:"app"`
 ID string `json:"sub"`
}

// Store is a trusted server-owned dependency. Never accept account IDs or app
// identities from unverified client requests as proof of identity.
type Store struct {
 db *sql.DB
 apps map[string]struct{}
}

func NewStore(db *sql.DB, approvedApps []string) (*Store,error) {
 if db==nil || len(approvedApps)==0 { return nil,ErrInvalid }
 apps:=make(map[string]struct{},len(approvedApps))
 for _,app:=range approvedApps {
  if !appPattern.MatchString(app) {return nil,ErrInvalid}
  if _,exists:=apps[app];exists{return nil,ErrInvalid}
  apps[app]=struct{}{}
 }
 return &Store{db:db,apps:apps},nil
}

func (s *Store) allowed(app string) bool {_,ok:=s.apps[app];return ok}
func validID(id string) bool {return uuidPattern.MatchString(id)}
func newID() (string,error) {
 var b [16]byte
 if _,err:=rand.Read(b[:]);err!=nil{return "",err}
 b[6]=(b[6]&0x0f)|0x40
 b[8]=(b[8]&0x3f)|0x80
 return fmt.Sprintf("%x-%x-%x-%x-%x",b[:4],b[4:6],b[6:8],b[8:10],b[10:]),nil
}

// Migrate is an operator operation, not part of a user request. Versioned schema
// is installed atomically. The advisory lock serializes concurrent installers.
func Migrate(ctx context.Context,db *sql.DB) error {
 if db==nil{return ErrInvalid}
 tx,err:=db.BeginTx(ctx,nil);if err!=nil{return err};defer tx.Rollback()
 if _,err=tx.ExecContext(ctx,"SELECT pg_advisory_xact_lock(420000001)");err!=nil{return err}
 for _,name:=range []string{"001_accounts.sql","002_authentication.sql","003_acceptance_ingress.sql","004_sessions_recovery.sql","005_universal_profiles.sql","006_optional_wallet_links.sql","007_identity_names_preferences.sql","008_sso.sql"} {
  body,err:=migration.ReadFile("migrations/"+name);if err!=nil{return err}
  if _,err=tx.ExecContext(ctx,string(body));err!=nil{return err}
 }
 return tx.Commit()
}

// Provision is an internal primitive for the future verified enrollment
// adapter. It creates no credential, session, wallet, balance or permissions.
func (s *Store) Provision(ctx context.Context) (Account,error) {
 id,err:=newID();if err!=nil{return Account{},err}
 var a Account
 err=s.db.QueryRowContext(ctx,`INSERT INTO account420.accounts(id) VALUES($1) RETURNING id,status,revision`,id).Scan(&a.ID,&a.Status,&a.Revision)
 return a,err
}

func (s *Store) Get(ctx context.Context,id AccountID) (Account,error) {
 if !validID(string(id)){return Account{},ErrInvalid}
 var a Account
 err:=s.db.QueryRowContext(ctx,`SELECT id,status,revision FROM account420.accounts WHERE id=$1`,id).Scan(&a.ID,&a.Status,&a.Revision)
 if errors.Is(err,sql.ErrNoRows){return Account{},ErrUnavailable}
 return a,err
}

// Enroll creates an application-specific opaque subject once, for the account
// already authenticated by the future caller. No cross-app grant is implied.
func (s *Store) Enroll(ctx context.Context,id AccountID,app string) (Subject,error) {
 if !validID(string(id))||!s.allowed(app){return Subject{},ErrInvalid}
 tx,err:=s.db.BeginTx(ctx,nil);if err!=nil{return Subject{},err};defer tx.Rollback()
 var state Status
 err=tx.QueryRowContext(ctx,`SELECT status FROM account420.accounts WHERE id=$1 FOR UPDATE`,id).Scan(&state)
 if errors.Is(err,sql.ErrNoRows)||err==nil&&state!=Active{return Subject{},ErrUnavailable};if err!=nil{return Subject{},err}
 subject,err:=newID();if err!=nil{return Subject{},err}
 _,err=tx.ExecContext(ctx,`INSERT INTO account420.app_subjects(account_id,app_id,subject_id) VALUES($1,$2,$3) ON CONFLICT(account_id,app_id) DO NOTHING`,id,app,subject)
 if err!=nil{return Subject{},err}
 err=tx.QueryRowContext(ctx,`SELECT subject_id FROM account420.app_subjects WHERE account_id=$1 AND app_id=$2`,id,app).Scan(&subject)
 if err!=nil{return Subject{},err};if err=tx.Commit();err!=nil{return Subject{},err}
 return Subject{App:app,ID:subject},nil
}

// Resolve is server-only, app scoped, and rechecks current account activity.
// The result is an identifier, never a principal or evidence of authentication.
func (s *Store) Resolve(ctx context.Context,subject Subject) (AccountID,error) {
 if !s.allowed(subject.App)||!validID(subject.ID){return "",ErrInvalid}
 var id AccountID
 err:=s.db.QueryRowContext(ctx,`SELECT a.id FROM account420.app_subjects p JOIN account420.accounts a ON a.id=p.account_id WHERE p.app_id=$1 AND p.subject_id=$2 AND a.status='active'`,subject.App,subject.ID).Scan(&id)
 if errors.Is(err,sql.ErrNoRows){return "",ErrUnavailable};return id,err
}

// Transition is an internal lifecycle primitive, not a recovery or moderation
// API. Terminal accounts cannot be reopened; expected revision prevents races.
func (s *Store) Transition(ctx context.Context,id AccountID,revision int64,next Status) (Account,error) {
 if !validID(string(id))||revision<1{return Account{},ErrInvalid}
 if next!=Active&&next!=Suspended&&next!=Closed{return Account{},ErrInvalid}
 var a Account
 err:=s.db.QueryRowContext(ctx,`UPDATE account420.accounts SET status=$3,revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$2 AND status<>'closed' AND status<>$3 RETURNING id,status,revision`,id,revision,next).Scan(&a.ID,&a.Status,&a.Revision)
 if errors.Is(err,sql.ErrNoRows){return Account{},ErrConflict};return a,err
}
