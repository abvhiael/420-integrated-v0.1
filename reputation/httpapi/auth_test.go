package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHeaderAuthenticatorRequiresTypedSubject(t *testing.T) {
	auth:=HeaderAuthenticator{}
	req:=httptest.NewRequest(http.MethodPost,"/v1/reviews",nil)
	if _,err:=auth.Authenticate(req); err==nil { t.Fatal("expected missing principal rejection") }

	req.Header.Set("X-420-Subject-Type","PROFILE")
	req.Header.Set("X-420-Subject-ID","profile-1")
	got,err:=auth.Authenticate(req)
	if err!=nil { t.Fatal(err) }
	if got.Type!="PROFILE" || got.ID!="profile-1" { t.Fatalf("principal=%+v",got) }
}

func TestHeaderAuthenticatorSupportsConfiguredHeaderNames(t *testing.T) {
	auth:=HeaderAuthenticator{SubjectTypeHeader:"X-Test-Type",SubjectIDHeader:"X-Test-ID"}
	req:=httptest.NewRequest(http.MethodPost,"/v1/reviews",nil)
	req.Header.Set("X-Test-Type","PROFILE")
	req.Header.Set("X-Test-ID","profile-2")
	got,err:=auth.Authenticate(req)
	if err!=nil { t.Fatal(err) }
	if got.ID!="profile-2" { t.Fatalf("principal=%+v",got) }
}
