package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// schemaVersion lets future migrations detect the on-disk layout.
const projectsSchemaVersion = 1

// Project is one registered local directory associated with Claude Code launch settings.
type Project struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Path       string            `json:"path"`
	Command    string            `json:"command,omitempty"`
	Args       []string          `json:"args,omitempty"`
	Env        map[string]string `json:"env,omitempty"`
	Tags       []string          `json:"tags,omitempty"`
	CreatedAt  time.Time         `json:"createdAt"`
	LastUsedAt time.Time         `json:"lastUsedAt,omitempty"`
}

// ProjectInput is what the frontend sends for create / update.
type ProjectInput struct {
	Name    string            `json:"name"`
	Path    string            `json:"path"`
	Command string            `json:"command,omitempty"`
	Args    []string          `json:"args,omitempty"`
	Env     map[string]string `json:"env,omitempty"`
	Tags    []string          `json:"tags,omitempty"`
}

// ProjectStore persists the project catalog as JSON under ~/.cc-launcher.
// Phase 6: projects.json is shared across all slots; only the writer slot
// (the one holding ~/.cc-launcher/slots/main/lock.json) may mutate it.
// Reader slots fall back to read-only methods (List, ListWithStatus).
type ProjectStore struct {
	ctx      context.Context
	mu       sync.Mutex
	slot     *Slot
	path     string
	projects []Project
	loaded   bool
}

func NewProjectStore(slot *Slot) *ProjectStore {
	return &ProjectStore{slot: slot}
}

// readOnlyError is returned by mutating methods when the current slot
// doesn't hold writer role. Frontend will surface this as a toast
// suggesting the user switch to the main window.
func (s *ProjectStore) readOnlyError() error {
	return fmt.Errorf("slot %q is reader-only; project changes must be made from the main window", s.slot.Name)
}

func (s *ProjectStore) setContext(ctx context.Context) {
	s.ctx = ctx
}

func (s *ProjectStore) ensurePath() (string, error) {
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
	s.path = filepath.Join(dir, "projects.json")
	return s.path, nil
}

type projectsFile struct {
	Version  int       `json:"version"`
	Projects []Project `json:"projects"`
}

func (s *ProjectStore) load() error {
	if s.loaded {
		return nil
	}
	path, err := s.ensurePath()
	if err != nil {
		return err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			s.projects = []Project{}
			s.loaded = true
			return nil
		}
		return fmt.Errorf("ReadFile: %w", err)
	}
	var f projectsFile
	if err := json.Unmarshal(data, &f); err != nil {
		// Best effort: rename corrupt file aside so app can keep running.
		_ = os.Rename(path, path+".bak")
		s.projects = []Project{}
		s.loaded = true
		return fmt.Errorf("projects.json corrupt (renamed to .bak): %w", err)
	}
	s.projects = f.Projects
	s.loaded = true
	return nil
}

// saveLocked must be called with s.mu held.
func (s *ProjectStore) saveLocked() error {
	path, err := s.ensurePath()
	if err != nil {
		return err
	}
	f := projectsFile{Version: projectsSchemaVersion, Projects: s.projects}
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

// List returns all registered projects. Order: registration order.
// Each project's PathExists field is set by ListWithStatus; List itself
// returns the raw catalog.
func (s *ProjectStore) List() ([]Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return nil, err
	}
	out := make([]Project, len(s.projects))
	copy(out, s.projects)
	return out, nil
}

// ProjectStatus pairs a project with derived runtime info (path existence).
type ProjectStatus struct {
	Project    Project `json:"project"`
	PathExists bool    `json:"pathExists"`
}

// ListWithStatus is what the sidebar consumes — it includes path existence
// validation per FR-107.
func (s *ProjectStore) ListWithStatus() ([]ProjectStatus, error) {
	projects, err := s.List()
	if err != nil {
		return nil, err
	}
	out := make([]ProjectStatus, 0, len(projects))
	for _, p := range projects {
		exists := false
		if info, err := os.Stat(p.Path); err == nil && info.IsDir() {
			exists = true
		}
		out = append(out, ProjectStatus{Project: p, PathExists: exists})
	}
	return out, nil
}

