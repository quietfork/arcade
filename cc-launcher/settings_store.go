package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// userSettingsSchemaVersion bumped to 2 in Phase 6 when sidebar/active-view
// state was extracted into a separate per-slot file. v1 files are migrated
// by migrateSettingsToSplit().
const userSettingsSchemaVersion = 2
const slotSettingsSchemaVersion = 1

// UserSettings is shared across all slots and is written by the main slot
// only (FR-NEW-16′ enforces this). Lives in ~/.cc-launcher/settings.json.
type UserSettings struct {
	Theme            string   `json:"theme"`            // "dark" | "light"
	FontFamily       string   `json:"fontFamily"`       // override for terminal font (empty = default)
	FontSize         int      `json:"fontSize"`         // 0 = default
	LineHeight       float64  `json:"lineHeight"`       // 0 = default
	DefaultCommand   string   `json:"defaultCommand"`   // empty = "claude"
	DefaultArgs      []string `json:"defaultArgs"`      // nil = ["--dangerously-skip-permissions"]
	Scrollback       int      `json:"scrollback"`       // 0 = 10000
	DangerousConsent bool     `json:"dangerousConsent"` // first-run --dangerously-skip-permissions consent
}

// SlotSettings is per-window UI state. Each slot owns its own copy at
// ~/.cc-launcher/slots/<slot>/slot-settings.json — every slot can write
// freely without contention.
type SlotSettings struct {
	SidebarHidden bool   `json:"sidebarHidden"`
	ActiveView    string `json:"activeView"` // "workspace" | "explorer"
}

// Settings is the merged view returned to the frontend. Same shape as the
// pre-Phase-6 single-file format so the JS bindings don't change.
type Settings struct {
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
}

func defaultUserSettings() UserSettings {
	return UserSettings{
		Theme:            "dark",
		FontFamily:       "",
		FontSize:         0,
		LineHeight:       0,
		DefaultCommand:   "claude",
		DefaultArgs:      []string{"--dangerously-skip-permissions"},
		Scrollback:       10000,
		DangerousConsent: false,
	}
}

func defaultSlotSettings() SlotSettings {
	return SlotSettings{
		SidebarHidden: false,
		ActiveView:    "workspace",
	}
}

func mergeSettings(u UserSettings, s SlotSettings) Settings {
	return Settings{
		Theme:            u.Theme,
		FontFamily:       u.FontFamily,
		FontSize:         u.FontSize,
		LineHeight:       u.LineHeight,
		DefaultCommand:   u.DefaultCommand,
		DefaultArgs:      u.DefaultArgs,
		Scrollback:       u.Scrollback,
		DangerousConsent: u.DangerousConsent,
		SidebarHidden:    s.SidebarHidden,
		ActiveView:       s.ActiveView,
	}
}

// userSettingsFile / slotSettingsFile match the on-disk JSON shape.
type userSettingsFile struct {
	Version  int          `json:"version"`
	Settings UserSettings `json:"settings"`
}

type slotSettingsFile struct {
	Version  int          `json:"version"`
	Settings SlotSettings `json:"settings"`
}

// SettingsStore reads from / writes to the two split files. The merged
// view is returned via Load / saved via Save.
type SettingsStore struct {
	ctx      context.Context
	mu       sync.Mutex
	slot     *Slot
	userPath string
	slotPath string
	// userHash is the SHA-256 of the most recent user-level bytes we
	// wrote or loaded. Used by handleUserExternalChange to skip our own
	// write echoes from the watcher.
	userHash    string
	userWatcher *FileWatcher
}

func NewSettingsStore(slot *Slot) *SettingsStore {
	return &SettingsStore{slot: slot}
}

// setContext stores the Wails ctx for emitting settings:changed events.
func (s *SettingsStore) setContext(ctx context.Context) {
	s.ctx = ctx
}

