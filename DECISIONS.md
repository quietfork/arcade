# Architecture Decision Records

This file records *why* Arcade is built the way it is. Each entry is an [ADR](https://github.com/joelparkerhenderson/architecture-decision-record) — short, dated, and pointing at the concrete trade-offs.

Updates: new decisions append. Reversed decisions get a `**Status: superseded by ADR-NNN**` note rather than being deleted.

---

## ADR-001 — Wails over Electron and Tauri

**Date**: 2026-05-06
**Status**: Accepted

### Context

Arcade needs a native desktop app that hosts terminal panes and talks to local PTYs. Three realistic shapes:

1. **Electron** (Chromium + Node.js)
2. **Tauri** (Rust + system WebView)
3. **Wails v2** (Go + system WebView)

A pure-native (Win32 + AppKit) build was considered and rejected — too much platform-specific surface for a single-developer project.

### Decision

Wails v2.

### Rationale

| Criterion | Electron | Tauri | Wails | Notes |
|---|---|---|---|---|
| Binary size | 150+ MB | 5–10 MB | 15–25 MB | Wails ships smaller than Electron, slightly larger than Tauri due to Go runtime |
| Backend language | JavaScript / Node | Rust | Go | Go ergonomics for PTY management are mature and familiar |
| PTY libraries | node-pty | various Rust crates | go-pty | All work; go-pty has the cleanest cross-platform API I found |
| TypeScript bindings | manual or ts-rs | auto from #[tauri::command] | auto from Go structs | Wails generates TS types from Go method signatures with zero ceremony |
| Distribution | electron-builder | tauri bundler | wails build -nsis / -dmg | Comparable. Wails uses native NSIS on Windows |
| Prior experience | yes | no | yes | I'd shipped a Wails app before |

The deciding factor was a combination of (a) PTY handling in Go being mature and (b) my own muscle memory with the Wails toolchain. Tauri would have been equally defensible; Electron's binary size was a hard veto for a tool meant to launch dozens of times a day.

### Consequences

- **Positive**: small binary, fast cold start (<1s on typical hardware), idiomatic Go on the backend.
- **Positive**: TypeScript bindings auto-generated — no manual sync between frontend and backend types.
- **Negative**: Wails v2 only supports one window per process. Multi-window support required the workaround in ADR-004.
- **Negative**: ecosystem is smaller than Electron's. Some niceties (auto-updater, native menus) are less polished.

---

## ADR-002 — go-pty for cross-platform pseudo-terminals

**Date**: 2026-05-06
**Status**: Accepted

### Context

Running `claude` in a pane requires a pseudo-terminal. On Windows, that's ConPTY (the Win10+ API; classic PIPE-based PTYs don't support modern TUI). On macOS/Linux, that's POSIX PTY (forkpty / openpty).

Libraries considered:

1. **`github.com/aymanbagabas/go-pty`** — cross-platform wrapper over ConPTY + POSIX
2. **`github.com/creack/pty`** — POSIX-only (Win support was added later but is less battle-tested)
3. **`github.com/UserExistsError/conpty`** — Windows-only

### Decision

`go-pty`.

### Rationale

One library covering both platforms removed an entire class of "it works on my machine" problems. The API is small and idiomatic — `pty.New()`, `pty.Start(cmd)`, `pty.Resize(cols, rows)`. The maintainer is responsive to issues.

### Consequences

