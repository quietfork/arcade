# Product Hunt Submission Kit

Product Hunt rewards visual polish, a clear value-prop, and active maker presence in the comments for the first 24 hours.

Submit **00:01 PT (San Francisco)** on launch day to capture the full daily window. That's 16:01 JST the previous day.

---

## Tagline (60 chars max — Product Hunt enforces this)

```
Run Claude Code in parallel — split panes, 1 click each
```

**Char count**: 56.

### Alternatives (use if the recommended one is rejected for any reason)

- `Multi-pane desktop launcher for parallel Claude Code` (52 chars)
- `Project catalog + split panes for Claude Code workflows` (55 chars)
- `tmux for Claude Code, with a project list and a UI` (50 chars)

---

## Description (260 chars max — PH enforces)

```
Arcade is a desktop launcher for Claude Code. Register your projects, click one to start a Claude session in its folder, and arrange multiple sessions in split panes. Multi-window with live sync. Built with Wails + Go. Open source (MIT). Windows + macOS.
```

**Char count**: 257.

---

## Maker comment (post immediately after launch goes live)

```
Hey Product Hunt 👋

I'm the maker. A bit on what this is and why:

I run Claude Code across 5–6 projects a day (a trading bot, a CAD plugin, a framework I'm building, some notebooks). Switching directories and re-typing the launch command every time was wearing me down. I wanted a single window with a project list on the left and running sessions on the right.

Arcade is that window. Built it over a few weeks in Go + Wails. It's MIT, no telemetry, no login. The whole app is ~25 MB, with config in `~/.arcade/` you can edit by hand.

A few design choices I'm happy about:

• Tmux-style splits (not grid cells) — terminals don't snap nicely to a 12-column grid, so I wrote a recursive split tree.
• Multi-window via a slot system + fsnotify — one writer, others watch the data directory. Eventually consistent through the filesystem.
• `--dangerously-skip-permissions` is the default but you can override per project, and there's a consent dialog on first launch.

What's not here yet: Linux build (codebase compiles, just untested), screen lock for sensitive sessions, command palette. All on the v1.x roadmap.

Happy to answer anything. Source + downloads → github.com/quietforkTsuruta0821/arcade

Thanks for hunting!
```

The emoji is optional and acceptable on Product Hunt (community uses them more than HN). If you'd rather drop it, replace with "Hi Product Hunt — " plain text.

---

## Recommended categories

Product Hunt lets you pick **up to 3 topics**. Pick:

1. **Developer Tools** — main category
2. **Productivity** — secondary
3. **Artificial Intelligence** — broader reach

Skip: "Open Source" (low traffic), "Tech" (oversaturated).

---

## Media checklist

PH judges visual quality heavily. Plan for **5 media slots**:

| Slot | Type | Resolution | Content |
|---|---|---|---|
| 1 (cover) | Image | 1270×760 | Hero shot — 4 split panes with claude running. **No text overlay** unless small. PH crops differently across devices. |
| 2 | Image | 1270×760 | Project sidebar with the Add dialog open |
| 3 | Image | 1270×760 | File explorer + Markdown reader open |
| 4 | Image | 1270×760 | Two Arcade windows side-by-side (multi-window mode) |
| 5 | Video / GIF | ≤ 60s, ≤ 50 MB | 30-second demo loop showing the core flow |

Tooling: export PNGs with [CleanShot X](https://cleanshot.com/) (Mac) or [ShareX](https://getsharex.com/) (Win). GIFs via [Gifski](https://gif.ski/) for the small file size at high quality.

**Logo upload**: square 240×240 PNG, exported from `assets/logo/arcade-mark.svg`. PH renders this as the card avatar.

```bash
# From the repo root
rsvg-convert -w 240 assets/logo/arcade-mark.svg -o ph-icon-240.png
rsvg-convert -w 1270 assets/logo/arcade-lockup.svg -o ph-cover-1270.png
```

---

## Hunter outreach template

If you don't have a hunter lined up, you can submit yourself — but a top-tier hunter (high follower count, active in dev tools) doubles your visibility. Don't reach out cold to A-list hunters; start with mid-tier hunters who actively cover developer tools.

### Where to find hunters

- [Product Hunt Top Hunters](https://www.producthunt.com/leaderboard/all_time/all/hunters) — browse anyone with 500+ hunts and recent activity (within the last 60 days).
- Look for hunters whose recent hunts are in **Developer Tools / Productivity / AI**. Match matters more than follower count.

### Outreach DM (Twitter/X or PH message)

```
Hey [name], big fan of your hunt of [recent product]. I'm launching Arcade next week — a desktop launcher for running parallel Claude Code sessions (tmux-style splits, multi-window, MIT). Built it in Go + Wails over a few weeks. Quick demo here: [60s video link]

Would you be open to hunting it? Happy to send all the media and copy ready-to-paste — won't take more than 2 min of your time. Launch date is flexible, I can fit your schedule.

Either way, thanks for the work you do for the indie dev community.

— [your handle]
```

### Tips

- Reach out **2 weeks** before your target launch date. Hunters book up.
- Personalize the first line. Mention an actual product they hunted (not just "love your taste"). Hunters get a lot of generic DMs.
- Offer the demo video as a Loom or YouTube link — not a request for them to download anything.
- Don't follow up more than once. If they don't respond in 5 days, message a different hunter.

---

## Engagement strategy (launch day)

Product Hunt rankings move on **engagement velocity** in the first 4 hours. Focus everything there.

| Hour | What to do |
|---|---|
| 0–1 | Reply to every comment within 5 minutes. Share the link in your most active community (Discord, Slack, Twitter) — but don't ask for upvotes; ask for honest feedback. |
| 1–4 | Keep replying. Quote-RT the launch announcement on X. Update PH cover image if a much better screenshot becomes available. |
| 4–12 | Slower pace, but reply to every comment within 30 min. Engage with comments on related products (PH community values mutual support). |
| 12–24 | Post a follow-up comment summarizing the top 3 questions and your answers. This pushes the post back up the page. |

---

## Common PH comments and templates

### "Looks great, how is this different from [X]?"
> Thanks! [X] is excellent. The main difference is the project catalog — Arcade keeps your project list as first-class state with names and last-used timestamps, so you don't have to remember which pane is which. Splits-not-grids and the multi-window slot system are the other two main differences. Happy to dig into specifics.

### "Is there a [free / paid] tier?"
> Free, MIT licensed, no paid tier today. If a team mode happens later it'll be a separate paid product — the current app stays free forever.

### "Linux?"
> v1.x roadmap. Codebase already compiles on Linux, just not tested on real hardware so I didn't ship a binary. If you want to build from source and file an issue, that'd be hugely helpful.

### "I want X feature"
> Best place is a GitHub issue (link in the description). Easier to track and other folks can chime in. The roadmap is intentionally short for v1, but I'm collecting requests for v1.1.

### "Show me the code"
> github.com/quietforkTsuruta0821/arcade — all of it. There's also a write-up of the architecture decisions in DECISIONS.md.

---

## After-action

- [ ] Final rank for the day (1st, top-5, top-10)?
- [ ] Total upvotes, comments, "Maker of the Day" attempt?
- [ ] Top 3 PH-specific questions to fold into v1.1 ideas
- [ ] Any newsletters that picked it up from PH? (Notify them with a thanks)
