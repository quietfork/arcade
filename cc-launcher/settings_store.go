package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

const settingsSchemaVersion = 1

// Settings holds app-wide preferences (theme, font, etc.).
type Settings struct {
	Theme            string   `json:"theme"`            // "dark" | "light"
	FontFamily       string   `json:"fontFamily"`       // override for terminal font (empty = default)
	FontSize         int      `json:"fontSize"`         // 0 = default
	LineHeight       float64  `json:"lineHeight"`       // 0 = default
	DefaultCommand   string   `json:"defaultCommand"`   // empty = "claude"
	DefaultArgs      []string `json:"defaultArgs"`      // nil = ["--dangerously-skip-permissions"]
	Scrollback       int      `json:"scrollback"`       // 0 = 10000
	DangerousConsent bool     `json:"dangerousConsent"` // first-run --dangerously-skip-permissions consent
	// Phase 5 (VSCode-style sidebar). SidebarHidden's zero value (false) means
	// "sidebar visible" so old settings.json without the field defaults correctly.
	SidebarHidden bool   `json:"sidebarHidden"`
	ActiveView    string `json:"activeView"` // "" = "projects" (default in frontend)
}

func defaultSettings() Settings {
	return Settings{
		Theme:            "dark",
		FontFamily:       "",
		FontSize:         0,
		LineHeight:       0,
		DefaultCommand:   "claude",
		DefaultArgs:      []string{"--dangerously-skip-permissions"},
		Scrollback:       10000,
		DangerousConsent: false,
		SidebarHidden:    false,
		ActiveView:       "workspace",
	}
}

// SetConsent records the user's consent to launching with --dangerously-skip-permissions.
func (s *SettingsStore) SetConsent(v bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, err := s.loadLocked()
	if err != nil {
		cur = defaultSettings()
	}
	cur.DangerousConsent = v
	return s.saveLocked(cur)
}

type settingsFile struct {
	Version  int      `json:"version"`
	Settings Settings `json:"settings"`
}

// SettingsStore persists Settings under ~/.cc-launcher/settings.json.
type SettingsStore struct {
	mu   sync.Mutex
	path string
}

func NewSettingsStore() *SettingsStore {
	return &SettingsStore{}
}

func (s *SettingsStore) ensurePath() (string, error) {
	if s.path != "" {
		return s.path, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("UserHomeDir: %w", err)
	}
	dir := filepath.Join(home, ".cc-launcher")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", fmt.Errorf("MkdirAll: %w", err)
	}
	s.path = filepath.Join(dir, "settings.json")
	return s.path, nil
}

// Load returns the current settings, falling back to defaults if absent / corrupt.
func (s *SettingsStore) Load() (Settings, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.loadLocked()
}

func (s *SettingsStore) loadLocked() (Settings, error) {
	path, err := s.ensurePath()
	if err != nil {
		return defaultSettings(), err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return defaultSettings(), nil
		}
		return defaultSettings(), fmt.Errorf("ReadFile: %w", err)
	}
	var f settingsFile
	if err := json.Unmarshal(data, &f); err != nil {
		_ = os.Rename(path, path+".bak")
		return defaultSettings(), fmt.Errorf("settings.json corrupt (renamed to .bak): %w", err)
	}
	if f.Version != settingsSchemaVersion {
		// Migrate forward in the future; for now, discard.
		_ = os.Rename(path, path+".bak")
		return defaultSettings(), nil
	}
	// Coerce empty/invalid/legacy activeView to "workspace". "projects" and
	// "panes" were used by Phase 5 (now Phase 5.1 redesign): map "projects" to
	// "workspace" (the new combined view) and discard "panes".
	switch f.Settings.ActiveView {
	case "workspace", "explorer":
		// keep as-is
	case "projects", "panes", "":
		f.Settings.ActiveView = "workspace"
	default:
		f.Settings.ActiveView = "workspace"
	}
	return f.Settings, nil
}

// Save replaces the settings file atomically.
func (s *SettingsStore) Save(in Settings) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.saveLocked(in)
}

func (s *SettingsStore) saveLocked(in Settings) error {
	path, err := s.ensurePath()
	if err != nil {
		return err
	}
	f := settingsFile{Version: settingsSchemaVersion, Settings: in}
	data, err := json.MarshalIndent(f, "", "  ")
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

// SetTheme is a convenience updater (used by the title bar's theme toggle).
func (s *SettingsStore) SetTheme(theme string) error {
	if theme != "dark" && theme != "light" {
		return fmt.Errorf("invalid theme %q", theme)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, err := s.loadLocked()
	if err != nil {
		// fall through with defaults
		cur = defaultSettings()
	}
	cur.Theme = theme
	return s.saveLocked(cur)
}

// SetSidebarState persists the sidebar visibility + active view selected by the user.
// Allowed activeView values are "workspace" or "explorer". Other values are coerced to "workspace".
func (s *SettingsStore) SetSidebarState(hidden bool, activeView string) error {
	if activeView != "workspace" && activeView != "explorer" {
		activeView = "workspace"
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, err := s.loadLocked()
	if err != nil {
		cur = defaultSettings()
	}
	cur.SidebarHidden = hidden
	cur.ActiveView = activeView
	return s.saveLocked(cur)
}
