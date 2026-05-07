package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	slotName := flag.String("slot", "main", "Slot name for multi-window state isolation (1-32 chars, [A-Za-z0-9_-])")
	flag.Parse()

	slot, err := NewSlot(*slotName)
	if err != nil {
		fmt.Fprintf(os.Stderr, "cc-launcher: %v\n", err)
		os.Exit(2)
	}

	title := "cc-launcher"
	if slot.Name != "main" {
		title = fmt.Sprintf("cc-launcher · %s", slot.Name)
	}

	// Migrate pre-Phase-6 state files. Failures are logged but non-fatal —
	// the user falls back to defaults, which is recoverable.
	if err := migrateLayoutsToMainSlot(); err != nil {
		fmt.Fprintf(os.Stderr, "cc-launcher: layout migration warning: %v\n", err)
	}
	if err := migrateSettingsToSplit(); err != nil {
		fmt.Fprintf(os.Stderr, "cc-launcher: settings migration warning: %v\n", err)
	}

	// Acquire the slot's lock and determine writer/reader role. A fresh
	// lock on the same slot means another instance is alive — refuse to
	// start so the two windows don't fight over the same slot's storage.
	if err := slot.AcquireLocksAndDetermineRole(); err != nil {
		fmt.Fprintf(os.Stderr, "cc-launcher: %v\n", err)
		os.Exit(3)
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
