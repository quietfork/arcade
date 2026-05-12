# OG / social preview assets

Two SVGs designed for the wide aspect ratios that social platforms use.

| File | Aspect | Use |
|---|---|---|
| `og-1200x630.svg` | 1200×630 (1.91:1) | OG / Twitter card / LinkedIn / Slack unfurl / Discord embed. Embed in HTML `<meta property="og:image">` and `<meta name="twitter:image">`. |
| `github-social-1280x640.svg` | 1280×640 (2:1) | GitHub repo "Social preview" image. Upload via *Settings → Options → Social preview*. |

## Layout

Both SVGs use the same composition:

- **Mark** (the arch + dot from `assets/logo/arcade-mark.svg`) on the left, scaled to ~360px
- **Wordmark** "Arcade" — JetBrains Mono, 142–148px, beige `#D9C9A8`
- **Two-line tagline** — Inter, 26–27px, muted `#9C9C9C`
- **GitHub URL footer** — bottom-right, tiny, JetBrains Mono, `#6E6E6E`
- **Faint terminal-grid lines** at ~4% opacity to hint at the multi-pane theme
- **Radial gradient background** (`#1A1A1A` → `#0A0A0A`) for subtle depth without distracting from the mark
- **Soft drop shadow** on the mark via SVG filter

## Raster export (when ready)

Both SVGs need to be rendered to PNG before upload — most platforms don't accept SVG directly.

### Option A: ImageMagick (recommended)

```bash
# Install once
winget install --id ImageMagick.ImageMagick -e

# Convert
magick -background none -density 150 og-1200x630.svg og-1200x630.png
magick -background none -density 150 github-social-1280x640.svg github-social-1280x640.png
```

### Option B: Inkscape (best font fidelity)

```bash
# Install once
winget install --id Inkscape.Inkscape -e

# Convert
inkscape og-1200x630.svg --export-type=png --export-filename=og-1200x630.png
inkscape github-social-1280x640.svg --export-type=png --export-filename=github-social-1280x640.png
```

### Option C: online (no install)

[CloudConvert](https://cloudconvert.com/svg-to-png) or [Convertio](https://convertio.co/svg-png/) — drag-drop the SVG, pick a width, download.

## Font note

Both SVGs reference `JetBrains Mono` for the wordmark. If your converter renders without that font installed, it falls back to a generic monospace which is acceptable but less crisp. For best fidelity, install JetBrains Mono before rendering:

```powershell
winget install --id JetBrains.JetBrainsMono -e
```
