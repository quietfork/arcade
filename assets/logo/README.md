# Logo assets

Three SVG variants of the Arcade brand mark. All scale losslessly via `viewBox`; export to any raster size as needed.

## Files

| File | Use for | Concept |
|---|---|---|
| `arcade-mark.svg` | App icon, favicon, GitHub social preview, Twitter avatar | A doorway you walk into. The arch is the entrance, the dot is the agent inside. |
| `arcade-lockup.svg` | README hero, OG image, blog headers, slide titles | The mark plus the wordmark. Horizontal, fits banners. |
| `arcade-mono.svg` | Light-mode placements, watermark, single-color badges | The mark stripped down — pure white on transparent. Composes anywhere. |

## Colors

| Token | Hex | Role |
|---|---|---|
| Beige | `#D9C9A8` | Primary brand (parchment / cream) |
| Black | `#0F0F0F` | Background (off-black, slightly softer than pure) |
| White | `#FFFFFF` | Mono variant |

## Raster export (256 / 512 px)

```bash
# macOS / Linux (librsvg)
rsvg-convert -w 256 arcade-mark.svg -o arcade-mark-256.png
rsvg-convert -w 512 arcade-mark.svg -o arcade-mark-512.png

# Cross-platform (Inkscape CLI)
inkscape arcade-mark.svg --export-type=png --export-width=256 --export-filename=arcade-mark-256.png
inkscape arcade-mark.svg --export-type=png --export-width=512 --export-filename=arcade-mark-512.png
```

## Fonts

The lockup renders "Arcade" with `JetBrains Mono` as the primary face and falls through `ui-monospace → SFMono-Regular → Menlo → Consolas → monospace`. For pixel-perfect rendering, install JetBrains Mono.
