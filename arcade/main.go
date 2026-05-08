package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// isBindingGenerationMode detects whether main() was invoked by wails build's
// wailsbindings.exe helper, which compiles our package into a temp exe and
// runs main() purely to extract Go type bindings — wails.Run() returns
// immediately without opening a window. In that mode we must skip slot
// locking entirely: (1) bindgen runs may overlap and collide on the lock,
// (2) any abnormal helper exit (rare but observed) would leave a fresh-
// looking lock pinning the slot for ~30s, blocking the user's real launch.
func isBindingGenerationMode() bool {
	exe, err := os.Executable()
	if err != nil {
		return false
	}
	return strings.Contains(strings.ToLower(filepath.Base(exe)), "wailsbindings")
}

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	slotName := flag.String("slot", "main", "Slot name for multi-window state isolation (1-32 chars, [A-Za-z0-9_-])")
	flag.Parse()

	slot, err := NewSlot(*slotName)
	if err != nil {
		fmt.Fprintf(os.Stderr, "arcade: %v\n", err)
		os.Exit(2)
	}

	title := "Arcade"
	if slot.Name != "main" {
		title = fmt.Sprintf("Arcade · %s", slot.Name)
	}

	// Skip slot locking + migrations when wails build is just generating TS
	// bindings. See isBindingGenerationMode for why.
	bindingMode := isBindingGenerationMode()
	if !bindingMode {
		// First: rename legacy ~/.cc-launcher → ~/.arcade if present.
		// All later migrations and stores assume the canonical .arcade
		// location, so this must run before anything else touches disk.
		if err := migrateLegacyDataDir(); err != nil {
			fmt.Fprintf(os.Stderr, "arcade: legacy data migration warning: %v\n", err)
		}
		// Migrate pre-Phase-6 state files. Failures are logged but
		// non-fatal — the user falls back to defaults, which is
		// recoverable.
		if err := migrateLayoutsToMainSlot(); err != nil {
			fmt.Fprintf(os.Stderr, "arcade: layout migration warning: %v\n", err)
		}
		if err := migrateSettingsToSplit(); err != nil {
			fmt.Fprintf(os.Stderr, "arcade: settings migration warning: %v\n", err)
		}
		// Acquire the slot's lock and determine writer/reader role. A
		// fresh lock on the same slot means another instance is alive —
		// refuse to start so two windows don't fight over the same
		// slot's storage.
		if err := slot.AcquireLocksAndDetermineRole(); err != nil {
			fmt.Fprintf(os.Stderr, "arcade: %v\n", err)
			os.Exit(3)
		}
		// Belt-and-suspenders: also release on any main() exit path. Any
		// panic / unexpected wails.Run error would otherwise leave the
		// lock pinned. Release is idempotent so this pairs safely with
		// the OnShutdown call below.
		defer slot.Release()
	} else {
		// Bindgen needs *something* assigned to slot.Role so binding
		// generation doesn't trip on nil-comparison logic, but no role
		// flips or file watchers are required since we won't open a
		// window. Set writer so any bind-time IsWriter() probe succeeds.
		slot.Role = RoleWriter
	}

	app := NewApp(slot)
	ptyMgr := NewPtyManager()
	clipboard := NewClipboardService()
	projects := NewProjectStore(slot)
	layouts := NewLayoutStore(slot)
	settings := NewSettingsStore(slot)
	fileBrowser := NewFileBrowser()

	err = wails.Run(&options.App{
		Title:     title,
		Width:     1280,
		Height:    800,
		MinWidth:  800,
		MinHeight: 500,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 10, G: 10, B: 10, A: 1},
		Windows: &windows.Options{
			WebviewIsTransparent:              false,
			WindowIsTranslucent:               false,
			DisableFramelessWindowDecorations: false,
		},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			ptyMgr.setContext(ctx)
			projects.setContext(ctx)
			settings.setContext(ctx)
			// Start cross-slot file watchers — must run after setContext
			// so handlers can emit Wails events.
			projects.StartWatcher()
			settings.StartWatcher()
			// Reader slots: poll for main-slot death so we can promote.
			// Fires `slot:role-changed` so the TitleBar updates instantly
			// and ProjectsView/SettingsDialog re-enable their controls.
			slot.StartPromotionLoop(func() {
				wruntime.EventsEmit(ctx, "slot:role-changed", string(slot.Role))
			})
		},
		OnShutdown: func(ctx context.Context) {
			projects.StopWatcher()
			settings.StopWatcher()
			ptyMgr.Shutdown()
			slot.Release()
		},
		Bind: []interface{}{
			app,
			ptyMgr,
			clipboard,
			projects,
			layouts,
			settings,
			fileBrowser,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
