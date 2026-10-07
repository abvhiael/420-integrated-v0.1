package media420

import (
	"fmt"

	mediaapi "github.com/420integrated/420-integrated/media/api"
)

type ErrorKind string

const (
	ErrorInvalidRequest      ErrorKind = "invalid_request"
	ErrorUnauthorized        ErrorKind = "unauthorized"
	ErrorForbidden           ErrorKind = "forbidden"
	ErrorNotFound            ErrorKind = "not_found"
	ErrorConflict            ErrorKind = "conflict"
	ErrorIdempotencyConflict ErrorKind = "idempotency_conflict"
	ErrorRateLimited         ErrorKind = "rate_limited"
	ErrorUnavailable         ErrorKind = "unavailable"
	ErrorCompatibility       ErrorKind = "compatibility"
	ErrorTransport           ErrorKind = "transport"
	ErrorDecode              ErrorKind = "decode"
)

type Error struct {
	Kind       ErrorKind
	StatusCode int
	Code       mediaapi.ErrorCode
	Detail     string
	Err        error
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	if e.StatusCode != 0 {
		return fmt.Sprintf("420Media API %d %s: %s", e.StatusCode, e.Code, e.Detail)
	}
	if e.Detail != "" {
		return "420Media SDK: " + e.Detail
	}
	if e.Err != nil {
		return "420Media SDK: " + e.Err.Error()
	}
	return "420Media SDK error"
}

func (e *Error) Unwrap() error { return e.Err }
