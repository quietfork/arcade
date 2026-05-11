package main

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// clipboardRetention bounds how long a pasted clipboard image lives on
// disk. After SaveImage hands the path to claude the file is usually
// dereferenced within seconds — the image bytes are already in the
// model's context after the first turn. Keeping them around indefinitely
// just makes the directory grow without bound and triggers AV
// heuristics (unsigned process + many similarly-named binaries in a
// hidden dir = ransomware-shaped).
const clipboardRetention = 24 * time.Hour

// ClipboardService persists pasted images so the file path can be inserted
// into a Claude Code session. Files live under <DataDir>/clipboard.
type ClipboardService struct {
	dir string
}

func NewClipboardService() *ClipboardService {
	return &ClipboardService{}
}

func (c *ClipboardService) ensureDir() (string, error) {
	if c.dir != "" {
		return c.dir, nil
	}
	dir := filepath.Join(DataDir(), "clipboard")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", fmt.Errorf("MkdirAll: %w", err)
	}
	c.dir = dir
	return dir, nil
}

// SaveImage writes a base64-encoded image to disk and returns its absolute path.
// `ext` is the file extension without leading dot (png, jpeg, gif, webp). Empty
// values default to "png".
func (c *ClipboardService) SaveImage(b64 string, ext string) (string, error) {
	if b64 == "" {
		return "", fmt.Errorf("empty image data")
	}
	if ext == "" {
		ext = "png"
	}

	data, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return "", fmt.Errorf("base64 decode: %w", err)
	}

	dir, err := c.ensureDir()
	if err != nil {
		return "", err
	}

	name := fmt.Sprintf("paste-%s.%s", time.Now().Format("20060102-150405.000"), ext)
	full := filepath.Join(dir, name)

	if err := os.WriteFile(full, data, 0o600); err != nil {
		return "", fmt.Errorf("WriteFile: %w", err)
	}
	return full, nil
}

// PruneOld removes paste-*.* files older than clipboardRetention from the
// clipboard directory. Returns the number removed. Idempotent — safe to
// call at every startup; errors on individual files are tolerated (the
// next run will retry).
//
// Restricted to the "paste-" filename prefix so unrelated files a user
// may have copied into ~/.arcade/clipboard/ by hand stay untouched.
func (c *ClipboardService) PruneOld() (int, error) {
	dir, err := c.ensureDir()
	if err != nil {
		return 0, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0, fmt.Errorf("ReadDir: %w", err)
	}
	cutoff := time.Now().Add(-clipboardRetention)
	removed := 0
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if !strings.HasPrefix(e.Name(), "paste-") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().After(cutoff) {
			continue
		}
		if err := os.Remove(filepath.Join(dir, e.Name())); err == nil {
			removed++
		}
	}
	return removed, nil
}
