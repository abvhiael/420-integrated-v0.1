package model

import (
	"errors"
	"strings"
	"time"
)

type Response struct {
	ReviewID  string
	Subject   SubjectRef
	Actor     SubjectRef
	BodyRef   string
	Version   uint32
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (r Response) Validate() error {
	if strings.TrimSpace(r.ReviewID) == "" {
		return errors.New("response review id is required")
	}
	if err := r.Subject.Validate(); err != nil {
		return err
	}
	if err := r.Actor.Validate(); err != nil {
		return err
	}
	if strings.TrimSpace(r.BodyRef) == "" {
		return errors.New("response body ref is required")
	}
	if r.Version == 0 {
		return errors.New("response version is required")
	}
	if r.CreatedAt.IsZero() || r.UpdatedAt.IsZero() {
		return errors.New("response timestamps are required")
	}
	if r.UpdatedAt.Before(r.CreatedAt) {
		return errors.New("response updated time cannot precede created time")
	}
	return nil
}
