package town420

import "fmt"

type ErrorKind string

const (
	ErrorInvalidRequest ErrorKind = "INVALID_REQUEST"
	ErrorUnauthorized   ErrorKind = "UNAUTHORIZED"
	ErrorForbidden      ErrorKind = "FORBIDDEN"
	ErrorNotFound       ErrorKind = "NOT_FOUND"
	ErrorConflict       ErrorKind = "CONFLICT"
	ErrorRateLimited    ErrorKind = "RATE_LIMITED"
	ErrorUnavailable    ErrorKind = "UNAVAILABLE"
	ErrorTransport      ErrorKind = "TRANSPORT"
	ErrorDecode         ErrorKind = "DECODE"
)

type Error struct {
	Kind       ErrorKind
	StatusCode int
	Detail     string
	Err        error
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	if e.Detail != "" {
		return fmt.Sprintf("%s: %s", e.Kind, e.Detail)
	}
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Kind, e.Err)
	}
	return string(e.Kind)
}

func (e *Error) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}
