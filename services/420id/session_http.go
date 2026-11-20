package account

import (
 "context"
 "errors"
 "net/http"
 "time"
)

const sessionCookie="__Host-420id-session"
func readSessionCookie(r *http.Request)(string,error){
 var value string;found:=false
 for _,c:=range r.Cookies(){if c.Name==sessionCookie{if found{return "",ErrInvalid};found=true;value=c.Value}}
 if !found{return "",http.ErrNoCookie}
 if _,e:=decodeToken(value);e!=nil{return "",ErrAuthentication}
 return value,nil
}
func setSessionCookie(w http.ResponseWriter,grant SessionGrant){
 maxAge:=int(time.Until(grant.Session.IdleUntil)/time.Second);if maxAge<1{maxAge=1}
 http.SetCookie(w,&http.Cookie{Name:sessionCookie,Value:grant.Token,Path:"/",Secure:true,HttpOnly:true,SameSite:http.SameSiteStrictMode,MaxAge:maxAge,Expires:grant.Session.IdleUntil})
}
func clearSessionCookie(w http.ResponseWriter){
 http.SetCookie(w,&http.Cookie{Name:sessionCookie,Value:"",Path:"/",Secure:true,HttpOnly:true,SameSite:http.SameSiteStrictMode,MaxAge:-1,Expires:time.Unix(1,0)})
}

// An authenticated browser must explicitly sign out before switching accounts
// or selecting recovery. Never silently leave a replaced session active.
func (h *AcceptanceHandler) canLogin(ctx context.Context,w http.ResponseWriter,r *http.Request)bool{
 token,e:=readSessionCookie(r)
 if errors.Is(e,http.ErrNoCookie){return true}
 if e!=nil{deny(w,403);return false}
 current,e:=h.sessions.Validate(ctx,token)
 if errors.Is(e,ErrAuthentication){return true}
 if e!=nil{deny(w,503);return false}
 id,e:=h.auth.store.Resolve(ctx,current.Subject)
 if errors.Is(e,ErrUnavailable){return true};if e!=nil{deny(w,503);return false}
 if !h.approved(ctx,id){deny(w,403);return false}
 deny(w,409);return false
}
func (h *AcceptanceHandler) sessionRoute(ctx context.Context,w http.ResponseWriter,r *http.Request,raw,binding []byte){
 if r.URL.Path=="/v1/recovery/finish"{
  var body struct{ChallengeID string;RegistrationResponse};if !decodeRequest(raw,&body){deny(w,400);return}
  if !h.canLogin(ctx,w,r){return}
  // Approval is checked again against the account bound to the recovery
  // challenge, not an email or account ID supplied in the request.
  var id AccountID
  if !validID(body.ChallengeID){deny(w,401);return}
  e:=h.auth.store.db.QueryRowContext(ctx,"SELECT account_id FROM account420.recovery_challenges WHERE id=$1 AND browser_digest=$2 AND rp_id=$3 AND app_id=$4",body.ChallengeID,binding,h.auth.rp,h.sessions.app).Scan(&id)
  if e!=nil||!h.approved(ctx,id){deny(w,401);return}
  if e=h.sessions.FinishRecovery(ctx,body.ChallengeID,binding,body.RegistrationResponse);e!=nil{deny(w,401);return}
  clearSessionCookie(w);reply(w,200,map[string]bool{"recovered":true});return
 }
 var target string
 if r.URL.Path=="/v1/session/revoke"{
  var body struct{SessionID string};if !decodeRequest(raw,&body)||!validID(body.SessionID){deny(w,400);return};target=body.SessionID
 }else if !decodeRequest(raw,&struct{}{}){deny(w,400);return}
 token,e:=readSessionCookie(r)
 if errors.Is(e,http.ErrNoCookie)&&r.URL.Path=="/v1/session/status"{reply(w,200,map[string]bool{"authenticated":false});return}
 if e!=nil{deny(w,401);return}
 current,e:=h.sessions.Validate(ctx,token)
 if errors.Is(e,ErrAuthentication)&&r.URL.Path=="/v1/session/status"{clearSessionCookie(w);reply(w,200,map[string]bool{"authenticated":false});return}
 if e!=nil{deny(w,401);return}
 // All session operations maintain the original acceptance mailbox restriction.
 id,e:=h.auth.store.Resolve(ctx,current.Subject)
 if e!=nil||!h.approved(ctx,id){
  if r.URL.Path=="/v1/session/logout"{if h.sessions.Logout(ctx,token)!=nil{deny(w,401);return};clearSessionCookie(w);reply(w,200,map[string]bool{"revoked":true});return}
  deny(w,401);return
 }
 switch r.URL.Path{
 case "/v1/session/status":reply(w,200,map[string]any{"authenticated":true,"session":current});return
 case "/v1/session/list":
  list,e:=h.sessions.List(ctx,token);if e!=nil{deny(w,401);return};reply(w,200,map[string]any{"sessions":list});return
 case "/v1/session/renew":
  grant,e:=h.sessions.Renew(ctx,token);if e!=nil{deny(w,401);return};setSessionCookie(w,grant);reply(w,200,map[string]any{"session":grant.Session});return
 case "/v1/session/logout":e=h.sessions.Logout(ctx,token)
 case "/v1/session/revoke-all":e=h.sessions.RevokeAll(ctx,token)
 case "/v1/session/revoke":e=h.sessions.Revoke(ctx,token,target)
 default:deny(w,404);return
 }
 if e!=nil{deny(w,401);return}
 if target==""||target==current.ID{clearSessionCookie(w)}
 reply(w,200,map[string]bool{"revoked":true})
}
