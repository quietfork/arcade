package main

import (
	"context"
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()
	ptyMgr := NewPtyManager()
	clipboard := NewClipboardService()
	projects := NewProjectStore()
	layouts := NewLayoutStore()
	settings := NewSettingsStore()
	fileBrowser := NewFileBrowser()

	err := wails.Run(&options.App{
		Title:     "cc-launcher",
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
		},
		OnShutdown: func(ctx context.Context) {
			ptyMgr.Shutdown()
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
