//go:build !windows

package main

import (
	"os/exec"
	"syscall"
)

// setupCmdDetached configures cmd so the spawned process is in its own
// process group and won't be killed when the parent terminates. macOS
// ideally calls `open -n -a Arcade.app --args --slot=...` to bypass
// AppNap and open a fresh app instance, but that requires a packaged
// .app bundle; for now Linux and Darwin share this simpler Setpgid path
// which works for both go-run and packaged binaries.
func setupCmdDetached(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true,
	}
}
