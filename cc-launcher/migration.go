package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// migrationLockTTL bounds how long another instance is allowed to hold the
// migration lock before we treat it as stale. The migration itself is a
// single rename, so anything longer than a few seconds means the prior
// holder crashed.
const migrationLockTTL = 30 * time.Second

// migrationWaitTotal is the upper bound on how long we'll wait for another
// instance to complete its migration before giving up.
const migrationWaitTotal = 3 * time.Second

// migrateLayoutsToMainSlot moves a legacy ~/.cc-launcher/layouts.json into
// ~/.cc-launcher/slots/main/layout.json. Safe to call from any slot — the
// data always belongs to "main" because pre-Phase-6 builds only knew one
// state silo.
//
// Concurrency: protected by ~/.cc-launcher/migration.lock (O_EXCL create).
// If two instances race at first launch, the loser waits for the winner
// to finish, then returns nil if the target now exists.
func migrateLayoutsToMainSlot() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("UserHomeDir: %w", err)
	}
	base := filepath.Join(home, ".cc-launcher")
	if err := os.MkdirAll(base, 0o700); err != nil {
		return fmt.Errorf("MkdirAll base: %w", err)
	}

	oldPath := filepath.Join(base, "layouts.json")
	newPath := filepath.Join(base, "slots", "main", "layout.json")

	// Fast path: nothing to migrate, or already migrated.
	if _, err := os.Stat(oldPath); os.IsNotExist(err) {
		return nil
	}
	if _, err := os.Stat(newPath); err == nil {
		return nil
	}

	release, err := acquireMigrationLock(base)
	if err != nil {
		// Couldn't grab the lock — another instance is mid-migration. Wait
		// for it and accept whatever final state they leave behind.
		deadline := time.Now().Add(migrationWaitTotal)
		for time.Now().Before(deadline) {
			time.Sleep(100 * time.Millisecond)
			if _, err := os.Stat(newPath); err == nil {
				return nil
			}
		}
		return fmt.Errorf("migration lock held by another instance")
	}
	defer release()

	// Re-check after acquiring the lock: the previous holder may have
	// completed the migration while we were waiting.
	if _, err := os.Stat(newPath); err == nil {
		return nil
	}
	if _, err := os.Stat(oldPath); os.IsNotExist(err) {
		return nil
	}

	if err := os.MkdirAll(filepath.Dir(newPath), 0o700); err != nil {
		return fmt.Errorf("MkdirAll slot dir: %w", err)
	}
	if err := os.Rename(oldPath, newPath); err != nil {
		return fmt.Errorf("Rename: %w", err)
	}
	return nil
}

// acquireMigrationLock creates ~/.cc-launcher/migration.lock with O_EXCL.
// Returns a release function that removes the lock file. If a stale lock
// from a crashed process is found (older than migrationLockTTL), it is
// removed first so this call can proceed.
func acquireMigrationLock(base string) (release func(), err error) {
	lockPath := filepath.Join(base, "migration.lock")

	if info, err := os.Stat(lockPath); err == nil {
		if time.Since(info.ModTime()) > migrationLockTTL {
			_ = os.Remove(lockPath)
		}
	}

	f, err := os.OpenFile(lockPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return nil, err
	}
	return func() {
		_ = f.Close()
		_ = os.Remove(lockPath)
	}, nil
}
