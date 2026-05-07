package main

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"time"

	"github.com/fsnotify/fsnotify"
)

// fallbackPollInterval is how often FileWatcher checks for mtime changes
// when fsnotify isn't usable. 30s matches the Phase 6 plan §8.7.3 — long
// enough not to be noisy on flaky filesystems (VM-shared dirs, OneDrive),
// short enough that cross-window sync still feels responsive.
const fallbackPollInterval = 30 * time.Second

// FileWatcher fires onChange whenever the file at path is written,
// renamed-into-place, or created. fsnotify drives this in the common case;
// if NewWatcher or Add fails it transparently falls back to mtime polling.
//
// We watch the parent directory rather than the file itself because the
// stores' atomic-rename pattern (write tmp → rename) breaks file-level
// inotify subscriptions on the original inode.
type FileWatcher struct {
	path     string
	onChange func()
	stop     chan struct{}
}

func NewFileWatcher(path string, onChange func()) *FileWatcher {
	return &FileWatcher{
		path:     path,
		onChange: onChange,
		stop:     make(chan struct{}),
	}
}

// Start begins watching. Non-blocking; safe to call before the file exists.
func (w *FileWatcher) Start() {
	fw, err := fsnotify.NewWatcher()
	if err != nil {
		go w.pollLoop()
		return
	}
	dir := filepath.Dir(w.path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		fw.Close()
		go w.pollLoop()
		return
	}
	if err := fw.Add(dir); err != nil {
		fw.Close()
		go w.pollLoop()
		return
	}
	go w.fsnotifyLoop(fw)
}

func (w *FileWatcher) fsnotifyLoop(fw *fsnotify.Watcher) {
	defer fw.Close()
	target := filepath.Base(w.path)
	for {
		select {
		case <-w.stop:
			return
		case ev, ok := <-fw.Events:
			if !ok {
				return
			}
			if filepath.Base(ev.Name) != target {
				continue
			}
			// Atomic write produces Create (rename target appears) followed by
			// Rename / Write events. Trigger on any of them — the dedupe step
			// is content-hash, so spurious wakeups are cheap.
			if ev.Op&(fsnotify.Create|fsnotify.Rename|fsnotify.Write) != 0 {
				w.onChange()
			}
		case _, ok := <-fw.Errors:
			if !ok {
				return
			}
			// Errors are non-fatal — an inotify queue overflow just delays
			// the next event slightly.
		}
	}
}

func (w *FileWatcher) pollLoop() {
	var last time.Time
	if info, err := os.Stat(w.path); err == nil {
		last = info.ModTime()
	}
	ticker := time.NewTicker(fallbackPollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-w.stop:
			return
		case <-ticker.C:
			info, err := os.Stat(w.path)
			if err != nil {
				continue
			}
			if !info.ModTime().Equal(last) {
				last = info.ModTime()
				w.onChange()
			}
		}
	}
}

// Stop halts the watcher goroutine. Safe to call multiple times — but the
// caller must not — close panics on a closed channel.
func (w *FileWatcher) Stop() {
	close(w.stop)
}

// contentHash returns the hex SHA-256 of data. Used by stores to detect
// "I just wrote this exact byte sequence" echoes from fsnotify so they
// don't re-emit projects:changed for their own writes.
func contentHash(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}
