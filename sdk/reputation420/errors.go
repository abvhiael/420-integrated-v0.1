package reputation420

import "fmt"

type ErrorKind string

const (
	ErrorInvalidRequest ErrorKind = "INVALID_REQUEST"
	ErrorUnauthorized   ErrorKind = "UNAUTHORIZED"
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
	if e == nil { return "" }
	if e.Detail != "" && e.Err != nil { return fmt.Sprintf("420Reputation %s: %s: %v",e.Kind,e.Detail,e.Err) }
	if e.Detail != "" { return fmt.Sprintf("420Reputation %s: %s",e.Kind,e.Detail) }
	if e.Err != nil { return fmt.Sprintf("420Reputation %s: %v",e.Kind,e.Err) }
	return fmt.Sprintf("420Reputation %s",e.Kind)
}

func (e *Error) Unwrap() error { if e==nil { return nil }; return e.Err }
