package main

import (
	"context"
	"fmt"
	"os/exec"
	"runtime"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the lifecycle struct that hosts the Wails context and exposes
// window-control bindings (needed because the window is frameless).
// Phase 6 also routes slot identity / role queries through here so the
// TitleBar can render a slot indicator.
type App struct {
	ctx  context.Context
	slot *Slot
}

func NewApp(slot *Slot) *App {
	return &App{slot: slot}
}

// GetSlot returns the slot name this window is bound to (e.g. "main",
// "second"). Used by TitleBar to render the slot indicator.
func (a *App) GetSlot() string {
	if a.slot == nil {
		return "main"
	}
	return a.slot.Name
}

// GetSlotRole returns "writer" or "reader". Frontend disables shared-state
// editing (project list, theme, consent) when this is "reader".
func (a *App) GetSlotRole() string {
	if a.slot == nil {
		return string(RoleWriter)
	}
	return string(a.slot.Role)
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// WindowMinimise minimises the application window.
func (a *App) WindowMinimise() {
	if a.ctx == nil {
		return
	}
	wruntime.WindowMinimise(a.ctx)
}

// WindowToggleMaximise toggles between maximised and normal window state.
func (a *App) WindowToggleMaximise() {
	if a.ctx == nil {
		return
	}
	wruntime.WindowToggleMaximise(a.ctx)
}

// WindowQuit terminates the application.
func (a *App) WindowQuit() {
	if a.ctx == nil {
		return
	}
	wruntime.Quit(a.ctx)
}

// RevealInExplorer opens the system file manager with the given path selected.
// On Windows, runs `explorer.exe /select,<path>`. macOS uses `open -R`. Linux falls back to
// `xdg-open` on the parent directory (it cannot select a specific entry portably).
func (a *App) RevealInExplorer(path string) error {
	if path == "" {
		return fmt.Errorf("empty path")
	}
	switch runtime.GOOS {
	case "windows":
		// "/select," must be a single argument with the path appended right
		// after, otherwise explorer ignores the selection and just opens the
		// path as a folder.
		cmd := exec.Command("explorer.exe", "/select,"+path)
		// Detach: we don't wait for explorer; Start() returns immediately.
		return cmd.Start()
	case "darwin":
		cmd := exec.Command("open", "-R", path)
		return cmd.Start()
	default:
		cmd := exec.Command("xdg-open", path)
		return cmd.Start()
	}
}

// PlatformName returns runtime.GOOS so the frontend can show platform-specific UI
// (e.g. hide "Reveal in Explorer" if the menu item label only fits Windows).
func (a *App) PlatformName() string {
	return runtime.GOOS
}
