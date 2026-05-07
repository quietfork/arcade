package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// FileEntry is a single directory entry returned by ListDir.
type FileEntry struct {
	Name     string `json:"name"`
	IsDir    bool   `json:"isDir"`
	IsHidden bool   `json:"isHidden"`
}

// FileBrowser exposes a minimal directory-listing API to the frontend.
type FileBrowser struct{}

func NewFileBrowser() *FileBrowser {
	return &FileBrowser{}
}

// ListDir returns the entries inside `path`, with directories first and then
// alphabetical (case-insensitive). Hidden entries (names starting with ".")
// are included with IsHidden=true so the frontend can style them differently.
func (b *FileBrowser) ListDir(path string) ([]FileEntry, error) {
	if path == "" {
		return nil, fmt.Errorf("empty path")
	}
	dirEntries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}
	out := make([]FileEntry, 0, len(dirEntries))
	for _, e := range dirEntries {
		name := e.Name()
		out = append(out, FileEntry{
			Name:     name,
			IsDir:    e.IsDir(),
			IsHidden: strings.HasPrefix(name, "."),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDir != out[j].IsDir {
			return out[i].IsDir
		}
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	return out, nil
}

const readFileMaxBytes = 5 * 1024 * 1024 // 5 MB

// readableExtensions lists the file extensions the frontend is allowed to open
// in the reader. Limiting at the boundary avoids accidentally streaming large
// binaries into the WebView.
var readableExtensions = map[string]bool{
	".md":       true,
	".markdown": true,
}

// ReadFile returns the UTF-8 contents of a small text file. Refuses directories,
// non-allowlisted extensions, and files larger than 5 MB.
func (b *FileBrowser) ReadFile(path string) (string, error) {
	if path == "" {
		return "", fmt.Errorf("empty path")
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	if info.IsDir() {
		return "", fmt.Errorf("is a directory")
	}
	ext := strings.ToLower(filepath.Ext(path))
	if !readableExtensions[ext] {
		return "", fmt.Errorf("unsupported extension %q", ext)
	}
	if info.Size() > readFileMaxBytes {
		return "", fmt.Errorf("file too large (%d bytes, limit %d)", info.Size(), readFileMaxBytes)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
