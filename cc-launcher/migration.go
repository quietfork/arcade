package main

import (
	"encoding/json"
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

// migrateSettingsToSplit splits a pre-Phase-6 ~/.cc-launcher/settings.json
// (version 1, all 10 fields) into:
//   - user-level: ~/.cc-launcher/settings.json (version 2, 8 fields)
//   - slot-level: ~/.cc-launcher/slots/main/slot-settings.json (version 1, 2 fields)
//
// The slot-level fields (sidebarHidden, activeView) always migrate to the
// main slot — the original UI state belongs to whichever single window
// pre-Phase-6 was running.
//
// Idempotent: a v2 user file is left alone. Migration lock-protected.
func migrateSettingsToSplit() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("UserHomeDir: %w", err)
	}
	base := filepath.Join(home, ".cc-launcher")
	if err := os.MkdirAll(base, 0o700); err != nil {
		return fmt.Errorf("MkdirAll base: %w", err)
	}

	settingsPath := filepath.Join(base, "settings.json")
	slotPath := filepath.Join(base, "slots", "main", "slot-settings.json")

	// Fast path: no legacy file.
	data, err := os.ReadFile(settingsPath)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("ReadFile settings: %w", err)
	}

	// Already migrated? Probe just the version field.
	var probe struct {
		Version int `json:"version"`
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		// Corrupt file — leave it alone, the SettingsStore will rename it
		// to .bak on next load.
		return nil
	}
	if probe.Version >= 2 {
		return nil
	}

	release, err := acquireMigrationLock(base)
	if err != nil {
		// Another instance is migrating; wait for it.
		deadline := time.Now().Add(migrationWaitTotal)
		for time.Now().Before(deadline) {
			time.Sleep(100 * time.Millisecond)
			data, err := os.ReadFile(settingsPath)
			if err != nil {
				return nil
			}
			var p struct {
				Version int `json:"version"`
			}
			if err := json.Unmarshal(data, &p); err == nil && p.Version >= 2 {
				return nil
			}
		}
		return fmt.Errorf("settings migration lock held by another instance")
	}
	defer release()

	// Re-read after lock — another instance may have completed it.
	data, err = os.ReadFile(settingsPath)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("ReadFile settings (post-lock): %w", err)
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		return nil
	}
	if probe.Version >= 2 {
		return nil
	}

	// Parse the legacy combined shape.
	var legacy struct {
		Version  int `json:"version"`
		Settings struct {
			Theme            string   `json:"theme"`
			FontFamily       string   `json:"fontFamily"`
			FontSize         int      `json:"fontSize"`
			LineHeight       float64  `json:"lineHeight"`
			DefaultCommand   string   `json:"defaultCommand"`
			DefaultArgs      []string `json:"defaultArgs"`
			Scrollback       int      `json:"scrollback"`
			DangerousConsent bool     `json:"dangerousConsent"`
			SidebarHidden    bool     `json:"sidebarHidden"`
			ActiveView       string   `json:"activeView"`
		} `json:"settings"`
	}
	if err := json.Unmarshal(data, &legacy); err != nil {
		return fmt.Errorf("parse legacy settings: %w", err)
	}

	// Write slot-settings.json under main slot.
	if err := os.MkdirAll(filepath.Dir(slotPath), 0o700); err != nil {
		return fmt.Errorf("MkdirAll slot: %w", err)
	}
	slotFile := slotSettingsFile{
		Version: slotSettingsSchemaVersion,
		Settings: SlotSettings{
			SidebarHidden: legacy.Settings.SidebarHidden,
			ActiveView:    legacy.Settings.ActiveView,
		},
	}
	if err := writeJSONAtomic(slotPath, slotFile); err != nil {
		return fmt.Errorf("write slot-settings: %w", err)
	}

	// Rewrite settings.json with version=2 and only user-level fields.
	userFile := userSettingsFile{
		Version: userSettingsSchemaVersion,
		Settings: UserSettings{
			Theme:            legacy.Settings.Theme,
			FontFamily:       legacy.Settings.FontFamily,
			FontSize:         legacy.Settings.FontSize,
			LineHeight:       legacy.Settings.LineHeight,
			DefaultCommand:   legacy.Settings.DefaultCommand,
			DefaultArgs:      legacy.Settings.DefaultArgs,
			Scrollback:       legacy.Settings.Scrollback,
			DangerousConsent: legacy.Settings.DangerousConsent,
		},
	}
	if err := writeJSONAtomic(settingsPath, userFile); err != nil {
		return fmt.Errorf("write user settings: %w", err)
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
