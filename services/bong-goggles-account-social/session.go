package social

import (
 "context"
 "crypto/aes"
 "crypto/rand"
 "crypto/cipher"
 "crypto/sha256"
 "database/sql"
 "encoding/base64"
 "errors"
)

const (
 flowCookieName="__Host-bg_social_flow"
 sessionCookieName="__Host-bg_social"
)
type SignOn struct {
 Store *Store
 Broker Broker
 key [32]byte
}
func NewSignOn(store *Store,broker Broker,key []byte)(*SignOn,error){
 if store==nil||broker==nil||len(key)!=32{return nil,ErrInvalid}
 s:=&SignOn{Store:store,Broker:broker};copy(s.key[:],key);return s,nil
}
func encodeToken(b []byte)string{return base64.RawURLEncoding.EncodeToString(b)}
func decodeToken(s string)([]byte,error){
 if !tokenPattern.MatchString(s){return nil,ErrInvalid}
 b,e:=base64.RawURLEncoding.Strict().DecodeString(s)
 if e!=nil||len(b)!=32{return nil,ErrInvalid}
 return b,nil
}
func (s *SignOn) seal(plain []byte)([]byte,error){
 block,e:=aes.NewCipher(s.key[:]);if e!=nil{return nil,e}
 aead,e:=cipher.NewGCM(block);if e!=nil{return nil,e}
 nonce:=make([]byte,aead.NonceSize())
 if _,e=rand.Read(nonce);e!=nil{return nil,e}
 return aead.Seal(nonce,nonce,plain,[]byte("bg-social-sso-v1")),nil
}
func (s *SignOn) open(ciphertext []byte)([]byte,error){
 block,e:=aes.NewCipher(s.key[:]);if e!=nil{return nil,ErrUnavailable}
 aead,e:=cipher.NewGCM(block);if e!=nil{return nil,ErrUnavailable}
 if len(ciphertext)<aead.NonceSize()+aead.Overhead(){return nil,ErrUnavailable}
 result,e:=aead.Open(nil,ciphertext[:aead.NonceSize()],ciphertext[aead.NonceSize():],[]byte("bg-social-sso-v1"))
 if e!=nil{return nil,ErrUnavailable};return result,nil
}
func (s *SignOn) Begin(ctx context.Context)(redirect,flow string,err error){
 flowRaw,e:=random32();if e!=nil{return "","",e}
 state,e:=random32();if e!=nil{return "","",e}
 verifier,e:=random32();if e!=nil{return "","",e}
 encodedVerifier:=encodeToken(verifier)
 challenge:=sha256.Sum256([]byte(encodedVerifier))
 ciphertext,e:=s.seal([]byte(encodedVerifier));if e!=nil{return "","",e}
 flowHash,stateHash:=digestValue(flowRaw),digestValue(state)
 _,e=s.Store.DB.ExecContext(ctx,`INSERT INTO bg_account_social.login_flows
 (flow_digest,state_digest,verifier_cipher,expires_at)
 VALUES($1,$2,$3,clock_timestamp()+interval '5 minutes')`,flowHash[:],stateHash[:],ciphertext)
 if e!=nil{return "","",e}
 return s.Broker.Authorize(encodeToken(state),encodeToken(challenge[:])),encodeToken(flowRaw),nil
}
func (s *SignOn) Finish(ctx context.Context,flow,state,code string)(cookie string,err error){
 rawFlow,e:=decodeToken(flow);if e!=nil{return "",ErrForbidden}
 rawState,e:=decodeToken(state);if e!=nil{return "",ErrForbidden}
 if _,e=decodeToken(code);e!=nil{return "",ErrForbidden}
 flowHash,stateHash:=digestValue(rawFlow),digestValue(rawState)
 tx,e:=s.Store.DB.BeginTx(ctx,nil);if e!=nil{return "",e};defer tx.Rollback()
 var encrypted []byte
 e=tx.QueryRowContext(ctx,`DELETE FROM bg_account_social.login_flows
 WHERE flow_digest=$1 AND state_digest=$2 AND expires_at>clock_timestamp()
 RETURNING verifier_cipher`,flowHash[:],stateHash[:]).Scan(&encrypted)
 if errors.Is(e,sql.ErrNoRows){return "",ErrForbidden}
 if e!=nil{return "",e}
 // Consumed before network call. A failed exchange cannot be replayed.
 if e=tx.Commit();e!=nil{return "",e}
 verifier,e:=s.open(encrypted);if e!=nil{return "",e}
 token,subject,expires,e:=s.Broker.Exchange(ctx,code,string(verifier))
 if e!=nil{return "",ErrUnavailable}
 if !uuid.MatchString(subject){return "",ErrUnavailable}
 if e=s.Store.EnsureMember(ctx,subject);e!=nil{return "",e}
 protected,e:=s.seal([]byte(token));if e!=nil{return "",e}
 sessionRaw,e:=random32();if e!=nil{return "",e}
 d:=digestValue(sessionRaw)
 _,e=s.Store.DB.ExecContext(ctx,`INSERT INTO bg_account_social.sessions(cookie_digest,subject,token_cipher,expires_at)
 VALUES($1,$2,$3,$4)`,d[:],subject,protected,expires)
 if e!=nil{return "",e}
 return encodeToken(sessionRaw),nil
}
func (s *SignOn) Verify(ctx context.Context,cookie string)(string,error){
 raw,e:=decodeToken(cookie);if e!=nil{return "",ErrForbidden}
 d:=digestValue(raw)
 var subject string;var sealed []byte
 e=s.Store.DB.QueryRowContext(ctx,`SELECT subject,token_cipher FROM bg_account_social.sessions
 WHERE cookie_digest=$1 AND expires_at>clock_timestamp()`,d[:]).Scan(&subject,&sealed)
 if errors.Is(e,sql.ErrNoRows){return "",ErrForbidden}
 if e!=nil{return "",e}
 token,e:=s.open(sealed);if e!=nil{return "",e}
 actual,active,e:=s.Broker.Introspect(ctx,string(token))
 if e!=nil{return "",ErrUnavailable}
 if !active||actual!=subject||!uuid.MatchString(actual){
  _,_=s.Store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.sessions WHERE cookie_digest=$1",d[:])
  return "",ErrForbidden
 }
 return subject,nil
}
func (s *SignOn) Logout(ctx context.Context,cookie string)error{
 raw,e:=decodeToken(cookie);if e!=nil{return ErrForbidden}
 d:=digestValue(raw)
 var encrypted []byte
 e=s.Store.DB.QueryRowContext(ctx,`DELETE FROM bg_account_social.sessions
 WHERE cookie_digest=$1 RETURNING token_cipher`,d[:]).Scan(&encrypted)
 if errors.Is(e,sql.ErrNoRows){return ErrForbidden};if e!=nil{return e}
 token,e:=s.open(encrypted);if e!=nil{return e}
 // Local session is invalid immediately even if central provider is down.
 if e=s.Broker.Revoke(ctx,string(token));e!=nil{return ErrUnavailable}
 return nil
}
