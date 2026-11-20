package account

import (
 "bytes"
 "context"
 "database/sql"
 "errors"
)

// Recovery uses the existing independently verified email method, not a
// wallet, old session or browser-supplied account ID. The caller must explicitly
// select recovery and bind it to the initiating browser. Old credentials and
// sessions remain valid until a valid replacement registration commits.
func (m *SessionManager) BeginRecovery(ctx context.Context,p Authentication,binding []byte)(RegistrationOptions,error){
 if p.issuer!=m.auth||p.method!="email"||!validID(string(p.id))||len(binding)!=32{return RegistrationOptions{},ErrAuthentication}
 tx,e:=m.auth.store.db.BeginTx(ctx,nil);if e!=nil{return RegistrationOptions{},e};defer tx.Rollback()
 revision,e:=m.lockAccount(ctx,tx,p.id);if e!=nil{return RegistrationOptions{},e}
 if e=m.consumeProof(ctx,tx,p,revision);e!=nil{return RegistrationOptions{},e}
 var email string;var handle []byte
 e=tx.QueryRowContext(ctx,"SELECT i.email,i.user_handle FROM account420.email_identities i JOIN account420.passkeys p ON p.account_id=i.account_id WHERE i.account_id=$1 AND p.rp_id=$2",p.id,m.auth.rp).Scan(&email,&handle)
 if errors.Is(e,sql.ErrNoRows){return RegistrationOptions{},ErrAuthentication};if e!=nil{return RegistrationOptions{},e}
 id,e:=newID();if e!=nil{return RegistrationOptions{},e};ch,e:=randomBytes();if e!=nil{return RegistrationOptions{},e}
 _,e=tx.ExecContext(ctx,`INSERT INTO account420.recovery_challenges(id,account_id,account_revision,origin,rp_id,challenge,browser_digest,expires_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval '5 minutes') ON CONFLICT(account_id,rp_id)
 DO UPDATE SET id=EXCLUDED.id,account_revision=EXCLUDED.account_revision,origin=EXCLUDED.origin,challenge=EXCLUDED.challenge,browser_digest=EXCLUDED.browser_digest,expires_at=EXCLUDED.expires_at`,id,p.id,revision,m.auth.origin,m.auth.rp,ch,binding)
 if e!=nil{return RegistrationOptions{},e};if e=tx.Commit();e!=nil{return RegistrationOptions{},e}
 return RegistrationOptions{id,encodeBytes(ch),m.auth.rp,encodeBytes(handle),email},nil
}

// A bad/expired/replayed response cannot remove the old key. The challenge is
// single-use (consumed before signature validation, as in AUTH-2). A successful
// replacement advances the account revision and revokes all prior sessions,
// including other app scopes, without changing the stable account subjects.
func (m *SessionManager) FinishRecovery(ctx context.Context,id string,binding []byte,r RegistrationResponse)error{
 if !validID(id)||len(binding)!=32{return ErrAuthentication}
 var c ceremony
 e:=m.auth.store.db.QueryRowContext(ctx,"DELETE FROM account420.recovery_challenges WHERE id=$1 AND browser_digest=$2 AND origin=$3 AND rp_id=$4 AND expires_at>clock_timestamp() RETURNING challenge,account_id,account_revision",id,binding,m.auth.origin,m.auth.rp).Scan(&c.challenge,&c.account,&c.revision)
 if errors.Is(e,sql.ErrNoRows){return ErrAuthentication};if e!=nil{return e}
 key,count,backup,e:=verifyRegistration(m.auth.origin,m.auth.rp,c.challenge,r);if e!=nil{return e}
 tx,e:=m.auth.store.db.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 // AUTH-2 email completion locks throttle before account. Preserve that order
 // when invalidating older email codes, avoiding lock-order inversion.
 var email,lock string
 e=tx.QueryRowContext(ctx,"SELECT email FROM account420.email_identities WHERE account_id=$1",c.account).Scan(&email)
 if errors.Is(e,sql.ErrNoRows){return ErrAuthentication};if e!=nil{return e}
 e=tx.QueryRowContext(ctx,"SELECT email FROM account420.email_throttle WHERE email=$1 FOR UPDATE",email).Scan(&lock)
 if errors.Is(e,sql.ErrNoRows){return ErrAuthentication};if e!=nil{return e}
 rev,e:=m.lockAccount(ctx,tx,c.account);if e!=nil{return e};if rev!=c.revision{return ErrAuthentication}
 var oldID,oldKey []byte
 e=tx.QueryRowContext(ctx,"SELECT credential_id,public_key FROM account420.passkeys WHERE account_id=$1 AND rp_id=$2 FOR UPDATE",c.account,m.auth.rp).Scan(&oldID,&oldKey)
 if errors.Is(e,sql.ErrNoRows){return ErrAuthentication};if e!=nil{return e}
 if bytes.Equal(oldID,r.CredentialID)||bytes.Equal(oldKey,key){return ErrAuthentication}
 // Insert is conflict-safe; if any other account already owns the credential,
 // the entire transaction rolls back, preserving the old key and sessions.
 if _,e=tx.ExecContext(ctx,"DELETE FROM account420.passkeys WHERE account_id=$1 AND rp_id=$2",c.account,m.auth.rp);e!=nil{return e}
 result,e:=tx.ExecContext(ctx,"INSERT INTO account420.passkeys(credential_id,account_id,rp_id,public_key,sign_count,backup_eligible) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",r.CredentialID,c.account,m.auth.rp,key,int64(count),backup)
 if e!=nil{return e};n,e:=result.RowsAffected();if e!=nil{return e};if n!=1{return ErrAuthentication}
 if _,e=tx.ExecContext(ctx,"UPDATE account420.accounts SET revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",c.account);e!=nil{return e}
 if _,e=tx.ExecContext(ctx,"UPDATE account420.sessions SET revoked_at=clock_timestamp() WHERE account_id=$1 AND revoked_at IS NULL",c.account);e!=nil{return e}
 if _,e=tx.ExecContext(ctx,"UPDATE account420.email_challenges SET consumed=true WHERE email=$1 AND NOT consumed",email);e!=nil{return e}
 // Revision checks already invalidate stale account-bound registration and
 // recovery attempts; avoid multi-table lock inversion with concurrent begins.
 return tx.Commit()
}
