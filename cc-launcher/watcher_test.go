package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestContentHash_Stable(t *testing.T) {
	a := contentHash([]byte("hello world"))
	b := contentHash([]byte("hello world"))
	if a != b {
		t.Errorf("expected stable hash, got %s vs %s", a, b)
	}
	if a == contentHash([]byte("hello worlD")) {
		t.Error("hash collided on different input")
	}
	if contentHash(nil) != contentHash([]byte{}) {
		t.Error("nil and empty slice should hash identically")
	}
}

func TestSettingsStore_DedupeOnSelfWrite(t *testing.T) {
	// After Save, handleUserExternalChange should observe the same hash
	// and not change in-memory state. We can't directly observe the
	// "did not emit" path, but we can verify userHash matches the file.
	withTempHome(t, func(home string) {
		slot, _ := NewSlot("main")
		slot.Role = RoleWriter
		s := NewSettingsStore(slot)
		if err := s.Save(Settings{
			Theme:        "light",
			ActiveView:   "workspace",
			Scrollback:   12345,
			DefaultArgs:  []string{"--dangerously-skip-permissions"},
			DefaultCommand: "claude",
		}); err != nil {
			t.Fatal(err)
		}

		hashBefore := s.userHash
		if hashBefore == "" {
			t.Fatal("userHash should be set after Save")
		}

		// Trigger a synthetic change-notification. Since the file content
		// matches userHash, this should be a no-op.
		s.handleUserExternalChange()

		if s.userHash != hashBefore {
			t.Errorf("userHash unexpectedly changed: %s -> %s", hashBefore, s.userHash)
		}
	})
}

func TestSettingsStore_DetectExternalChange(t *testing.T) {
	withTempHome(t, func(home string) {
		slot, _ := NewSlot("main")
		slot.Role = RoleWriter
		s := NewSettingsStore(slot)
		if err := s.Save(Settings{Theme: "dark", ActiveView: "workspace"}); err != nil {
			t.Fatal(err)
		}
		hashBefore := s.userHash

		// Simulate another slot rewriting the user file with different bytes.
		userPath := filepath.Join(home, ".cc-launcher", "settings.json")
		newBytes := []byte(`{"version":2,"settings":{"theme":"light"}}`)
		if err := os.WriteFile(userPath, newBytes, 0o600); err != nil {
			t.Fatal(err)
		}

		s.handleUserExternalChange()

		if s.userHash == hashBefore {
			t.Errorf("userHash should have updated after external change")
		}
		if s.userHash != contentHash(newBytes) {
			t.Errorf("userHash mismatch: got %s want %s", s.userHash, contentHash(newBytes))
		}
	})
}

func TestProjectStore_DedupeOnSelfWrite(t *testing.T) {
	withTempHome(t, func(home string) {
		slot, _ := NewSlot("main")
		slot.Role = RoleWriter
		p := NewProjectStore(slot)

		_, err := p.Add(ProjectInput{Name: "test", Path: home})
		if err != nil {
			t.Fatal(err)
		}
		hashBefore := p.lastHash
		if hashBefore == "" {
			t.Fatal("lastHash should be set after Add")
		}

		p.handleExternalChange()

		if p.lastHash != hashBefore {
			t.Errorf("lastHash changed on self-echo: %s -> %s", hashBefore, p.lastHash)
		}
	})
}
