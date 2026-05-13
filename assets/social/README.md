# Social media assets

Profile and cover images for social platforms.

## Files

| File | Spec | Use |
|---|---|---|
| `x-banner-1500x500.png` | 1500×500 (3:1) | X (Twitter) profile banner — Settings → Profile → Header |

## Avatar (same across platforms)

For avatars, use `../icon/arcade-240.png` (Product Hunt) or `../icon/arcade-512.png` (X / dev.to / Zenn / Discord). All derive from `../../arcade/build/appicon.png`.

## Adding new platform-specific assets

Place sized images here with a clear `{platform}-{type}-{WxH}.png` naming convention. Keep the source SVGs in `../og/` or `../logo/` and regenerate as needed via ChatGPT or local PowerShell + `System.Drawing` (see `../og/README.md` for the resize recipe).