- **Positive**: same code path on all platforms; reduces the test matrix.
- **Positive**: ConPTY abstracted away (Windows ConPTY's behavior is subtle, particularly around process group signals).
- **Negative**: locked in to whatever go-pty exposes. Anything below the abstraction (raw winsize ioctls, custom signal forwarding) would require dropping into platform-specific code.

---

## ADR-003 — Custom split tree, not react-grid-layout

**Date**: 2026-05-06
**Status**: Accepted (supersedes initial requirement)

### Context

The original requirements doc called for a 12-column grid layout in the style of Apache Superset. `react-grid-layout` is the de facto choice for that pattern and was the first implementation.

### Decision

Replace `react-grid-layout` with a custom recursive split tree.

### Rationale

After two days of using the grid prototype, three UX problems surfaced:

1. **Snapping to grid cells doesn't match user intent.** When splitting a pane, the natural ratio is 1:1 or some explicit fraction. A 12-column grid forces integer column math: a 7:5 split is the closest approximation to 60:40, but the actual divider position doesn't land where the user dragged.
2. **Empty cells look broken.** Dashboards intentionally leave gaps; terminals don't. Any gap is wasted real estate, which is hostile in a tool you live in.
3. **Drag interactions fought with xterm.** react-grid-layout consumes pointer events for cell positioning; xterm needs them for selection. Reconciling required event propagation hacks across three layers.

The replacement is a recursive tree where each node is either a leaf (one pane) or a split (direction + ratio + two children). Splitting a leaf turns it into a split with the old leaf and a new leaf as children. Closing collapses a split back to its sibling. Resizing changes ratios.

```typescript
type Leaf = { kind: 'leaf'; paneId: string };
type Split = { kind: 'split'; dir: 'h' | 'v'; ratio: number; a: Tree; b: Tree };
type Tree = Leaf | Split;
```

Render pass: walk the tree, accumulate bounding boxes, render leaves at absolute positions. About 300 LOC including the divider drag handler. Layout JSON schema changed from `[{x,y,w,h}]` to a nested tree.

### Consequences

- **Positive**: free splits, no grid math, no empty-cell ugliness.
- **Positive**: terminals only re-render when their bounding box changes — actually faster than the grid implementation despite being "hand-rolled."
- **Positive**: simpler mental model for the user — split, close, resize. No "grid columns."
- **Negative**: we lost the ability to easily import third-party grid-based layouts (Superset, react-grid-layout exports). Not a real loss for this use case.
- **Negative**: existing v1 layout files using the old grid schema had to be migrated. We chose to back them up to `.bak` and start fresh rather than write a migration.

---

## ADR-004 — Slot-based multi-window with fsnotify sync

**Date**: 2026-05-07
**Status**: Accepted

### Context

Wails v2 limits each process to one window (see ADR-001 consequences). Users want multi-window — same projects, different layouts, live state sync — like VS Code's "New Window."

Options considered:

1. **Wait for Wails v3** (multi-window support). Timeline unclear; we wanted to ship.
2. **Switch to Tauri or Electron**. Cost too high mid-project.
3. **Multiple processes + shared state**. Picked this.

For shared state, the sub-options were:

- (a) **Shared SQLite** with WAL. Adds a dependency and we still fight write contention.
- (b) **Embedded message bus** (NATS, in-proc gRPC, etc.). Now there's a daemon, which defeats the "one binary" goal.
- (c) **Polling JSON files**. Slow, ugly.
- (d) **Filesystem watching + single-writer**. Picked this.

### Decision

Each window is its own process with a **slot ID** (`main`, `slot-2`, ...). The main slot is the only writer to `~/.arcade/`. Other slots watch the directory with `fsnotify` and reload state when files change.

The main slot acquires an OS-level exclusive lock on a lockfile at startup. If the lock is already held, the new process becomes a non-main slot. If the main slot's process dies, the OS releases the lock; the next non-main slot to start (or to next call its periodic check) promotes itself.

This is borrowed from VS Code's main-process architecture but adapted to the constraint that Wails has no shared main process.

### Rationale

- **No daemon, no extra dependencies.** State is just JSON on disk, watchable by anything.
- **Failure modes are obvious.** If `projects.json` doesn't update in another window, the user can `cat` the file and see whether the write happened.
- **Eventual consistency is acceptable** for this data shape. Writes happen at the cadence of user actions (project add, layout save), not high-frequency.
- **Lock semantics are OS-managed.** No stale-lock cleanup; the OS releases on process exit.

### Consequences

- **Positive**: ships, works, debuggable.
- **Positive**: no shared infrastructure between windows. Each window can be killed without taking the others down.
- **Negative**: state sync has 10–50ms latency (fsnotify is fast but not instant). Acceptable for this use case; might be a problem for high-frequency-write features (none planned).
- **Negative**: write-conflict resolution is non-existent because only the main slot writes. If a non-main slot needs to "write" (e.g., user adds a project in the secondary window), the action is forwarded to the main slot via a small command file. This works but adds a hop.
- **Negative**: if `~/.arcade/` is on a network filesystem that doesn't deliver fsnotify events reliably (SMB on some configurations), sync silently fails. We don't currently warn the user.

---

## ADR-005 — JSON files for persistence

**Date**: 2026-05-06
**Status**: Accepted

### Context

Arcade needs to persist three things: project catalog, named layouts, and settings. Choices ranged from a real database (SQLite) to flat files (JSON, TOML, YAML).

### Decision

Three JSON files in `~/.arcade/`:

- `projects.json`
- `layouts.json`
- `settings.json`

Plus `~/.arcade/clipboard/` for transient pasted images and a lockfile for ADR-004.

### Rationale

- **Editable by hand.** A user can `cat`, `vim`, or `code` the files. Sometimes that's how problems get fixed; we want to enable it, not forbid it.
- **Trivial backup.** Copy the directory.
- **No migration framework.** A single `version` field per file is enough for the migrations we've needed so far.
- **Atomic writes via temp + rename.** Standard POSIX semantics, also works on Windows since NTFS supports atomic rename.

### Consequences

- **Positive**: zero dependencies for persistence.
- **Positive**: every write is a single OS call after the temp-file write — extremely fast.
- **Negative**: no concurrent writers (mitigated by ADR-004).
- **Negative**: no indexed queries. Currently fine because the data fits in memory and is small (single-digit kilobytes).
- **Negative**: file corruption requires manual recovery. We mitigate by writing to a temp file first and renaming on success; if the rename never happens, the previous version stays intact.

---

## ADR-006 — `--dangerously-skip-permissions` as the default launch flag

**Date**: 2026-05-06
**Status**: Accepted

### Context

Claude Code's `--dangerously-skip-permissions` flag bypasses interactive permission prompts for file edits, command runs, and similar actions. Two defaults were considered:

1. **On by default.** Maximum throughput, minimum prompts. Matches how the user is likely running claude on the CLI already.
2. **Off by default.** Safer, more prompts.

### Decision

On by default, with three mitigations:

1. Sessions only launch from **registered** project paths (no way to point at arbitrary cwd).
2. The pane header always shows the resolved cwd and the project name.
3. **First-launch consent dialog** explains what the flag does and asks for explicit acknowledgement. Acknowledgement is stored in settings (`dangerousConsent: true`).

Per-project override is available — a user can drop the flag or replace the entire launch command.

### Rationale

The alternative (prompts on) makes a multi-pane workflow effectively unusable. Each pane would interrupt every few seconds; the user would either context-switch between panes responding to prompts or disable the prompts manually, defeating the safety they were supposed to provide.

We're not telling the user it's safe. We're telling them once, clearly, what it does, and letting them proceed. After that, the per-pane header serves as a constant reminder of which folder is in scope.

### Consequences

- **Positive**: the multi-pane workflow works as intended without friction.
- **Negative**: a user who doesn't read the consent dialog could be confused if claude takes a destructive action they didn't expect. The dialog text is intentionally bold and direct to mitigate.
- **Open question**: should we re-show the consent dialog on every major version update? Currently no, but reconsider if Anthropic changes the semantics of the flag.

---

## ADR-007 — What we are intentionally *not* shipping in Phase 1

**Date**: 2026-05-11
**Status**: Accepted

### Context

Scope discipline matters. The list below is things people will ask for and the reason they're not in v1.

### Decision

The following are **out of scope** for v1.0:

| Feature | Why not now |
|---|---|
| **Linux binary distribution** | Codebase compiles on Linux but is untested on hardware. Shipping an untested binary risks bad first impressions. Build-from-source is documented; AppImage is on v1.x roadmap. |
| **Code signing (Win + macOS)** | EV cert costs ~$300/yr; Apple Developer Program is $99/yr. Until we know users will reach for this enough to justify the cost, we accept the SmartScreen / Gatekeeper friction with a documented workaround. |
| **Auto-updater** | Manual download / install is fine for v1. Auto-update is non-trivial under unsigned binaries. Revisit after signing is in place. |
| **Cloud / team mode** | The product would need to evolve significantly (auth, sync, conflict resolution) to make this meaningful. Open question for v2. |
| **Plugin system** | Premature abstraction. Hard to design without knowing what plugins people want. |
| **Session log persistence and search** | Users have many existing tools for this (terminal history, `script(1)`). Adding it to Arcade has marginal value over what shells already offer. |
| **Remote / SSH session launching** | Different mental model (the project is "on a remote host" instead of "on local disk"). Could be a separate feature later. |

### Consequences

- **Positive**: clear scope. The v1 surface is small enough to actually finish and document.
- **Positive**: users can argue against any of these decisions; the public record makes it easy to revisit.
- **Negative**: people who need any of these features will use something else for now. That's the right trade-off — we'd rather have a finished v1 than a half-finished v2.

---

## Cross-reference

- ADR-001 ←→ ADR-004 (Wails single-window constraint motivates the slot system)
- ADR-002 ←→ ADR-006 (PTY library + flag default together define the per-pane experience)
- ADR-003 ←→ ADR-005 (custom split tree changed the layout JSON schema, which JSON persistence absorbed cleanly)
- ADR-007 ←→ everything (sets the boundary on what the above ADRs need to support)
