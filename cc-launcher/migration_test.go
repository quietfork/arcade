package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// withTempHome forces UserHomeDir() to return t.TempDir() by setting the
// platform-appropriate env vars, runs fn, then restores. This lets us
// exercise the migration code against a clean filesystem without risking
// the developer's real ~/.cc-launcher.
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
		newPath := filepath.Join(home, ".cc-launcher", "slots", "main", "layout.json")
		if _, err := os.Stat(newPath); !os.IsNotExist(err) {
			t.Fatalf("new path unexpectedly exists: err=%v", err)
		}
	})
}

func TestMigrateLayoutsToMainSlot_MovesFile(t *testing.T) {
	withTempHome(t, func(home string) {
		base := filepath.Join(home, ".cc-launcher")
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
		base := filepath.Join(home, ".cc-launcher")
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

func TestAcquireMigrationLock_StaleRecovery(t *testing.T) {
	withTempHome(t, func(home string) {
		base := filepath.Join(home, ".cc-launcher")
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