func (s *SettingsStore) ensurePaths() (userPath, slotPath string, err error) {
	if s.userPath != "" && s.slotPath != "" {
		return s.userPath, s.slotPath, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", "", fmt.Errorf("UserHomeDir: %w", err)
	}
	base := filepath.Join(home, ".cc-launcher")
	if err := os.MkdirAll(base, 0o700); err != nil {
		return "", "", fmt.Errorf("MkdirAll base: %w", err)
	}
	slotDir := filepath.Join(base, "slots", s.slot.Name)
	if err := os.MkdirAll(slotDir, 0o700); err != nil {
		return "", "", fmt.Errorf("MkdirAll slot: %w", err)
	}
	s.userPath = filepath.Join(base, "settings.json")
	s.slotPath = filepath.Join(slotDir, "slot-settings.json")
	return s.userPath, s.slotPath, nil
}

// Load returns the merged settings: user-level + slot-level. Missing or
// corrupt files fall back to defaults (corrupt files are renamed to .bak).
func (s *SettingsStore) Load() (Settings, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, _ := s.loadUserLocked()
	sl, _ := s.loadSlotLocked()
	return mergeSettings(u, sl), nil
}

func (s *SettingsStore) loadUserLocked() (UserSettings, error) {
	userPath, _, err := s.ensurePaths()
	if err != nil {
		return defaultUserSettings(), err
	}
	data, err := os.ReadFile(userPath)
	if err != nil {
		if os.IsNotExist(err) {
			s.userHash = contentHash(nil)
			return defaultUserSettings(), nil
		}
		return defaultUserSettings(), fmt.Errorf("ReadFile user: %w", err)
	}
	var f userSettingsFile
	if err := json.Unmarshal(data, &f); err != nil {
		_ = os.Rename(userPath, userPath+".bak")
		return defaultUserSettings(), fmt.Errorf("settings.json corrupt (renamed to .bak): %w", err)
	}
	if f.Version != userSettingsSchemaVersion {
		// Should have been migrated at startup. If we still see v1 here,
		// something went wrong with the migration — discard rather than
		// crash, the user can re-set their preferences.
		_ = os.Rename(userPath, userPath+".bak")
		return defaultUserSettings(), nil
	}
	s.userHash = contentHash(data)
	return f.Settings, nil
}

func (s *SettingsStore) loadSlotLocked() (SlotSettings, error) {
	_, slotPath, err := s.ensurePaths()
	if err != nil {
		return defaultSlotSettings(), err
	}
	data, err := os.ReadFile(slotPath)
	if err != nil {
		if os.IsNotExist(err) {
			return defaultSlotSettings(), nil
		}
		return defaultSlotSettings(), fmt.Errorf("ReadFile slot: %w", err)
	}
	var f slotSettingsFile
	if err := json.Unmarshal(data, &f); err != nil {
		_ = os.Rename(slotPath, slotPath+".bak")
		return defaultSlotSettings(), fmt.Errorf("slot-settings.json corrupt (renamed to .bak): %w", err)
	}
	if f.Version != slotSettingsSchemaVersion {
		_ = os.Rename(slotPath, slotPath+".bak")
		return defaultSlotSettings(), nil
	}
	// Coerce unknown / legacy view names to "workspace". Phase 5 used
	// "projects" / "panes"; Phase 5.1 collapsed them into "workspace".
	switch f.Settings.ActiveView {
	case "workspace", "explorer":
		// keep
	default:
		f.Settings.ActiveView = "workspace"
	}
	return f.Settings, nil
}

// Save replaces both files atomically. Splits the merged Settings struct
// into its user-level and slot-level components. Reader slots silently skip
// the user-level write (they can't change shared preferences); slot-level
// state is always writable.
func (s *SettingsStore) Save(in Settings) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.slot.IsWriter() {
		u := UserSettings{
			Theme:            in.Theme,
			FontFamily:       in.FontFamily,
			FontSize:         in.FontSize,
			LineHeight:       in.LineHeight,
			DefaultCommand:   in.DefaultCommand,
			DefaultArgs:      in.DefaultArgs,
			Scrollback:       in.Scrollback,
			DangerousConsent: in.DangerousConsent,
		}
		if err := s.saveUserLocked(u); err != nil {
			return err
		}
	}
	sl := SlotSettings{
		SidebarHidden: in.SidebarHidden,
		ActiveView:    in.ActiveView,
	}
	return s.saveSlotLocked(sl)
}

// saveUserLocked writes the user-level file atomically and refreshes
// userHash so the watcher dedupe step recognizes our own write.
func (s *SettingsStore) saveUserLocked(u UserSettings) error {
	return s.writeUserAtomicLocked(u)
}

