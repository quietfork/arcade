import type React from 'react';

// Platform detection helpers used across the UI for OS-specific
// rendering decisions (modifier key labels, title bar layout, etc).
//
// Two-tier strategy:
//   - userAgentPlatform() is sync and good enough for keybindings and
//     modifier-key labels — it relies on navigator.platform / userAgent
//     which are available immediately at module load.
//   - The Wails-backed PlatformName() in app.go returns runtime.GOOS
//     authoritatively. App.tsx fetches it once at startup and passes it
//     down via props for code paths that must distinguish darwin from
//     darwin-on-iPad-WebView or similar edge cases.
//
// For 99% of UI choices, userAgentPlatform() is the right tool.

export type Platform = 'darwin' | 'windows' | 'linux' | 'unknown';

let cachedUA: Platform | null = null;

export function userAgentPlatform(): Platform {
    if (cachedUA !== null) return cachedUA;
    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '').toLowerCase();
    const plat = (typeof navigator !== 'undefined' ? navigator.platform || '' : '').toLowerCase();
    if (plat.startsWith('mac') || ua.includes('mac os')) cachedUA = 'darwin';
    else if (plat.startsWith('win') || ua.includes('windows')) cachedUA = 'windows';
    else if (plat.startsWith('linux') || ua.includes('linux')) cachedUA = 'linux';
    else cachedUA = 'unknown';
    return cachedUA;
}

export function isMac(): boolean {
    return userAgentPlatform() === 'darwin';
}

export function isWindows(): boolean {
    return userAgentPlatform() === 'windows';
}

export function isLinux(): boolean {
    return userAgentPlatform() === 'linux';
}

// modKey returns true when the platform-appropriate "Mod" modifier is
// held during the event. Mac uses Cmd (metaKey), Win/Linux use Ctrl.
// Keep terminal-internal copy/paste keys separate — xterm.js has its
// own convention there.
export function modKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
    return isMac() ? e.metaKey : e.ctrlKey;
}

// modKeyLabel returns the human-readable label for the platform mod
// key, used in tooltips and menus.
export function modKeyLabel(): string {
    return isMac() ? '⌘' : 'Ctrl';
}

// shiftKeyLabel / altKeyLabel return platform-appropriate symbols.
export function shiftKeyLabel(): string {
    return isMac() ? '⇧' : 'Shift';
}

export function altKeyLabel(): string {
    return isMac() ? '⌥' : 'Alt';
}

// formatShortcut builds a display string like "Ctrl+Shift+W" on Win or
// "⌘⇧W" on Mac. Tokens: 'mod', 'shift', 'alt', or a literal key name.
export function formatShortcut(...tokens: string[]): string {
    const mac = isMac();
    const sep = mac ? '' : '+';
    return tokens
        .map((t) => {
            switch (t.toLowerCase()) {
                case 'mod':
                    return modKeyLabel();
                case 'shift':
                    return shiftKeyLabel();
                case 'alt':
                    return altKeyLabel();
                default:
                    return t;
            }
        })
        .join(sep);
}

