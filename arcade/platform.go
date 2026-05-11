package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// IsDarwin returns true if running on macOS.
func IsDarwin() bool { return runtime.GOOS == "darwin" }

// IsWindows returns true if running on Windows.
func IsWindows() bool { return runtime.GOOS == "windows" }

// IsLinux returns true if running on Linux.
func IsLinux() bool { return runtime.GOOS == "linux" }

// DataDir returns the per-user data directory for Arcade.
//
// We deliberately use the same convention on every platform
// (~/.arcade) instead of OS-specific app-support paths. This keeps
// configs portable across Win/Mac, makes the directory user-visible
// (vs hidden in ~/Library on macOS), and avoids inflating
// cross-platform code paths.
func DataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".arcade"
	}
	return filepath.Join(home, ".arcade")
}

// LookPathRobust resolves an executable name like exec.LookPath, but
// when the standard PATH search fails it falls back to platform-
// specific install locations. This matters on macOS where GUI apps
// launched via Finder/Dock inherit a minimal PATH that lacks
// /usr/local/bin and /opt/homebrew/bin — so `claude` installed via
// Homebrew or npm-global will not resolve through exec.LookPath
// alone.
func LookPathRobust(command string) (string, error) {
	if filepath.IsAbs(command) || strings.ContainsAny(command, `/\`) {
		if info, err := os.Stat(command); err == nil && !info.IsDir() {
			return command, nil
		}
	}
	if p, err := exec.LookPath(command); err == nil {
		return p, nil
	}
	for _, c := range fallbackExecPaths(command) {
		if info, err := os.Stat(c); err == nil && !info.IsDir() {
			return c, nil
		}
	}
	return "", &exec.Error{Name: command, Err: exec.ErrNotFound}
}

// fallbackExecPaths returns candidate absolute paths to try when
// exec.LookPath fails. Ordering matters: Homebrew → user-local →
// system. On Windows we also probe the npm install dir under APPDATA.
func fallbackExecPaths(name string) []string {
	var dirs []string
	switch runtime.GOOS {
	case "darwin":
		dirs = []string{
			"/opt/homebrew/bin",
			"/usr/local/bin",
			"/usr/bin",
			"/bin",
		}
		if home, err := os.UserHomeDir(); err == nil {
			dirs = append(dirs,
				filepath.Join(home, ".npm-global", "bin"),
				filepath.Join(home, ".local", "bin"),
				filepath.Join(home, ".volta", "bin"),
				filepath.Join(home, ".asdf", "shims"),
				filepath.Join(home, ".nvm", "versions", "node"),
			)
		}
	case "linux":
		dirs = []string{
			"/usr/local/bin",
			"/usr/bin",
			"/bin",
		}
		if home, err := os.UserHomeDir(); err == nil {
			dirs = append(dirs,
				filepath.Join(home, ".local", "bin"),
				filepath.Join(home, ".npm-global", "bin"),
			)
		}
	case "windows":
		if appData := os.Getenv("APPDATA"); appData != "" {
			dirs = append(dirs, filepath.Join(appData, "npm"))
		}
	}
	out := make([]string, 0, len(dirs)*3)
	for _, d := range dirs {
		out = append(out, filepath.Join(d, name))
		if runtime.GOOS == "windows" {
			out = append(out,
				filepath.Join(d, name+".exe"),
				filepath.Join(d, name+".cmd"),
			)
		}
	}
	return out
}