func (s *SettingsStore) saveSlotLocked(sl SlotSettings) error {
	_, slotPath, err := s.ensurePaths()
	if err != nil {
		return err
	}
	return writeJSONAtomic(slotPath, slotSettingsFile{
		Version:  slotSettingsSchemaVersion,
		Settings: sl,
	})
}

func writeJSONAtomic(path string, v interface{}) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("Marshal: %w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("WriteFile tmp: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("Rename: %w", err)
	}
	return nil
}

// saveUserLockedHashed wraps the user-file write so we can update userHash
// in the same step. saveUserLocked itself stays as a thin convenience
// helper for callers that don't want to think about hashing.
func (s *SettingsStore) writeUserAtomicLocked(u UserSettings) error {
	userPath, _, err := s.ensurePaths()
	if err != nil {
		return err
	}
	f := userSettingsFile{Version: userSettingsSchemaVersion, Settings: u}
	data, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return fmt.Errorf("Marshal: %w", err)
	}
	tmp := userPath + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("WriteFile tmp: %w", err)
	}
	if err := os.Rename(tmp, userPath); err != nil {
		return fmt.Errorf("Rename: %w", err)
	}
	s.userHash = contentHash(data)
	return nil
}

// StartWatcher begins watching the user-level settings.json so reader
// slots see writes from the main slot. Slot-level state is intentionally
// not watched — it's owned by this process exclusively.
func (s *SettingsStore) StartWatcher() {
	if s.ctx == nil {
		return
	}
	s.mu.Lock()
	if s.userWatcher != nil {
		s.mu.Unlock()
		return
	}
	userPath, _, err := s.ensurePaths()
	if err != nil {
		s.mu.Unlock()
		return
	}
	s.mu.Unlock()
	w := NewFileWatcher(userPath, s.handleUserExternalChange)
	s.userWatcher = w
	w.Start()
}

// StopWatcher halts the user-settings watcher. Idempotent.
func (s *SettingsStore) StopWatcher() {
	if s.userWatcher != nil {
		s.userWatcher.Stop()
		s.userWatcher = nil
	}
}

func (s *SettingsStore) handleUserExternalChange() {
	s.mu.Lock()
	userPath, _, err := s.ensurePaths()
	if err != nil {
		s.mu.Unlock()
		return
	}
	data, err := os.ReadFile(userPath)
	if err != nil {
		s.mu.Unlock()
		return
	}
	if contentHash(data) == s.userHash {
		s.mu.Unlock()
		return
	}
	// Update cached hash so subsequent self-writes don't re-trigger.
	s.userHash = contentHash(data)
	s.mu.Unlock()

	if s.ctx != nil {
		wruntime.EventsEmit(s.ctx, "settings:changed")
	}
}

// SetTheme is a convenience updater (used by the title bar's theme toggle).
// User-level: only the writer slot may change it. Reader slots get a clear
// error so the UI can fall back to "ask the main window".
func (s *SettingsStore) SetTheme(theme string) error {
	if theme != "dark" && theme != "light" {
		return fmt.Errorf("invalid theme %q", theme)
	}
	if !s.slot.IsWriter() {
		return fmt.Errorf("slot %q is reader-only; theme can only be changed from the main window", s.slot.Name)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, _ := s.loadUserLocked()
	cur.Theme = theme
	return s.saveUserLocked(cur)
}

// SetConsent records the user's consent to launching with --dangerously-skip-permissions.
// User-level — same writer-only gate as SetTheme.
func (s *SettingsStore) SetConsent(v bool) error {
	if !s.slot.IsWriter() {
		return fmt.Errorf("slot %q is reader-only; consent can only be granted from the main window", s.slot.Name)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, _ := s.loadUserLocked()
	cur.DangerousConsent = v
	return s.saveUserLocked(cur)
}

// SetSidebarState persists the sidebar visibility + active view.
// Slot-level — every slot can update its own UI state freely.
func (s *SettingsStore) SetSidebarState(hidden bool, activeView string) error {
	if activeView != "workspace" && activeView != "explorer" {
		activeView = "workspace"
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, _ := s.loadSlotLocked()
	cur.SidebarHidden = hidden
	cur.ActiveView = activeView
	return s.saveSlotLocked(cur)
}
