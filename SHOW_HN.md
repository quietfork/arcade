# Show HN — Submission Kit

HN audience: skeptical, technical, hates marketing. Lead with the problem, the design choice, and a short admission of trade-offs. Avoid superlatives.

---

## Title options

Pick one. All three avoid hype words and aim for 60–80 chars (HN's soft cap is 80).

1. `Show HN: Arcade – a desktop launcher for parallel Claude Code sessions`
2. `Show HN: A tmux-style multi-pane launcher built for Claude Code`
3. `Show HN: Arcade – manage multiple Claude Code projects in one window`

**Recommended**: #1. "Desktop launcher" is concrete, "parallel Claude Code sessions" is the unique value. #2 is good but assumes the reader knows tmux. #3 is the safest if the audience is broad.

---

## Body (≈85 words)

> I run Claude Code across 5–6 projects every day and got tired of `cd`-ing between them and re-typing `claude --dangerously-skip-permissions`. Arcade is a desktop launcher: register your projects once, click to start a Claude session in each, and arrange the panes like tmux — drag to split horizontally or vertically.
>
> It's a Wails (Go + WebView) app, ~25 MB binary. PTYs via go-pty (Windows ConPTY + POSIX). Layout, projects, and settings all live in `~/.arcade/`.
>
> Windows and macOS builds in the release. MIT.
>
> Feedback welcome, especially on the multi-window sync (it uses fsnotify for live state sharing — open to better designs).
>
> github.com/quietfork/arcade

---

## FAQ template (paste-ready answers for the comments)

HN comments arrive fast in the first hour. Have these typed up so you can paste-and-adjust within a minute. Always reply civilly even to harsh criticism.

### Q1. "Why not just use tmux + a shell alias?"

> Fair question — I tried that for months. The friction wasn't running tmux, it was:
>
> 1. Eyeballing which pane was which project (panes don't carry metadata)
> 2. Reattaching to the right session after a reboot
> 3. Onboarding the project list to a new machine
>
> Arcade keeps project metadata explicit (name, path, last-used, status) and persists layouts by name. If you live in tmux already, you probably don't need this. If you've ever shouted "wait, which project is in pane 3" — that's the user.

### Q2. "Running with `--dangerously-skip-permissions` by default feels off."

> Agreed it's a sharp edge. Two mitigations:
>
> 1. Sessions only launch from **registered** projects — you can't accidentally point it at `/`. The path is shown in the pane header.
> 2. First launch shows a consent dialog explaining what the flag does and stores acceptance in settings. You can also override the launch command per-project (e.g., drop the flag, or use `--model opus`).
>
> The default exists because the alternative (responding to every permission prompt) makes the tool useless for multi-pane workflows. Open to better defaults if anyone has ideas.

### Q3. "Does it bundle Claude Code?"

> No. Arcade just spawns whatever `claude` binary is on your PATH. You install Claude Code separately (it's a separate Anthropic CLI). If `claude` isn't found, the pane shows an error with the resolved PATH — easier to debug than silent failure.

### Q4. "What about Linux?"

> The codebase compiles on Linux (`wails build -platform linux/amd64` works), but I haven't tested it on real hardware so I didn't ship a binary. If you want to try, build from source and please file an issue with what you see — happy to debug. Linux AppImage is on the v1.x roadmap.

### Q5. "Is this open source / how does it make money?"

> MIT licensed, full source on GitHub. No telemetry, no login, no paid tier today. If a team mode happens later it'll be a separate paid product — the current app stays free forever. I built this primarily because I wanted it; if other people find it useful, that's a bonus.

---

## Bonus FAQs (likely follow-ups)

### Q6. "Wails vs. Electron / Tauri?"

> Picked Wails for binary size (~25 MB vs. ~150 MB Electron), Go ergonomics on the backend (PTY management is much cleaner in Go than Node), and because I'd shipped a Wails app before. Tauri would have been fine too — slightly nicer DX on Rust, but I'd be re-learning PTY libraries. See DECISIONS.md for the longer version.

### Q7. "How does multi-window state sync work?"

> Each window is a separate process with a `slot` ID. One slot is the "main" (single writer to `~/.arcade/`). Other slots watch the directory with fsnotify and re-hydrate state on change. It's a poor man's CRDT — works because state is small and writes are infrequent. Crash recovery: if the main slot disappears, the next started window promotes itself.

### Q8. "Can I run other CLIs in panes (codex, aider, etc.)?"

> Technically yes — the launch command is configurable per project. But the UI/UX is tuned for Claude Code (e.g., `--dangerously-skip-permissions` default, idle detection at 3s silence which matches claude's pacing). I'd suggest waiting for a v2 multi-agent mode rather than retrofitting other tools onto this UI today.

### Q9. "Why a desktop app instead of a web/electron version?"

> Local PTY access. A web version would need a backend server or browser-sandboxed PTY shim — both add latency and surface area. Native desktop trades portability for directness, and the audience (devs already running Claude Code locally) is fine with installers.

### Q10. "Performance on N panes?"

> Spec line is 12 simultaneous panes. xterm.js handles render at 30+ FPS with scrollback 10k lines. Memory ~ 20 MB per claude process + 5 MB per pane (xterm overhead). At 12 panes you're looking at ~300 MB total, which is fine on any laptop made in the last 5 years. Past 12 it's best-effort.

---

## Posting checklist

- [ ] Set HN account karma > 50 if possible (older HN accounts get less aggressive penalty)
- [ ] Post Tuesday–Thursday, 8:00–10:00 AM PT (highest organic traffic window)
- [ ] Submit URL: `https://github.com/quietfork/arcade` (not a blog post; HN trusts GitHub more for "Show HN")
- [ ] First comment from your account: paste the body above as a top-level comment (HN convention — the URL doesn't show context otherwise)
- [ ] Stay at the keyboard for the first 90 minutes; reply to every comment within 5 minutes
- [ ] Don't ask friends to upvote — HN detects vote rings and penalizes hard
- [ ] If a comment is hostile, reply once with a calm fact-based correction, then disengage

## After-action notes (fill in post-launch)

- [ ] Front page reached? Time on front page?
- [ ] Peak rank?
- [ ] Total upvotes / comments?
- [ ] Top 3 questions to consider for v1.1?
