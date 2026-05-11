package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// schemaVersion 3 carries multiple named layouts in addition to the default.
const layoutsSchemaVersion = 3

// PaneSpec is one pane's launch parameters and identity. The tree references
// panes by ID; the spec is what actually starts the session on restore.
type PaneSpec struct {
	ID        string   `json:"id"`
	ProjectID string   `json:"projectId,omitempty"`
	Title     string   `json:"title,omitempty"`
	Command   string   `json:"command,omitempty"`
	Args      []string `json:"args,omitempty"`
	Cwd       string   `json:"cwd,omitempty"`
}

// TreeNode is a JSON-friendly representation of the split tree.
// Either { type:"leaf", paneId:"..." } or
//        { type:"split", dir:"h"|"v", ratio:0..1, a:..., b:... }
type TreeNode struct {
	Type   string    `json:"type"`
	PaneID string    `json:"paneId,omitempty"`
	Dir    string    `json:"dir,omitempty"`
	Ratio  float64   `json:"ratio,omitempty"`
	A      *TreeNode `json:"a,omitempty"`
	B      *TreeNode `json:"b,omitempty"`
}

// LayoutSnapshot is one named layout (the unnamed "default" or a user-named one).
type LayoutSnapshot struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Tree      *TreeNode  `json:"tree"`
	Panes     []PaneSpec `json:"panes"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

// LayoutInput is what the frontend sends for saving (no time.Time).
type LayoutInput struct {
	ID    string     `json:"id"`
	Name  string     `json:"name"`
	Tree  *TreeNode  `json:"tree"`
	Panes []PaneSpec `json:"panes"`
}

// layoutsFile v3 stores: the auto-saved default + an optional list of named layouts.
type layoutsFile struct {
	Version int              `json:"version"`
	Default LayoutSnapshot   `json:"default"`
	Named   []LayoutSnapshot `json:"named,omitempty"`
}

// LayoutStore persists the layout JSON under <DataDir>/slots/<slot>/.
// Each slot has its own layout state — pane arrangements are intentionally
// per-window, not shared (see Phase 6 plan §8.7.2).
type LayoutStore struct {
	mu   sync.Mutex
	slot *Slot
	path string
}

func NewLayoutStore(slot *Slot) *LayoutStore {
	return &LayoutStore{slot: slot}
}

func (s *LayoutStore) ensurePath() (string, error) {
	if s.path != "" {
		return s.path, nil
	}
	dir := filepath.Join(DataDir(), "slots", s.slot.Name)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", fmt.Errorf("MkdirAll: %w", err)
	}
	s.path = filepath.Join(dir, "layout.json")
	return s.path, nil
}

func (s *LayoutStore) loadFileLocked() (layoutsFile, error) {
	path, err := s.ensurePath()
	if err != nil {
		return layoutsFile{Version: layoutsSchemaVersion}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return layoutsFile{Version: layoutsSchemaVersion}, nil
		}
		return layoutsFile{Version: layoutsSchemaVersion}, fmt.Errorf("ReadFile: %w", err)
	}
	var f layoutsFile
	if err := json.Unmarshal(data, &f); err != nil {
		_ = os.Rename(path, path+".bak")
		return layoutsFile{Version: layoutsSchemaVersion},
			fmt.Errorf("layouts.json corrupt (renamed to .bak): %w", err)
	}
	if f.Version != layoutsSchemaVersion {
		_ = os.Rename(path, path+".bak")
		return layoutsFile{Version: layoutsSchemaVersion}, nil
	}
	return f, nil
}

func (s *LayoutStore) saveFileLocked(f layoutsFile) error {
	path, err := s.ensurePath()
	if err != nil {
		return err
	}
	if f.Version == 0 {
		f.Version = layoutsSchemaVersion
	}
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

func snapFromInput(in LayoutInput) LayoutSnapshot {
	snap := LayoutSnapshot{
		ID:        strings.TrimSpace(in.ID),
		Name:      strings.TrimSpace(in.Name),
		Tree:      in.Tree,
		Panes:     in.Panes,
		UpdatedAt: time.Now().UTC(),
	}
	if snap.Panes == nil {
		snap.Panes = []PaneSpec{}
	}
	return snap
}

// SaveDefault persists the supplied input as the auto-saved default layout. Atomic.
func (s *LayoutStore) SaveDefault(in LayoutInput) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	f, _ := s.loadFileLocked()
	snap := snapFromInput(in)
	if snap.ID == "" {
		snap.ID = "default"
	}
	if snap.Name == "" {
		snap.Name = "Default"
	}
	f.Default = snap
	return s.saveFileLocked(f)
}

// LoadDefault returns the auto-saved default layout.
func (s *LayoutStore) LoadDefault() (LayoutSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	f, err := s.loadFileLocked()
	if f.Default.Panes == nil {
		f.Default.Panes = []PaneSpec{}
	}
	if f.Default.ID == "" {
		f.Default.ID = "default"
	}
	if f.Default.Name == "" {
		f.Default.Name = "Default"
	}
	return f.Default, err
}

// SaveNamed adds or updates a named layout (matched by name; case-sensitive trim).
func (s *LayoutStore) SaveNamed(in LayoutInput) (LayoutSnapshot, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return LayoutSnapshot{}, fmt.Errorf("name is required")
	}
	if strings.EqualFold(in.Name, "Default") {
		return LayoutSnapshot{}, fmt.Errorf("the name \"Default\" is reserved")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	f, _ := s.loadFileLocked()

	snap := snapFromInput(in)
	if snap.ID == "" {
		snap.ID = "named-" + strings.ReplaceAll(strings.ToLower(snap.Name), " ", "-")
	}

	replaced := false
	for i, existing := range f.Named {
		if strings.EqualFold(existing.Name, snap.Name) {
			f.Named[i] = snap
			replaced = true
			break
		}
	}
	if !replaced {
		f.Named = append(f.Named, snap)
	}
	if err := s.saveFileLocked(f); err != nil {
		return LayoutSnapshot{}, err
	}
	return snap, nil
}

// ListNamed returns all named layouts (sorted by Name).
func (s *LayoutStore) ListNamed() ([]LayoutSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	f, err := s.loadFileLocked()
	if f.Named == nil {
		f.Named = []LayoutSnapshot{}
	}
	return f.Named, err
}

// LoadNamed returns the named layout with a matching name (case-insensitive).
func (s *LayoutStore) LoadNamed(name string) (LayoutSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	f, _ := s.loadFileLocked()
	target := strings.TrimSpace(name)
	for _, snap := range f.Named {
		if strings.EqualFold(snap.Name, target) {
			if snap.Panes == nil {
				snap.Panes = []PaneSpec{}
			}
			return snap, nil
		}
	}
	return LayoutSnapshot{}, fmt.Errorf("layout %q not found", name)
}

// DeleteNamed removes a named layout. No error if not found.
func (s *LayoutStore) DeleteNamed(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	f, _ := s.loadFileLocked()
	target := strings.TrimSpace(name)
	keep := f.Named[:0]
	for _, snap := range f.Named {
		if !strings.EqualFold(snap.Name, target) {
			keep = append(keep, snap)
		}
	}
	f.Named = keep
	return s.saveFileLocked(f)
}
