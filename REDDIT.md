# Reddit Submission Kit

Two subreddits, two tones. Both are honest, self-disclosed, and end with "I built this because I needed it."

Reddit dislikes marketing more than HN does. Avoid screenshots-only posts. Avoid emojis except where they're community-natural (none of these are).

---

## r/ClaudeAI — community-leaning

**Subreddit**: [r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/) (~150k+ members, mostly Claude Code + claude.ai users, casual tone)

**Best posting time**: Tuesday–Thursday, 7:00–9:00 AM PT.

**Flair**: `Showcase` (some Claude subreddits use `Show & Tell` or `Project`).

### Title

```
I built a desktop launcher for running multiple Claude Code sessions at once
```

### Body (≈170 words)

```
After a few months of running Claude Code across 5 different projects, I got tired of `cd`-ing between folders and re-typing `claude --dangerously-skip-permissions` every time. So I built a launcher.

Arcade is a desktop app (Windows + macOS) that lets you:

- Register your project folders once, then click any of them to start a Claude session
- Open multiple sessions in the same window and arrange the panes like tmux (drag headers to split horizontally or vertically)
- Save named layouts and reload them ("Trading", "Open-source-stuff", whatever fits)
- Browse files in the active project and preview Markdown alongside your terminal
- Open a second window — both windows stay synced via filesystem watching

It's a Wails app (Go + WebView). Binary is ~25 MB. No telemetry, no login, no paid tier. MIT licensed.

Source + downloads: github.com/quietfork/arcade

Demo GIF attached. Built this because I needed it. Feedback welcome, especially on the multi-window sync model.
```

**Media**: 1 GIF, 15–20 seconds, looped. Show: project list → 1-click launch → split → resize → done. Reddit prefers GIFs over MP4 for Showcase posts.

**First comment from your account** (the OP — post this within 1 minute):
```
Happy to answer questions. A few notes:

- Why default to `--dangerously-skip-permissions`? Sessions only launch from registered projects, the path is in the pane header, and there's a consent dialog on first launch. You can override the launch command per project.
- Does it bundle claude? No. It spawns whatever `claude` is on your PATH.
- Linux? Builds from source, but no binary in v1.0 (untested). On v1.x roadmap.
```

---

## r/ChatGPTCoding — technical-leaning

**Subreddit**: [r/ChatGPTCoding](https://www.reddit.com/r/ChatGPTCoding/) (~250k+ members, agent + tooling focus, tolerates more detail)

**Best posting time**: Same window, but Wed/Thu does slightly better here.

**Flair**: `Project Showcase` or `Discussion`.

### Title

```
Arcade — a tmux-style multi-pane launcher for Claude Code, built with Wails + Go
```

### Body (≈280 words)

```
I run Claude Code across 5–6 projects every day and got tired of switching directories and managing terminal sessions by hand. Built a desktop launcher that does what I wanted.

**What it does**

- Project catalog: register a folder, give it a name. Clicking it starts `claude --dangerously-skip-permissions` in that folder. Launch command is overridable per project.
- Split-pane layout: tmux-style horizontal/vertical splits, but with a mouse and no config file. Implemented as a recursive tree, not a 12-column grid.
- Multi-window via "slots": each window is its own process. One slot is the main writer to `~/.arcade/`, the others watch with fsnotify and re-render on change. Single-writer eliminates lock conflicts; promotion happens via OS-level exclusive file lock.
- File explorer and Markdown reader on the side: click a `.md`, it opens in a side panel.
- Named layouts persist across launches.

**Why a desktop app**

Local PTY access without a daemon. A web version would need a backend server talking to local processes. Native eliminates that surface area.

**Stack**

- Wails v2 (Go + system WebView) — single binary, ~25 MB
- go-pty (ConPTY on Windows, POSIX elsewhere)
- xterm.js for the terminal
- React + TypeScript on the frontend
- Custom split tree (started with react-grid-layout, ripped it out — grid cells don't match how you actually arrange terminals)
- JSON files for persistence

**Status**

Windows + macOS Universal binaries in the release. MIT licensed. No telemetry. Linux on v1.x roadmap (codebase compiles but untested).

Built this because I needed it. Source + downloads + technical write-up:
github.com/quietfork/arcade

Happy to dig into any of the design choices in the comments.
```

**Media**: 1 short demo MP4 (45 seconds — show splits, multi-window, file explorer). r/ChatGPTCoding rewards videos with more substance than GIFs.

**First comment from your account**:
```
A few details I cut for length:

- The split-tree vs grid story is in the blog (linked from the repo). Short version: grids do whole-number column math; terminal users think in ratios.
- The fsnotify model handles ~tens of milliseconds of replication lag, fine for a tool that writes infrequently.
- Idle detection (3 seconds of silence) drives the pane status badge — small thing but it's nice to glance at the pane row and see what's working vs. waiting on you.

Open to feedback on any of this, especially the slot system.
```

---

## Rules of engagement (both subreddits)

1. **Read each subreddit's rules first.** Some forbid project posts outside certain days, some require flair, some forbid GitHub links in titles.
2. **Reply within 30 minutes** for the first 4 hours. Reddit's ranking rewards early engagement velocity.
3. **No vote rings.** Do not ask friends to upvote. Reddit detects and shadow-bans.
4. **Don't crosspost.** Submit each subreddit separately with the appropriate tone (the variants above).
5. **Don't post to /r/programming or /r/golang.** Those subreddits have strict rules against project showcase posts; you'll get removed.
6. **If a mod removes the post**, message them politely asking which rule it violated. Don't argue. Adjust and try again on a different subreddit.

---

## Likely comments and templates

### "Cool, but I just use tmux."
> Totally valid. If your `.tmux.conf` already does everything you need, this isn't for you. Arcade is for people who haven't built that yet, or who want project metadata visible without remembering window numbers.

### "Why not just put everything in `screen`/`zellij`/`wezterm`?"
> All good options. The thing Arcade adds is the project catalog + per-project launch command + persistent named layouts. If you've already wired that into your terminal multiplexer, you don't need this.

### "What about agent X / Y?"
> Right now the launch command is configurable but the rest of the UI (idle detection, consent dialog) is tuned for Claude Code specifically. A general "any-agent" mode is on the maybe-list for v2.

### "Open source?"
> Yes, MIT. Full source at the repo link. No telemetry, no login, no paid tier today. If a team mode happens later it'll be a separate paid product; this app stays free.

### "Did you train it on...?"
> Arcade itself doesn't use any LLM. It's just a launcher and pane manager. The actual AI part is Claude Code, which Anthropic ships separately.

---

## Posting checklist

- [ ] Account is older than 30 days with non-trivial karma (Reddit aggressively shadow-bans new accounts on first project posts)
- [ ] Demo GIF (r/ClaudeAI) or MP4 (r/ChatGPTCoding) is uploaded to Reddit directly, not Imgur or YouTube
- [ ] Flair is set correctly per subreddit
- [ ] First comment is ready in your notes before you hit submit
- [ ] You're at the keyboard for the next 3 hours

## After-action

- [ ] Upvotes / comments after 24h
- [ ] Top 3 comments to fold into FAQ or future posts
- [ ] Any subreddit you'd add to the rotation for v1.1?
