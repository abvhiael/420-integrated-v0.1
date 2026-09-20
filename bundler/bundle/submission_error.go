package bundle

import "errors"

// ErrAmbiguousSubmission means the execution provider may have accepted the
// transaction even though the client did not receive a trustworthy response.
// Operators must reconcile the durable pending intent; never blindly retry.
var ErrAmbiguousSubmission = errors.New("execution transaction outcome is ambiguous; operator reconciliation required")

func ambiguousSubmission(err error) error { return errors.Join(ErrAmbiguousSubmission, err) }
