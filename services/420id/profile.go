package account

import (
 "context"
 "database/sql"
 "errors"
 "regexp"
 "strings"
 "unicode"
 "unicode/utf8"
)

// UniversalProfile belongs to the private 420ID account authority. ProfileID
// is an optional public pseudonym, not the internal account identifier, a
// 420Names name, wallet address, identity claim or application permission.
type UniversalProfile struct {
 ProfileID string `json:"profileId,omitempty"`
 Username string `json:"username"`
 DisplayName string `json:"displayName"`
 Bio string `json:"bio"`
 AvatarRef string `json:"avatarRef"`
 Visibility string `json:"visibility"`
 Revision int64 `json:"revision"`
}

// ProfileUpdate is a full replacement with an optimistic revision check.
// Revision zero means no profile row has been created yet.
type ProfileUpdate struct {
 Username string `json:"username"`
 DisplayName string `json:"displayName"`
 Bio string `json:"bio"`
 AvatarRef string `json:"avatarRef"`
 Visibility string `json:"visibility"`
 ExpectedRevision int64 `json:"expectedRevision"`
}

var usernamePattern = regexp.MustCompile(`^[a-z][a-z0-9_]{2,23}$`)
var avatarPattern = regexp.MustCompile(`^sha256:[0-9a-f]{64}$`)
var reservedUsernames = map[string]bool{
 "admin":true,"administrator":true,"moderator":true,"mod":true,
 "staff":true,"support":true,"security":true,"root":true,
 "system":true,"help":true,"420id":true,"420integrated":true,
 "420wallet":true,"420names":true,"official":true,
}

func canonicalUsername(s string)(string,error){
 s=strings.ToLower(s)
 if s=="" {return "",nil}
 if !usernamePattern.MatchString(s)||reservedUsernames[s]{return "",ErrInvalid}
 return s,nil
}

func validProfileText(s string,maxRunes,maxBytes int,allowNewline bool)bool{
 if len(s)>maxBytes||!utf8.ValidString(s)||utf8.RuneCountInString(s)>maxRunes{return false}
 if strings.TrimSpace(s)!=s{return false}
 for _,r:=range s{
  if r=='\n'&&allowNewline{continue}
  if unicode.IsControl(r)||unicode.Is(unicode.Cf,r)||unicode.Is(unicode.Cs,r) {return false}
 }
 return true
}

func normalizeProfileUpdate(in ProfileUpdate)(ProfileUpdate,error){
 username,e:=canonicalUsername(in.Username)
 if e!=nil||in.ExpectedRevision<0||in.Visibility!="public"&&in.Visibility!="private"||
  !validProfileText(in.DisplayName,80,320,false)||
  !validProfileText(in.Bio,500,2000,true)||
  (in.AvatarRef!=""&&!avatarPattern.MatchString(in.AvatarRef)){return ProfileUpdate{},ErrInvalid}
 in.Username=username
 return in,nil
}

const profileColumns="profile_id,COALESCE(username,''),display_name,bio,avatar_ref,visibility,revision"
func scanProfile(row interface{Scan(...any)error})(UniversalProfile,error){
 var p UniversalProfile
 e:=row.Scan(&p.ProfileID,&p.Username,&p.DisplayName,&p.Bio,&p.AvatarRef,&p.Visibility,&p.Revision)
 return p,e
}

// MyProfile requires a current, application-scoped AUTH-3 session. It does
// not create a profile row as a side-effect of a read.
func (m *SessionManager) MyProfile(ctx context.Context,token string)(UniversalProfile,error){
 tx,e:=m.auth.store.db.BeginTx(ctx,&sql.TxOptions{ReadOnly:true})
 if e!=nil{return UniversalProfile{},e}
 defer tx.Rollback()
 // The standard session lock requires a write-capable transaction, so use
 // one consistent joined view for both session and profile authorization.
 digest,e:=tokenDigest(token);if e!=nil{return UniversalProfile{},e}
 var accountID AccountID
 e=tx.QueryRowContext(ctx,"SELECT s.account_id FROM account420.sessions s JOIN account420.accounts a ON a.id=s.account_id WHERE s.token_digest=$1 AND s.app_id=$2 AND s.rp_id=$3 AND s.revoked_at IS NULL AND s.idle_until>clock_timestamp() AND s.expires_at>clock_timestamp() AND a.status='active' AND a.revision=s.account_revision",digest,m.app,m.auth.rp).Scan(&accountID)
 if errors.Is(e,sql.ErrNoRows){return UniversalProfile{},ErrAuthentication}
 if e!=nil{return UniversalProfile{},e}
 result,e:=scanProfile(tx.QueryRowContext(ctx,"SELECT "+profileColumns+" FROM account420.profiles WHERE account_id=$1",accountID))
 if errors.Is(e,sql.ErrNoRows){result=UniversalProfile{Visibility:"private",Revision:0};e=nil}
 if e!=nil{return UniversalProfile{},e}
 if e=tx.Commit();e!=nil{return UniversalProfile{},e}
 return result,nil
}

