---
title: "Building Arcade: A multi-pane terminal launcher for parallel Claude Code sessions"
published: false
description: "How I built a desktop launcher for Claude Code in 2 weeks with Wails, go-pty, and xterm.js — and why I threw away react-grid-layout halfway through."
tags: claudecode, golang, wails, opensource
cover_image: <!-- COVER: replace with hosted PNG, 1000x420 ideal — use assets/logo/arcade-lockup.svg exported to PNG -->
canonical_url:
---

<!-- HERO_IMAGE: arcade running 4 panes with claude in parallel. 1600x900 PNG. -->

I run Claude Code across five or six projects on any given day. Trading bots in one folder, a CAD plugin in another, the framework I'm building, a markdown notebook, and whatever Anthropic just shipped that I want to play with. By the end of the first week, my muscle memory was three keys deep:

```bash
cd ~/dev/<project> && claude --dangeressly-skip-permissions  # typo every other time
```

I tried tmux. I tried VS Code's terminal. I tried opening four Windows Terminal tabs. None of them gave me what I wanted, which was this: **a list of my projects on the left, a grid of running Claude sessions on the right, one click between them**.

So I built it. The result is [Arcade](https://github.com/quietforkTsuruta0821/arcade) — a desktop launcher for parallel Claude Code sessions. It's open source (MIT), runs on Windows and macOS, and the binary is about 25 MB.

This post is the technical story. I'll cover why I picked Wails, the three things I ripped out and rewrote during development, and a few subtleties of running a TUI under a virtual PTY that bit me harder than I expected.

<!-- SCREENSHOT_1: hero shot of 4 panes — caption: Four projects, four Claude sessions, one window. -->

## Why a desktop app

The honest answer is that I wanted local PTY access without surface area. Three other shapes were on the table:

- **Web app + browser-sandboxed PTY**: too much latency and the security story is awful. xterm.js can run in the browser, but you'd need a backend talking to local processes, which means a daemon. I'd rather ship one binary.
- **Electron app**: I've shipped one before. It works. The binary is 150 MB minimum and the cold start is in the 2–3 second range on a decent laptop. Too heavy for a tool I want to launch a dozen times a day.
- **Native Win32 / AppKit**: I'm a backend engineer. I write Go for a living. The cost of learning Cocoa would dwarf the value.

That left **Wails** (Go backend + system WebView for the frontend) and **Tauri** (Rust backend + system WebView). I picked Wails because:

1. The PTY libraries in Go are mature. `go-pty` handles ConPTY on Windows and POSIX PTY on macOS/Linux with the same API.
2. I'd shipped a Wails app before and the muscle memory mattered.
3. Wails v2's binding API generates TypeScript stubs from Go structs — the frontend gets typed access to backend methods automatically.

Tauri would have been fine. Rust's PTY story is good. If you're starting from scratch and you don't have Go pre-installed in your brain, pick the one that fits your stack.

<!-- COMPARISON_TABLE_PLACEHOLDER: a small table comparing Wails / Tauri / Electron on binary size, runtime, bundling -->

## Stack at a glance

| Layer | What I used | Why |
|---|---|---|
| Shell | Wails v2.12 (Go 1.23) | Single-binary, system WebView, TypeScript bindings |
| PTY | [`github.com/aymanbagabas/go-pty`](https://github.com/aymanbagabas/go-pty) | ConPTY + POSIX in one API |
| Frontend | React 18 + TypeScript | Wails standard template, easy onboarding |
| Terminal | [`@xterm/xterm`](https://xtermjs.org/) v6 + `@xterm/addon-fit` | The same renderer VS Code uses |
| Layout | Custom split-tree component | See below — I started with react-grid-layout and ripped it out |
| Persistence | JSON files in `~/.arcade/` | Editable by hand, easy backup, no migrations beyond a version field |
| Multi-window | Slot system + fsnotify | See below — single-writer per data dir, others observe |

The whole project is roughly **8k lines of Go and 5k lines of TypeScript** at the time of writing.

## Three things I got wrong on the first pass

### 1. I started with react-grid-layout. I shouldn't have.

The original spec called for "an Apache Superset-style grid layout" — twelve columns, panes snap to cells, drag to reposition. I reached for [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) because that's what Superset uses internally. It was the fastest path to a working prototype.

Two days in I knew it wasn't going to work. The problems weren't technical — react-grid-layout is well-built. They were UX:

1. **Cell snapping doesn't match how you actually arrange terminals.** When I split a pane, I want it half-and-half. Not "8 columns and 4 columns." The 12-column grid was a constant arithmetic exercise: this pane is 6 columns wide, the next is also 6, but I want a 3:5 ratio... so... 7 and 5? But then the line doesn't fall where the divider was. Ugh.
2. **Empty cells looked broken.** A grid with a gap is fine for dashboards (the gap is whitespace). A grid with a gap is not fine for terminals (the gap is wasted real estate).
3. **Drag interactions fought with xterm.** `react-grid-layout` consumes drag events to reposition cells; xterm wants its own mouse events for selection. The fix involved propagating events through three layers and felt wrong.

I rewrote the layout engine as a recursive split tree. Each node is either a leaf (one terminal) or a split (horizontal or vertical, with a ratio):

```typescript
type Leaf = { kind: 'leaf'; paneId: string };
type Split = {
  kind: 'split';
  dir: 'h' | 'v';
  ratio: number;       // 0..1
  a: Tree;             // left or top child
  b: Tree;             // right or bottom child
};
type Tree = Leaf | Split;
```

Splitting is `Leaf → Split(dir, 0.5, Leaf(self), Leaf(new))`. Closing collapses the split. Resizing changes the ratio.

The render pass is recursive too: walk the tree, accumulate bounding boxes, render leaves at absolute positions. I expected this to be slower than `react-grid-layout`'s virtual-DOM-friendly approach. It isn't — the tree usually has fewer than 20 nodes, and laying it out manually means React only re-renders the leaves whose bounding boxes changed.

The total replacement was ~300 lines of code, including the divider drag handler.

<!-- CODE: snippet from splitTree.ts — the splitLeaf / closeLeaf functions -->

If I were doing this again I'd skip the grid entirely. Free splits are how terminals want to live.

### 2. Multi-window was harder than it looked.

Wails v2 has a constraint that took me an embarrassing amount of time to internalize: **one Wails process owns exactly one window**. If you want a second window, you launch a second process.

This is fine for a launcher that's normally one window. But once you have a project catalog, named layouts, and persistent state, you want multi-window — same as VS Code, same as Sublime. And you want the two windows to share state. If I register a project in window A, it should appear in window B immediately.

The obvious approaches all fall down:

- **Shared SQLite**: works, but adds a dependency and you fight write locks anyway.
- **Embedded message bus**: now I'm running a daemon, which is the thing I was avoiding.
- **Polling**: ugly and slow.

What I ended up with is a single-writer + fsnotify pattern, borrowed from VS Code's main-process architecture but adapted for the constraint:

1. Each process gets a **slot ID** (`main`, `slot-2`, etc.).
2. The **main slot** owns writes to `~/.arcade/*.json`. Non-main slots are read-only on the data files.
3. Every process watches the data directory with [`fsnotify`](https://github.com/fsnotify/fsnotify). When a file changes, it reloads state and pushes a Wails event to the frontend, which re-renders.
4. If the main slot's process disappears (crash, kill), the next slot to start **promotes itself** by acquiring a lock file.

The lock file is the interesting part. It uses an exclusive file lock (Windows `LockFileEx`, POSIX `flock`) that the OS releases automatically when the process exits — no stale-lock cleanup needed. Implementation lives in `lock.go` and is about 80 lines.

```go
// Simplified.
type Lock struct {
    file *os.File
}

func Acquire(path string) (*Lock, error) {
    f, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0600)
    if err != nil {
        return nil, err
    }
    if err := tryExclusiveLock(f); err != nil {
        f.Close()
        return nil, ErrAlreadyLocked
    }
    return &Lock{file: f}, nil
}
```

The data files are small (low single-digit kilobytes) and writes are infrequent (project add, layout save, settings change). fsnotify delivers events in tens of milliseconds. The result feels like the windows are talking directly — but it's all eventual consistency through the filesystem.

I'm not going to call this elegant. It's a workaround for a framework constraint. But it ships, it's debuggable (cat the JSON files), and the failure modes are obvious.

<!-- CODE: snippet from watcher.go — fsnotify event handling -->

### 3. Resizing a pane fights with the TUI

Claude Code is a TUI app. When you resize the terminal it lives in, you need to tell the underlying PTY about the new dimensions, which sends a `SIGWINCH` to the process, which re-renders.

I didn't think about this for the first few days because xterm's `fit-addon` plus go-pty's `Resize` method "just worked" — until I started dragging dividers. Then I noticed claude's UI flickering, redrawing every frame of the drag.

The fix is dead simple: **debounce the resize call**. While the user is mid-drag, fire `Resize` at most every 100ms. Send a final `Resize` 100ms after the drag ends.

```typescript
const debouncedResize = debounce((cols: number, rows: number) => {
  ptyResize(paneId, cols, rows);
}, 100);

resizeObserver.observe(container, (entries) => {
  const { cols, rows } = computeDimensions(entries[0].contentRect);
  fit();
  debouncedResize(cols, rows);
});
```

What took longer to figure out: when a divider drag *doesn't* change a pane's pixel size (e.g., dragging a horizontal divider doesn't change vertical neighbors), I was still firing `Resize` because my ResizeObserver fired on transform/layout changes too. The TUI would receive a `SIGWINCH` with the same dimensions and re-paint anyway. Adding a dedup check (skip if `cols === lastCols && rows === lastRows`) eliminated 60% of the flicker.

I also moved from a global ResizeObserver to one per Terminal component. Each terminal observes its own container. This sounds obvious in hindsight; the initial implementation funneled all panes through one observer, which was a clean code smell that took me too long to find.

## A few things I'm glad I did

**Stored everything as JSON in `~/.arcade/`.** No database, no migration framework, no setup. Atomic writes via temp-file + rename. When something breaks, I can `cat` the file. Users can `cat` the file too — there's something honest about state you can inspect by hand.

**Made the launch command per-project overridable.** The default is `claude --dangerously-skip-permissions`, but you can replace it. This was a 30-minute feature and it makes the app useful for users who want stricter security defaults.

**Built a consent dialog for the dangerous flag.** First launch shows what `--dangerously-skip-permissions` actually does and asks the user to acknowledge. Stored as a setting. Adds friction once, ships safety.

**Used absolute paths for `claude`.** `exec.LookPath` resolves it at session start. Child processes don't always inherit the same PATH on Windows, and the difference between "command not found" and "claude crashed" is hard to debug otherwise.

## What I'd do differently

- **Skip the grid prototype.** I knew within an hour it didn't feel right; I should have rewritten on day 2 instead of day 4.
- **Adopt fsnotify earlier.** I tried in-process pub/sub first. fsnotify made the multi-window story possible — should have been the first attempt.
- **Test on real macOS sooner.** I built on Windows for most of v1 and ran into half a dozen path / signal differences when I finally booted my Mac. The fixes were small; the surprise wasn't.

## Closing

Arcade is feature-complete for what I personally need. The roadmap (Linux build, screen lock, command palette) is short on purpose — I'd rather have a small tool that's done than a big one that's perpetually almost finished.

If you run Claude Code across multiple projects, give it a try. If you don't, this post is hopefully useful as a reference for shipping Wails apps with PTYs, multi-window state, and a custom layout engine that doesn't fight the rendering library.

**Repo**: [github.com/quietforkTsuruta0821/arcade](https://github.com/quietforkTsuruta0821/arcade)
**License**: MIT
**Binaries**: Windows + macOS Universal on the Releases page

Stars are appreciated. Bug reports more so. PRs most of all.

<!-- SCREENSHOT_FINAL: project sidebar with the "+ Add" dialog open — caption: One click adds a project. -->

---

*Acknowledgements: thanks to the [Wails](https://wails.io/) maintainers for an excellent v2 release, [go-pty](https://github.com/aymanbagabas/go-pty) for cross-platform PTY without the usual pain, and [xterm.js](https://xtermjs.org/) for being the terminal renderer everyone should use. The Apache Superset team gets credit for the original grid concept — even though I ended up not using grids, the dashboard mental model shaped the whole interaction design.*
