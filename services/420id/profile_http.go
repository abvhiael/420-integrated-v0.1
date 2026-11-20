package account

import (
 "context"
 "errors"
 "net/http"
)

// All AUTH-4 HTTP access is opt-in via existing restricted session-acceptance
// mode, bound to the same browser cookie, Origin, RP, application, rate limits,
// allowlisted email, and active account as AUTH-3. No public profile endpoint.
func (h *AcceptanceHandler) profileRoute(ctx context.Context,w http.ResponseWriter,r *http.Request,raw []byte){
 token,e:=readSessionCookie(r);if e!=nil{deny(w,401);return}
 current,e:=h.sessions.Validate(ctx,token)
 if e!=nil{deny(w,401);return}
 id,e:=h.auth.store.Resolve(ctx,current.Subject)
 if e!=nil||!h.approved(ctx,id){deny(w,401);return}
 switch r.URL.Path{
 case "/v1/profile/me":
  if !decodeRequest(raw,&struct{}{}){deny(w,400);return}
  profile,e:=h.sessions.MyProfile(ctx,token)
  if e!=nil{deny(w,401);return}
  reply(w,200,map[string]any{"profile":profile})
 case "/v1/profile/update":
  var body ProfileUpdate
  if !decodeRequest(raw,&body){deny(w,400);return}
  if _,e=normalizeProfileUpdate(body);e!=nil{deny(w,400);return}
  profile,e:=h.sessions.UpdateMyProfile(ctx,token,body)
  if errors.Is(e,ErrConflict){deny(w,409);return}
  if errors.Is(e,ErrAuthentication){deny(w,401);return}
  if e!=nil{deny(w,503);return}
  reply(w,200,map[string]any{"profile":profile})
 case "/v1/profile/lookup":
  var body struct{Username string}
  if !decodeRequest(raw,&body){deny(w,400);return}
  if name,e:=canonicalUsername(body.Username);e!=nil||name==""{deny(w,400);return}
  profile,e:=h.sessions.LookupPublicProfile(ctx,body.Username)
  if errors.Is(e,ErrUnavailable){deny(w,404);return}
  if e!=nil{deny(w,503);return}
  reply(w,200,map[string]any{"profile":profile})
 default: deny(w,404)
 }
}

// Check new schema and runtime least-privilege grants at profile-mode startup.
// The absence of migration 005 must not break AUTH-2 or AUTH-3 acceptance.
func (h *AcceptanceHandler) profileReady(ctx context.Context)error{
 var ready bool
 e:=h.auth.store.db.QueryRowContext(ctx,`SELECT
  COALESCE(has_table_privilege(current_user,to_regclass('account420.profiles'),'SELECT,INSERT,UPDATE'),false)
  AND COALESCE(has_table_privilege(current_user,to_regclass('account420.profile_username_claims'),'SELECT,INSERT'),false)`).Scan(&ready)
 if e!=nil{return e}
 if !ready{return ErrUnavailable}
 return nil
}