// UpdateMyProfile serializes with session revocation, recovery and lifecycle
// transitions by acquiring the account lock first. A profile revision is
// independent of AUTH-3 account/session revision.
func (m *SessionManager) UpdateMyProfile(ctx context.Context,token string,input ProfileUpdate)(UniversalProfile,error){
 in,e:=normalizeProfileUpdate(input);if e!=nil{return UniversalProfile{},e}
 tx,e:=m.auth.store.db.BeginTx(ctx,nil);if e!=nil{return UniversalProfile{},e}
 defer tx.Rollback()
 session,e:=m.lockedSession(ctx,tx,token);if e!=nil{return UniversalProfile{},e}
 var previous sql.NullString
 var revision int64
 var changed sql.NullTime
 e=tx.QueryRowContext(ctx,"SELECT username,revision,username_changed_at FROM account420.profiles WHERE account_id=$1",session.account).Scan(&previous,&revision,&changed)
 if errors.Is(e,sql.ErrNoRows){revision=0;e=nil}
 if e!=nil{return UniversalProfile{},e}
 if revision!=in.ExpectedRevision{return UniversalProfile{},ErrConflict}
 current:=previous.String
 if in.Username!=current{
  // Bound username renames to one in 30 days. Removing a name also counts
  // as a change; old claims remain permanently reserved against impersonation.
  if changed.Valid{
   var canChange bool
   e=tx.QueryRowContext(ctx,"SELECT $1::timestamptz <= clock_timestamp()-interval '30 days'",changed.Time).Scan(&canChange)
   if e!=nil{return UniversalProfile{},e}
   if !canChange{return UniversalProfile{},ErrConflict}
  }
  if in.Username!=""{
   _,e=tx.ExecContext(ctx,"INSERT INTO account420.profile_username_claims(username,account_id) VALUES($1,$2) ON CONFLICT(username) DO NOTHING",in.Username,session.account)
   if e!=nil{return UniversalProfile{},e}
   var owner AccountID
   e=tx.QueryRowContext(ctx,"SELECT account_id FROM account420.profile_username_claims WHERE username=$1",in.Username).Scan(&owner)
   if e!=nil{return UniversalProfile{},e}
   if owner!=session.account{return UniversalProfile{},ErrConflict}
  }
 }
 var result UniversalProfile
 if revision==0{
  id,e:=newID();if e!=nil{return UniversalProfile{},e}
  result,e=scanProfile(tx.QueryRowContext(ctx,`INSERT INTO account420.profiles
   (account_id,profile_id,username,display_name,bio,avatar_ref,visibility,revision,username_changed_at)
   VALUES($1,$2,NULLIF($3,''),$4,$5,$6,$7,1,
     CASE WHEN $3<>'' THEN clock_timestamp() ELSE NULL END)
   RETURNING `+profileColumns,session.account,id,in.Username,in.DisplayName,in.Bio,in.AvatarRef,in.Visibility))
 }else{
  result,e=scanProfile(tx.QueryRowContext(ctx,`UPDATE account420.profiles SET
   username=NULLIF($2,''),display_name=$3,bio=$4,avatar_ref=$5,
   visibility=$6,revision=revision+1,updated_at=clock_timestamp(),
   username_changed_at=CASE WHEN COALESCE(username,'')<>$2 THEN clock_timestamp() ELSE username_changed_at END
   WHERE account_id=$1 AND revision=$7 RETURNING `+profileColumns,
   session.account,in.Username,in.DisplayName,in.Bio,in.AvatarRef,in.Visibility,in.ExpectedRevision))
 }
 if errors.Is(e,sql.ErrNoRows){return UniversalProfile{},ErrConflict}
 if e!=nil{return UniversalProfile{},e}
 if e=tx.Commit();e!=nil{return UniversalProfile{},e}
 return result,nil
}

// LookupPublicProfile is a server-side projection, never an authentication or
// cross-app capability. Only explicitly public, currently active profiles with
// their CURRENT username are discoverable. Unknown and private both return
// ErrUnavailable; formerly claimed handles do not resolve to other owners.
func (m *SessionManager) LookupPublicProfile(ctx context.Context,username string)(UniversalProfile,error){
 normalized,e:=canonicalUsername(username)
 if e!=nil||normalized==""{return UniversalProfile{},ErrInvalid}
 p,e:=scanProfile(m.auth.store.db.QueryRowContext(ctx,
  "SELECT "+profileColumns+" FROM account420.profiles p JOIN account420.accounts a ON a.id=p.account_id WHERE p.username=$1 AND p.visibility='public' AND a.status='active'",normalized))
 if errors.Is(e,sql.ErrNoRows){return UniversalProfile{},ErrUnavailable}
 return p,e
}
