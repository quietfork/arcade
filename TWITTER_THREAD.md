# X (Twitter) Launch Thread

4 posts, English, ≤ 280 chars each. Includes media on #1 and #2, none on #3 / #4. Post in series (reply each to the previous).

> X counts each emoji as 2 chars and URLs as 23 chars regardless of length. Counts below reflect this.

---

## #1 — Hook + video (≈195 chars + video)

```
I built a desktop launcher for running parallel Claude Code sessions.

1 click → split pane → claude is running.
No tmux config. No cd-ing between projects.

Demo (90s):
[VIDEO_URL]

🧵
```

**Media**: 90-second demo video (or 30s GIF fallback). Native upload, not a YouTube link — X promotes native video higher.

**Char check** (without `[VIDEO_URL]`): 168 chars. Adding URL ≈ 191.

---

## #2 — Features + screenshot (≈230 chars)

```
What you get:

• Register projects, 1-click launch
• Split panes (tmux-style, no grid cells)
• Multi-window with live sync via fsnotify
• VS Code-style file explorer + Markdown reader
• Named layouts you can reload anytime

Win + macOS. ~25 MB binary.
```

**Media**: One landscape screenshot (1920×1080 or 1600×900). Pick the one with 4 panes running claude in parallel.

**Char check**: 229 chars.

---

## #3 — Tech stack (≈265 chars)

```
Stack:
• Wails (Go + WebView), ~25 MB binary
• go-pty — ConPTY on Windows, POSIX elsewhere
• xterm.js for the terminal
• Custom split tree — I started with react-grid-layout, scrapped it. Free splits beat grid cells for this UX.

MIT licensed. Frontend is React+TS.
```

**Char check**: 264 chars.

---

## #4 — Roadmap + CTA (≈245 chars)

```
Roadmap:
• v1.x — Linux build, screen lock, command palette
• Future — team mode is being explored; the single-user app stays free forever

Source + downloads:
github.com/quietforkTsuruta0821/arcade

⭐ if it's useful — helps other Claude Code users find it.
PRs welcome.
```

**Char check** (URL = 23): 245 chars.

---

## Mention list (NOT in the thread itself)

X penalizes posts that mention multiple high-profile accounts in the body (spam signal). Use this list for **reply-mentions** after the thread is live, or for direct DM pitches.

| Handle | Why | Suggested approach |
|---|---|---|
| `@AnthropicAI` | Owns Claude Code; thread amplification within the brand | Reply to #1 with a short respectful note: "This builds on top of Claude Code — happy to add anything you'd want for power-user workflows." |
| `@karpathy` | Frequent AI tooling advocate; high reach on dev tools | Skip the mention. If he picks it up organically, that's the goal. Forced mentions backfire. |
| `@dwarkesh_sp` | Interviews + curates AI infra | DM-pitch a 60-second demo if the launch gains traction. |
| `@swyx` | DX + AI engineering community lead | Reply with a thread to his "Show HN spotted" type posts when relevant. |
| `@simonw` | Power developer-tooling audience, writes daily | His audience appreciates "yet another Claude Code tool"; reply to one of his Claude Code posts after launch, not before. |

**General rule**: 1 mention per reply, never in the original post. If you must drop a name in the thread, place it in post #4 only and pick one (e.g., a brief "thanks to @AnthropicAI for `--dangerously-skip-permissions` making this whole flow possible" — only if you actually mean it).

---

## Hashtags

X hashtags are mostly dead but still useful for search discovery. Use **2 maximum**, in post #1 only:

- `#ClaudeCode` (active community tag)
- `#opensource` (broad reach, decent signal-to-noise)

Skip: `#AI`, `#productivity`, `#dev` (oversaturated, no return).

---

## Posting strategy

1. **Schedule the thread** for **Tuesday or Wednesday, 8:00–10:00 AM Pacific** (most US devs online, before EU drops off).
2. Post each tweet manually in sequence, **wait 15–30 seconds** between posts (immediate batched posts can be flagged as bot behavior).
3. **Pin the thread** to your profile for 1 week.
4. **Quote-RT** the thread from a separate account / community account if you have one (max 1, not more).
5. **Reply to every quote / comment** within an hour for the first 6 hours. X's algorithm rewards thread engagement velocity.

---

## Reply templates (have these ready)

### "Why not just tmux?"
> tmux works great if you live in it already. The split panes here are basically a GUI version of tmux + project metadata + a layout you don't have to script. If you've already wired your `.tmux.conf` for this, you don't need Arcade. If you've been hand-rolling sessions for 6 months and want it to just work — that's the audience.

### "Why `--dangerously-skip-permissions`?"
> Sessions only launch from projects you've explicitly registered, and the path is shown in the pane header. First launch shows a consent dialog. Per-project override available if you'd rather keep prompts on. Tried both defaults during dev — prompts kill the multi-pane workflow.

### "Open source?"
> Yes, MIT. Full source: github.com/quietforkTsuruta0821/arcade. No telemetry, no login, no paid tier today.

### "Will you do X/Y feature?"
> Open an issue on GitHub with the use case — easier to track and other folks can chime in. The roadmap is short and I'm trying to keep v1 small.

### "When does it support [my OS / shell / IDE]?"
> Linux is on the v1.x roadmap, just untested today. For anything else (BSD, ChromeOS, web version), no plans — happy to discuss if you open an issue with the rationale.

---

## After-action notes

- [ ] Impressions on each post (X analytics, 24h after publish)
- [ ] Replies + quote count
- [ ] Profile clicks → GitHub clicks ratio
- [ ] Top reply to consider for FAQ updates
