package interactions

import (
	"strings"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
)

func subject(kind, id string) model.SubjectRef {
	return model.SubjectRef{
		Type: strings.ToUpper(strings.TrimSpace(kind)),
		ID:   strings.TrimSpace(id),
	}
}

func unix(value int64) time.Time {
	if value <= 0 {
		return time.Time{}
	}
	return time.Unix(value, 0).UTC()
}