// Add registers a new project.
func (s *ProjectStore) Add(in ProjectInput) (Project, error) {
	if !s.slot.IsWriter() {
		return Project{}, s.readOnlyError()
	}
	if in.Name == "" {
		return Project{}, fmt.Errorf("name is required")
	}
	if in.Path == "" {
		return Project{}, fmt.Errorf("path is required")
	}

	abs, err := filepath.Abs(in.Path)
	if err != nil {
		return Project{}, fmt.Errorf("Abs: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return Project{}, err
	}

	p := Project{
		ID:        uuid.NewString(),
		Name:      in.Name,
		Path:      abs,
		Command:   in.Command,
		Args:      in.Args,
		Env:       in.Env,
		Tags:      in.Tags,
		CreatedAt: time.Now().UTC(),
	}
	s.projects = append(s.projects, p)
	if err := s.saveLocked(); err != nil {
		// roll back in-memory change
		s.projects = s.projects[:len(s.projects)-1]
		return Project{}, err
	}
	return p, nil
}

// Update modifies fields on an existing project.
func (s *ProjectStore) Update(id string, in ProjectInput) (Project, error) {
	if !s.slot.IsWriter() {
		return Project{}, s.readOnlyError()
	}
	if in.Name == "" {
		return Project{}, fmt.Errorf("name is required")
	}
	if in.Path == "" {
		return Project{}, fmt.Errorf("path is required")
	}
	abs, err := filepath.Abs(in.Path)
	if err != nil {
		return Project{}, fmt.Errorf("Abs: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return Project{}, err
	}

	idx := -1
	for i, p := range s.projects {
		if p.ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		return Project{}, fmt.Errorf("project %s not found", id)
	}
	prev := s.projects[idx]
	updated := prev
	updated.Name = in.Name
	updated.Path = abs
	updated.Command = in.Command
	updated.Args = in.Args
	updated.Env = in.Env
	updated.Tags = in.Tags
	s.projects[idx] = updated
	if err := s.saveLocked(); err != nil {
		s.projects[idx] = prev
		return Project{}, err
	}
	return updated, nil
}

// Delete removes a project from the catalog (does not touch the directory).
func (s *ProjectStore) Delete(id string) error {
	if !s.slot.IsWriter() {
		return s.readOnlyError()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i, p := range s.projects {
		if p.ID == id {
			prev := s.projects
			s.projects = append(s.projects[:i], s.projects[i+1:]...)
			if err := s.saveLocked(); err != nil {
				s.projects = prev
				return err
			}
			return nil
		}
	}
	return fmt.Errorf("project %s not found", id)
}

// MarkUsed updates the lastUsedAt timestamp (used after launching a session).
// Reader slots silently no-op rather than erroring — launching from a reader
// slot is normal usage; the lastUsedAt counter is best-effort metadata.
func (s *ProjectStore) MarkUsed(id string) error {
	if !s.slot.IsWriter() {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i, p := range s.projects {
		if p.ID == id {
			s.projects[i].LastUsedAt = time.Now().UTC()
			return s.saveLocked()
		}
	}
	return fmt.Errorf("project %s not found", id)
}

// PickDirectory opens the OS-native folder picker (FR-101 8.2).
// `defaultPath` may be empty.
func (s *ProjectStore) PickDirectory(defaultPath string) (string, error) {
	if s.ctx == nil {
		return "", fmt.Errorf("Wails context not initialized")
	}
	opts := wruntime.OpenDialogOptions{
		Title:                "Select project folder",
		DefaultDirectory:     defaultPath,
		CanCreateDirectories: true,
	}
	return wruntime.OpenDirectoryDialog(s.ctx, opts)
}

// ensures projects are sorted (registration order — currently a no-op kept
// for forward-compat with FR-105 reorder feature).
var _ = sort.Slice
