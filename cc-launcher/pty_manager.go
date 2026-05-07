package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/aymanbagabas/go-pty"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// childEnv returns the env to hand to the PTY child process. Inherits the
// parent's os.Environ() and overlays the variables every modern TTY app
// expects:
//
//   - TERM=xterm-256color: tells the child it is an interactive xterm-class
//     terminal. Without it Claude Code (and other Ink/blessed-style TUIs)
//     fall back to a "dumb" rendering — no welcome banner, no 2-column
//     tips/what's-new layout, no fancy spinners.
//   - COLORTERM=truecolor: enables 24-bit color output. xterm.js handles
//     truecolor natively; without this many TUIs cap themselves at 256.
//
// Inheriting os.Environ() preserves user-set vars (PATH, HOME, USERPROFILE,
// CLAUDE_CODE_*, etc.) so the child sees the same world as if launched
// from PowerShell.
func childEnv() []string {
	env := os.Environ()
	overrides := map[string]string{
		"TERM":      "xterm-256color",
		"COLORTERM": "truecolor",
	}
	keep := env[:0]
	for _, kv := range env {
		eq := strings.IndexByte(kv, '=')
		if eq <= 0 {
			keep = append(keep, kv)
			continue
		}
		key := kv[:eq]
		if _, ok := overrides[key]; ok {
			continue // dropped; we'll re-add below
		}
		keep = append(keep, kv)
	}
	for k, v := range overrides {
		keep = append(keep, k+"="+v)
	}
	return keep
}

// session represents a single PTY-driven Claude Code process.
type session struct {
	id      string
	pty     pty.Pty
	cmd     *pty.Cmd
	closeMu sync.Mutex
	closed  bool
}

// PtyManager owns all PTY sessions and bridges them to the frontend
// via Wails events ("pty:data:<id>", "pty:exit:<id>").
type PtyManager struct {
	ctx      context.Context
	mu       sync.Mutex
	sessions map[string]*session
	nextID   atomic.Uint64
}

func NewPtyManager() *PtyManager {
	return &PtyManager{sessions: map[string]*session{}}
}

func (m *PtyManager) setContext(ctx context.Context) {
	m.ctx = ctx
}

// StartSession launches `command args...` inside a PTY at cwd.
// Returns the session id used for subsequent Write/Resize/Close calls
// and as the suffix of the data/exit event names.
func (m *PtyManager) StartSession(command string, args []string, cwd string, cols, rows int) (string, error) {
	if command == "" {
		return "", fmt.Errorf("command must not be empty")
	}
	if cols <= 0 {
		cols = 80
	}
	if rows <= 0 {
		rows = 24
	}

	resolved, err := exec.LookPath(command)
	if err != nil {
		return "", fmt.Errorf("command %q not found in PATH: %w", command, err)
	}

	p, err := pty.New()
	if err != nil {
		return "", fmt.Errorf("pty.New: %w", err)
	}
	if err := p.Resize(cols, rows); err != nil {
		_ = p.Close()
		return "", fmt.Errorf("pty.Resize: %w", err)
	}

	cmd := p.Command(resolved, args...)
	if cwd != "" {
		cmd.Dir = cwd
	}
	cmd.Env = childEnv()
	if err := cmd.Start(); err != nil {
		_ = p.Close()
		return "", fmt.Errorf("cmd.Start: %w", err)
	}

	id := fmt.Sprintf("pty-%d", m.nextID.Add(1))
	s := &session{id: id, pty: p, cmd: cmd}

	m.mu.Lock()
	m.sessions[id] = s
	m.mu.Unlock()

	go m.pump(s)
	go m.wait(s)

	return id, nil
}

func (m *PtyManager) pump(s *session) {
	buf := make([]byte, 4096)
	dataEvent := "pty:data:" + s.id
	for {
		n, err := s.pty.Read(buf)
		if n > 0 && m.ctx != nil {
			wruntime.EventsEmit(m.ctx, dataEvent, string(buf[:n]))
		}
		if err != nil {
			return
		}
	}
}

func (m *PtyManager) wait(s *session) {
	err := s.cmd.Wait()
	exitEvent := "pty:exit:" + s.id
	msg := "exited"
	if err != nil {
		msg = err.Error()
	}
	if m.ctx != nil {
		wruntime.EventsEmit(m.ctx, exitEvent, msg)
	}
	m.removeSession(s.id)
}

func (m *PtyManager) removeSession(id string) {
	m.mu.Lock()
	s, ok := m.sessions[id]
	delete(m.sessions, id)
	m.mu.Unlock()
	if ok {
		s.closeMu.Lock()
		if !s.closed {
			s.closed = true
			_ = s.pty.Close()
		}
		s.closeMu.Unlock()
	}
}

func (m *PtyManager) get(id string) (*session, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.sessions[id]
	return s, ok
}

// Write sends raw input bytes from the frontend xterm to the PTY.
func (m *PtyManager) Write(id string, data string) error {
	s, ok := m.get(id)
	if !ok {
		return fmt.Errorf("unknown session %s", id)
	}
	_, err := io.WriteString(s.pty, data)
	return err
}

// Resize informs the PTY of a new viewport size in character cells.
func (m *PtyManager) Resize(id string, cols, rows int) error {
	s, ok := m.get(id)
	if !ok {
		return fmt.Errorf("unknown session %s", id)
	}
	if cols <= 0 || rows <= 0 {
		return nil
	}
	return s.pty.Resize(cols, rows)
}

// Close terminates the underlying process and releases the PTY.
func (m *PtyManager) Close(id string) error {
	s, ok := m.get(id)
	if !ok {
		return nil
	}
	if s.cmd != nil && s.cmd.Process != nil {
		_ = s.cmd.Process.Kill()
	}
	m.removeSession(id)
	return nil
}

// Shutdown closes every active session. Called from Wails OnShutdown.
func (m *PtyManager) Shutdown() {
	m.mu.Lock()
	ids := make([]string, 0, len(m.sessions))
	for id := range m.sessions {
		ids = append(ids, id)
	}
	m.mu.Unlock()
	for _, id := range ids {
		_ = m.Close(id)
	}
}
