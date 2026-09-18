package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/420integrated/420-integrated/reputation/model"
)

type Authenticator interface {
	Authenticate(*http.Request) (model.SubjectRef, error)
}

type HeaderAuthenticator struct {
	SubjectTypeHeader string
	SubjectIDHeader   string
}

func (a HeaderAuthenticator) Authenticate(r *http.Request) (model.SubjectRef, error) {
	typeHeader:=strings.TrimSpace(a.SubjectTypeHeader)
	idHeader:=strings.TrimSpace(a.SubjectIDHeader)
	if typeHeader=="" { typeHeader="X-420-Subject-Type" }
	if idHeader=="" { idHeader="X-420-Subject-ID" }
	subject:=model.SubjectRef{
		Type:strings.TrimSpace(r.Header.Get(typeHeader)),
		ID:strings.TrimSpace(r.Header.Get(idHeader)),
	}
	if err:=subject.Validate(); err!=nil {
		return model.SubjectRef{},errors.New("authenticated Reputation subject is required")
	}
	return subject,nil
}

func requirePrincipal(r *http.Request, auth Authenticator, claimed model.SubjectRef) error {
	if auth==nil {
		return errors.New("Reputation authenticator unavailable")
	}
	principal,err:=auth.Authenticate(r)
	if err!=nil { return err }
	if principal!=claimed {
		return errors.New("authenticated Reputation subject does not match claimed actor")
	}
	return nil
}
