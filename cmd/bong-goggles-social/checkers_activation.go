package main

import "errors"

// CK-1.2 establishes registration, not gameplay authorization. Until the
// compiled Checkers rules adapter is independently qualified, all opt-ins fail.
func configureCheckers(mode string) error {
 switch mode {
 case "", "disabled": return nil
 default: return errors.New("SOCIAL420_CHECKERS_MODE: Checkers gameplay is not release-qualified")
 }
}
