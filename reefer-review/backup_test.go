package reeferreview

import (
	"bytes"
	"crypto/rand"
	"os"
	"path/filepath"
	"testing"
)

func TestRR9EncryptedBackupRestoreAndTampering(t *testing.T) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	src := filepath.Join(t.TempDir(), "news.json")
	if err := os.WriteFile(src, []byte("private checkpoint"), 0600); err != nil {
		t.Fatal(err)
	}
	blob, err := CreateEncryptedBackup(map[string]string{"news": src}, key)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(blob, []byte("private checkpoint")) {
		t.Fatal("plaintext leaked into encrypted archive")
	}
	dest := filepath.Join(t.TempDir(), "restore")
	if err := RestoreEncryptedBackup(blob, key, dest); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(filepath.Join(dest, "news"))
	if err != nil || string(b) != "private checkpoint" {
		t.Fatalf("restore mismatch: %s %v", b, err)
	}
	if err := RestoreEncryptedBackup(blob, key, dest); err == nil {
		t.Fatal("existing directory overwritten")
	}
	tampered := append([]byte(nil), blob...)
	tampered[len(tampered)-1] ^= 1
	if err := RestoreEncryptedBackup(tampered, key, filepath.Join(t.TempDir(), "tampered")); err == nil {
		t.Fatal("modified ciphertext accepted")
	}
	wrong := append([]byte(nil), key...)
	wrong[0] ^= 1
	if err := RestoreEncryptedBackup(blob, wrong, filepath.Join(t.TempDir(), "wrongkey")); err == nil {
		t.Fatal("wrong encryption key accepted")
	}
}

func TestRR9BackupRejectsSymlinksAndUnsafeNames(t *testing.T) {
	key := make([]byte, 32)
	path := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(path, []byte("abc"), 0600); err != nil {
		t.Fatal(err)
	}
	link := path + ".link"
	if err := os.Symlink(path, link); err != nil {
		t.Fatal(err)
	}
	if _, err := CreateEncryptedBackup(map[string]string{"linked": link}, key); err == nil {
		t.Fatal("source symlink accepted")
	}
	if _, err := CreateEncryptedBackup(map[string]string{"../escape": path}, key); err == nil {
		t.Fatal("unsafe archive name accepted")
	}
}
