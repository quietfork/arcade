package main

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

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
