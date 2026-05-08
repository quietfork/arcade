package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// withTempHome forces UserHomeDir() to return t.TempDir() by setting the
// platform-appropriate env vars, runs fn, then restores. This lets us
// exercise the migration code against a clean filesystem without risking
// the developer's real ~/.arcade.
func withTempHome(t *testing.T, fn func(home string)) {
	t.Helper()
	home := t.TempDir()
	saved := map[string]string{}
	keys := []string{"HOME", "USERPROFILE"}
	for _, k := range keys {
		saved[k] = os.Getenv(k)
		t.Setenv(k, home)
	}
	fn(home)
}

func TestMigrateLayoutsToMainSlot_NoLegacyFile(t *testing.T) {
	withTempHome(t, func(home string) {
		if err := migrateLayoutsToMainSlot(); err != nil {
			t.Fatalf("expected nil for missing legacy file, got: %v", err)
		}
		// No file should be created.
		newPath := filepath.Join(home, ".arcade", "slots", "main", "layout.json")
		if _, err := os.Stat(newPath); !os.IsNotExist(err) {
			t.Fatalf("new path unexpectedly exists: err=%v", err)
		}
	})
}

func TestMigrateLayoutsToMainSlot_MovesFile(t *testing.T) {
	withTempHome(t, func(home string) {
		base := filepath.Join(home, ".arcade")
		if err := os.MkdirAll(base, 0o700); err != nil {
			t.Fatal(err)
		}
		oldPath := filepath.Join(base, "layouts.json")
		if err := os.WriteFile(oldPath, []byte(`{"version":3}`), 0o600); err != nil {
			t.Fatal(err)
		}

		if err := migrateLayoutsToMainSlot(); err != nil {
			t.Fatalf("migrate: %v", err)
		}

		// Old gone, new present.
		if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
			t.Fatalf("old path still exists: err=%v", err)
		}
		newPath := filepath.Join(base, "slots", "main", "layout.json")
		data, err := os.ReadFile(newPath)
		if err != nil {
			t.Fatalf("read new: %v", err)
		}
		if string(data) != `{"version":3}` {
			t.Fatalf("content mismatch: %q", data)
		}
	})
}

func TestMigrateLayoutsToMainSlot_AlreadyMigrated(t *testing.T) {
	withTempHome(t, func(home string) {
		base := filepath.Join(home, ".arcade")
		newPath := filepath.Join(base, "slots", "main", "layout.json")
		if err := os.MkdirAll(filepath.Dir(newPath), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(newPath, []byte(`{"existing":true}`), 0o600); err != nil {
			t.Fatal(err)
		}
		// Add a legacy file too — migration should NOT touch it because the
		// new path already exists (idempotent guard).
		oldPath := filepath.Join(base, "layouts.json")
		if err := os.WriteFile(oldPath, []byte(`{"legacy":true}`), 0o600); err != nil {
			t.Fatal(err)
		}

		if err := migrateLayoutsToMainSlot(); err != nil {
			t.Fatalf("migrate: %v", err)
		}

		data, err := os.ReadFile(newPath)
		if err != nil {
			t.Fatal(err)
		}
		if string(data) != `{"existing":true}` {
			t.Fatalf("new file was overwritten: %q", data)
		}
	})
}

func TestMigrateSettingsToSplit_NoLegacyFile(t *testing.T) {
	withTempHome(t, func(home string) {
		if err := migrateSettingsToSplit(); err != nil {
			t.Fatalf("expected nil for missing legacy: %v", err)
		}
	})
}

func TestMigrateSettingsToSplit_AlreadyV2(t *testing.T) {
	withTempHome(t, func(home string) {
		base := filepath.Join(home, ".arcade")
		if err := os.MkdirAll(base, 0o700); err != nil {
			t.Fatal(err)
		}
		// v2 file shouldn't be touched.
		settingsPath := filepath.Join(base, "settings.json")
		original := `{"version":2,"settings":{"theme":"light"}}`
		if err := os.WriteFile(settingsPath, []byte(original), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := migrateSettingsToSplit(); err != nil {
			t.Fatalf("migrate: %v", err)
		}
		got, err := os.ReadFile(settingsPath)
		if err != nil {
			t.Fatal(err)
		}
		if string(got) != original {
			t.Errorf("v2 file was modified: %q", got)
		}
		// No slot file should be created.
		slotPath := filepath.Join(base, "slots", "main", "slot-settings.json")
		if _, err := os.Stat(slotPath); !os.IsNotExist(err) {
			t.Errorf("slot file unexpectedly created: %v", err)
		}
	})
}

func TestMigrateSettingsToSplit_SplitsV1(t *testing.T) {
	withTempHome(t, func(home string) {
		base := filepath.Join(home, ".arcade")
		if err := os.MkdirAll(base, 0o700); err != nil {
			t.Fatal(err)
		}
		legacy := `{
			"version": 1,
			"settings": {
				"theme": "light",
				"fontSize": 14,
				"defaultCommand": "claude",
				"defaultArgs": ["--dangerously-skip-permissions"],
				"scrollback": 8000,
				"dangerousConsent": true,
				"sidebarHidden": true,
				"activeView": "explorer"
			}
		}`
		settingsPath := filepath.Join(base, "settings.json")
		if err := os.WriteFile(settingsPath, []byte(legacy), 0o600); err != nil {
			t.Fatal(err)
		}

		if err := migrateSettingsToSplit(); err != nil {
			t.Fatalf("migrate: %v", err)
		}

		// User file: version 2, no slot fields.
		userBytes, err := os.ReadFile(settingsPath)
		if err != nil {
			t.Fatal(err)
		}
		var userF userSettingsFile
		if err := json.Unmarshal(userBytes, &userF); err != nil {
			t.Fatal(err)
		}
		if userF.Version != 2 {
			t.Errorf("user version=%d want 2", userF.Version)
		}
		if userF.Settings.Theme != "light" || userF.Settings.FontSize != 14 ||
			userF.Settings.Scrollback != 8000 || !userF.Settings.DangerousConsent {
			t.Errorf("user settings not preserved: %+v", userF.Settings)
		}

		// Slot file: written under main, contains the extracted fields.
		slotPath := filepath.Join(base, "slots", "main", "slot-settings.json")
		slotBytes, err := os.ReadFile(slotPath)
		if err != nil {
			t.Fatalf("slot file missing: %v", err)
		}
		var slotF slotSettingsFile
		if err := json.Unmarshal(slotBytes, &slotF); err != nil {
			t.Fatal(err)
		}
		if slotF.Version != 1 {
			t.Errorf("slot version=%d want 1", slotF.Version)
		}
		if !slotF.Settings.SidebarHidden || slotF.Settings.ActiveView != "explorer" {
			t.Errorf("slot fields not extracted: %+v", slotF.Settings)
		}
	})
}

func TestAcquireMigrationLock_StaleRecovery(t *testing.T) {
	withTempHome(t, func(home string) {
		base := filepath.Join(home, ".arcade")
		if err := os.MkdirAll(base, 0o700); err != nil {
			t.Fatal(err)
		}
		// Plant a stale lock file with mtime older than TTL.
		lockPath := filepath.Join(base, "migration.lock")
		if err := os.WriteFile(lockPath, nil, 0o600); err != nil {
			t.Fatal(err)
		}
		old := time.Now().Add(-2 * migrationLockTTL)
		if err := os.Chtimes(lockPath, old, old); err != nil {
			t.Fatal(err)
		}

		release, err := acquireMigrationLock(base)
		if err != nil {
			t.Fatalf("expected stale lock to be reclaimed, got: %v", err)
		}
		release()
	})
}
