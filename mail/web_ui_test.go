package mail

import (
	"os"
	"strings"
	"testing"
)

func TestDesktopMailUIProvidesQualifiedMailboxSurfaces(t *testing.T) {
	raw, err := os.ReadFile("web/index.html")
	if err != nil { t.Fatal(err) }
	ui := string(raw)
	required := []string{
		"id=\"desktop-mail-ui\"",
		"data-folder=\"INBOX\"",
		"data-folder=\"SENT\"",
		"data-view=\"drafts\"",
		"data-view=\"outbox\"",
		"data-folder=\"ARCHIVE\"",
		"data-folder=\"JUNK\"",
		"data-folder=\"TRASH\"",
		"data-search-view=\"unread\"",
		"data-search-view=\"starred\"",
		"data-view=\"conversations\"",
		"data-view=\"integrations\"",
		"/v1/mailboxes/",
		"/v1/search",
		"/v1/labels",
		"/v1/custom-folders",
		"/v1/conversations",
		"/v1/outbox",
		"/v1/drafts",
		"/v1/messages",
		"refreshCurrentList",
		"renderMailboxItems",
		"updateCurrentMailbox",
		"markCurrentUnread",
		"restoreCurrent",
		"deleteCurrent",
	}
	for _, token := range required {
		if !strings.Contains(ui, token) { t.Fatalf("desktop UI missing %q", token) }
	}
}

func TestDesktopMailUIKeepsPrivateBodyInert(t *testing.T) {
	raw, err := os.ReadFile("web/index.html")
	if err != nil { t.Fatal(err) }
	ui := string(raw)
	if !strings.Contains(ui, "body.textContent=d.body") { t.Fatal("reader no longer renders private body using textContent") }
	for _, forbidden := range []string{"body.innerHTML=d.body", "reader.innerHTML=d.body", "document.write(d.body)"} {
		if strings.Contains(ui, forbidden) { t.Fatalf("private body reaches active HTML sink: %s", forbidden) }
	}
}

func TestDesktopMailUIRetainsResponsiveDesktopShell(t *testing.T) {
	raw, err := os.ReadFile("web/index.html")
	if err != nil { t.Fatal(err) }
	ui := string(raw)
	for _, token := range []string{"grid-template-columns:240px minmax(320px,420px) minmax(420px,1fr)", "@media(max-width:820px)", "@media(max-width:620px)", "role=\"search\"", "aria-label=\"Mail navigation\"", "role=\"dialog\""} {
		if !strings.Contains(ui, token) { t.Fatalf("desktop shell/accessibility invariant missing: %q", token) }
	}
}
