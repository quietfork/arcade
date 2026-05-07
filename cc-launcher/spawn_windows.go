//go:build windows

package main

import (
	"os/exec"
	"syscall"
)

// Windows process-creation flags. Stable values from the Win32 ABI; copied
// here to avoid pulling in golang.org/x/sys/windows just for two constants.
const (
	winDetachedProcess       = 0x00000008
	winCreateNewProcessGroup = 0x00000200
)

// setupCmdDetached configures cmd so the spawned process survives the
// parent. DETACHED_PROCESS gives the child its own console (we don't
// share one anyway since the parent is a GUI), and CREATE_NEW_PROCESS_GROUP
// shields the child from Ctrl-C / job-object signals delivered to the
// parent. The new cc-launcher window still appears because Wails creates
// it explicitly — these flags govern process lifetime, not visibility.
func setupCmdDetached(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: winDetachedProcess | winCreateNewProcessGroup,
		HideWindow:    false,
	}
}
