package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Lock-freshness windows. Heartbeat is updated every heartbeatInterval; if
// the file's mtime is older than heartbeatStaleTTL the holder is presumed
// dead. lockMaxTTL is the absolute fail-safe — anything older than this is
// reclaimable regardless.
const (
	heartbeatInterval = 5 * time.Second
	heartbeatStaleTTL = 30 * time.Second
	lockMaxTTL        = 24 * time.Hour
)

// LockFile is the on-disk shape of slots/<slot>/lock.json. PID, StartTime,
// ExecutablePath are recorded primarily for diagnostics; the live-vs-dead
// decision is heartbeat-based (file mtime), which works portably across
// Windows / macOS / Linux without depending on OS-specific PID liveness
// APIs. The fields remain on disk so a future patch can add a stricter
// PID + start-time check without changing the file format.
type LockFile struct {
	PID            int    `json:"pid"`
	StartTime      string `json:"startTime"`
	ExecutablePath string `json:"executablePath"`
	Slot           string `json:"slot"`
}

// SlotLock owns one slots/<slot>/lock.json file plus its heartbeat
// goroutine. Release() must be called on shutdown so other processes
// don't have to wait for the TTL.
type SlotLock struct {
	path     string
	slot     string
	stopHB   chan struct{}
	mu       sync.Mutex
	released bool
}

// AcquireSlotLock takes ownership of slots/<slot>/lock.json. Returns an
// error if another instance is alive (heartbeat fresh) on the same slot.
// Stale or missing locks are reclaimed.
func AcquireSlotLock(slotName string) (*SlotLock, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("UserHomeDir: %w", err)
	}
	dir := filepath.Join(home, ".cc-launcher", "slots", slotName)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("MkdirAll slot dir: %w", err)
	}
	lockPath := filepath.Join(dir, "lock.json")

	if err := claimLockFile(lockPath, slotName); err != nil {
		return nil, err
	}

	sl := &SlotLock{
		path:   lockPath,
		slot:   slotName,
		stopHB: make(chan struct{}),
	}
	go sl.heartbeatLoop()
	return sl, nil
}

// claimLockFile errors if an existing lock at path is still fresh; otherwise
// overwrites it with our own LockFile. "Fresh" = mtime within
// heartbeatStaleTTL AND within lockMaxTTL.
func claimLockFile(path, slot string) error {
	if info, err := os.Stat(path); err == nil {
		since := time.Since(info.ModTime())
		if since < heartbeatStaleTTL && since < lockMaxTTL {
			// Surface the holder's PID for the error message.
			pid := -1
			if data, err := os.ReadFile(path); err == nil {
				var lf LockFile
				if json.Unmarshal(data, &lf) == nil {
					pid = lf.PID
				}
			}
			return fmt.Errorf(
				"slot %q is already in use (pid=%d, last heartbeat %s ago)",
				slot, pid, since.Round(time.Second))
		}
	}

	exePath, _ := os.Executable()
	lf := LockFile{
		PID:            os.Getpid(),
		StartTime:      time.Now().UTC().Format(time.RFC3339),
		ExecutablePath: exePath,
		Slot:           slot,
	}
	data, err := json.Marshal(lf)
	if err != nil {
		return fmt.Errorf("Marshal: %w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("WriteFile tmp: %w", err)
	}
	return os.Rename(tmp, path)
}

func (s *SlotLock) heartbeatLoop() {
	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()
	for {
		select {
		case <-s.stopHB:
			return
		case <-ticker.C:
			now := time.Now()
			_ = os.Chtimes(s.path, now, now)
		}
	}
}

// Release stops the heartbeat and removes the lock file. Idempotent.
func (s *SlotLock) Release() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.released {
		return
	}
	s.released = true
	close(s.stopHB)
	_ = os.Remove(s.path)
}

// IsMainSlotLockFresh reports whether the main slot's lock has a recent
// heartbeat. Used by non-main slots to decide their initial role: a fresh
// main lock means there's a writer, so we're a reader; a stale/missing
// main lock means FR-NEW-20 will eventually let us promote ourselves.
func IsMainSlotLockFresh() (bool, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return false, err
	}
	p := filepath.Join(home, ".cc-launcher", "slots", "main", "lock.json")
	info, err := os.Stat(p)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return time.Since(info.ModTime()) < heartbeatStaleTTL, nil
}
