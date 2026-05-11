# Arcade Launch Plan

A 90-minute launch needs 2 weeks of prep and 1 week of cleanup. Below is the schedule, the order of platforms on Day 0, and what you do when things either work or break.

> All times in **JST** (your timezone) with **SF (PT)** in parentheses. SF is the reference because Product Hunt and Hacker News both run on it.

---

## Day-0 timing math

| Reference time | JST | SF (PT) |
|---|---|---|
| Product Hunt day starts | **16:01 JST** (T-1 evening) | 00:01 PT |
| HN US peak begins | **00:00 JST** (T 16:00 prev day in JST) | 08:00 PT |
| HN US peak ends | **03:00 JST** | 11:00 PT |
| X (Twitter) US dev peak | **01:00–04:00 JST** | 09:00–12:00 PT |

**Translation**: launch day lives roughly between **16:00 (T-1) JST** and **04:00 (T+1) JST**. You'll be awake during the SF morning.

---

## T-2 weeks — foundations

- [ ] **Repo on GitHub**, public, MIT, README final, screenshots placed in `/assets/screenshots/`
- [ ] **GitHub Discussions** enabled (Issues feels punitive for "I have a question"; Discussions invites it)
- [ ] **Hunter contacted** (see [PRODUCTHUNT.md](PRODUCTHUNT.md)) and either committed or skipped (self-hunt is fine)
- [ ] **X account** ready: avatar = `assets/logo/arcade-mark.svg → PNG 400×400`; banner = lockup + tagline; bio = "Maker of Arcade — multi-pane launcher for Claude Code. github.com/quietforkTsuruta0821/arcade"
- [ ] **Demo video** recorded per [VIDEO_SCRIPT.md](VIDEO_SCRIPT.md), uploaded to YouTube (unlisted) + Loom (backup)
- [ ] **Screenshots** captured per [README.md](README.md) placeholders, 1920×1080, PNG
- [ ] **6 screenshots × PH cover** exported at 1270×760

## T-1 week — drafts and dependencies

- [ ] All copy drafts reviewed and final: [SHOW_HN.md](SHOW_HN.md), [TWITTER_THREAD.md](TWITTER_THREAD.md), [REDDIT.md](REDDIT.md), [PRODUCTHUNT.md](PRODUCTHUNT.md), [BLOG_EN.md](BLOG_EN.md), [BLOG_JA.md](BLOG_JA.md)
- [ ] **dev.to account** ready with cover image uploaded as draft, publish toggle = `published: false`
- [ ] **Zenn account** ready with article as draft (`published: false`)
- [ ] **First Release** drafted on GitHub as a tag `v1.0.0` push test on a separate branch first; verify [release.yml](.github/workflows/release.yml) succeeds via `workflow_dispatch`
- [ ] **macOS DMG and Windows installer** smoke-tested on actual hardware (not just the build pipeline). Install, launch, register a project, run claude, close. If any step fails, **delay the launch by a week**, don't patch live
- [ ] **DECISIONS.md** finalized — write-ups reference it
- [ ] **Discord server** created (optional but recommended) — single #general channel, link in README footer

## T-3 days — final review

- [ ] Read every piece of copy out loud once. Cut anything you stumble over
- [ ] Verify all URLs work in copy (Releases page, GitHub repo, video link)
- [ ] Verify the demo video plays on mobile, desktop, and embedded in a tweet preview
- [ ] **Product Hunt submission drafted** (not published) — review all media slots, copy, makers list
- [ ] **Hunter informed** of the exact submit time (if applicable)
- [ ] Sleep 8 hours minimum the night before. You'll need it

## T-1 day — pre-flight

- [ ] **Tag and push v1.0.0** via your prep script — verify the release.yml runs to completion in <15 minutes
- [ ] **Check the binaries on Releases** download and install once more
- [ ] **README link to Releases** verified pointing at `v1.0.0` page
- [ ] **Schedule the Product Hunt submission** for 00:01 PT (16:01 JST). PH allows pre-publish scheduling
- [ ] **Twitter thread scheduled** via TweetDeck / Hypefury for 09:00 PT (01:00 JST)
- [ ] **Eat. Sleep. Don't make code changes**

---

## Launch day — sequenced timeline

### 14:00 JST (yesterday SF, T-1 22:00 PT) — pre-launch

- [ ] Coffee
- [ ] One final smoke test: install on a clean machine if you can borrow one
- [ ] Make sure your X / GitHub / dev.to / Zenn / PH accounts are all logged in across your browsers

### 16:00 JST (00:00 PT) — Product Hunt window opens

- [ ] **Publish Product Hunt at 00:01 PT** (scheduled the day before)
- [ ] **Post Maker comment** immediately after, per [PRODUCTHUNT.md](PRODUCTHUNT.md)
- [ ] **Share PH link on X** (no separate thread yet — just a single tweet with the PH link): "Just launched Arcade on @ProductHunt. Multi-pane launcher for Claude Code. Honest feedback welcome → [PH link]"

### 16:30–22:00 JST (00:30–06:00 PT) — wait for SF to wake up

- [ ] **Sleep / nap.** Product Hunt's engagement spike comes after SF wakes up at 6:00 PT (22:00 JST). Don't burn yourself out replying to overnight comments in JST night.
- [ ] **Optional**: set Discord notifications to email-only for the PH page so you can scan without staying glued to the laptop

### 22:00 JST (06:00 PT) — engagement begins

- [ ] **Reply to every PH comment** within 5 minutes
- [ ] **Post the Twitter thread** (per [TWITTER_THREAD.md](TWITTER_THREAD.md)) one tweet at a time, 30 seconds apart
- [ ] **Pin the X thread**

### 00:00 JST (08:00 PT, T-day) — HN window opens

- [ ] **Submit Show HN** per [SHOW_HN.md](SHOW_HN.md) — title #1, GitHub URL only (not a blog)
- [ ] **First HN comment** from your account immediately: paste the SHOW_HN body
- [ ] **Stay at the keyboard for 90 min**. Reply to every HN comment within 5 minutes. This is the make-or-break window for front-page placement.

### 02:00 JST (10:00 PT) — Reddit window opens

- [ ] **Submit r/ClaudeAI** (community tone per [REDDIT.md](REDDIT.md))
- [ ] **First comment** from your account immediately, per template
- [ ] **Wait 2 hours**, then submit **r/ChatGPTCoding** (technical tone)

### 04:00 JST (12:00 PT) — newsletter / RT push

- [ ] **DM** one or two relevant newsletter editors (TLDR Dev, Hacker Newsletter, Pointer) with the PH + HN links. Subject: "Arcade — desktop launcher for parallel Claude Code sessions, just launched". One-paragraph body. Don't follow up.
- [ ] **Quote-RT** the Twitter thread from any secondary account or community account you legitimately run.
- [ ] **Continue replying** on PH / HN / Reddit. Reply velocity matters until ~22:00 JST T+1.

### 06:00 JST (14:00 PT) — sustainability mode

- [ ] **Eat real food**
- [ ] **Continue replies**, but you don't need to be at <5min anymore — 30 min is fine
- [ ] **Drop the dev.to and Zenn articles to `published: true`** if HN / PH momentum is good. If it's quiet, delay to T+2 (avoid posting onto a dud)
- [ ] **Post follow-up tweet** with PH ranking + HN rank screenshots if either crosses #5 / front page

---

## First-24-hours response framework

For every comment, follow this rubric. It saves you from rage-replying or going quiet.

1. **Read the whole comment** before drafting a reply
2. **Acknowledge the point** in 1 sentence (even if you disagree, acknowledgement = "you've been heard")
3. **State your position** in 1–2 sentences (data > opinion when possible)
4. **Offer next step** (link to docs, link to an issue tracker, invitation to DM)

**Time budget per reply**: 90 seconds. If you're spending more, the reply is too long.

**When to disengage**:

- Comment is hostile and doesn't engage with substance → reply once politely, then mute the thread
- Comment is repetitive (e.g., 4th "but I use tmux" thread) → quote your own earlier reply, don't re-litigate
- Comment is genuinely a feature request → "Open a GitHub issue with the use case so others can chime in" + move on

---

## Beyond Day 0 — sustaining momentum

### Week 1

- [ ] **T+1 (Tue)**: dev.to article live (if not already), Zenn article scheduled for Wed JST primetime (21:00)
- [ ] **T+2 (Wed)**: Zenn article live + Twitter retweet with JA audience tagline
- [ ] **T+3 (Thu)**: r/ChatGPTCoding cross-post if not done yet
- [ ] **T+4 (Fri)**: Newsletter follow-up (any editor who responded, ping them with PH/HN final results)
- [ ] **T+5 (Sat)**: First "lessons learned" tweet — what went well, what didn't, what's next. People love this honesty
- [ ] **T+6 (Sun)**: Rest. Touch grass.

### Week 2

- [ ] **Newsletters to pitch** (in order of likelihood for our niche):
  1. [TLDR Dev](https://tldr.tech/) — submit via their site
  2. [Hacker Newsletter](https://hackernewsletter.com/) — they pull from HN front page automatically; help them by tagging the top-rated submission
  3. [Pointer](https://www.pointer.io/) — DM the curator
  4. [Console](https://console.dev/) — submit form on site
- [ ] **First Issues to triage**: respond to every issue within 24 hours. If you can't fix, say so and add a `wontfix` or `help-wanted` label
- [ ] **First PR**: respond within 48 hours. Even rejection is better than silence

### Weeks 3–12

- [ ] **Monthly v1.x release** cadence — small features (one of: command palette, drag-reorder, settings panel polish)
- [ ] **Blog post per minor release** — "What's new in v1.x" (Zenn + dev.to)
- [ ] **Discord activity** — try to have one community member with `Contributor` role by end of month 3
- [ ] **Star count check-in**: at week 4, week 8, week 12. If you're below 200 stars by week 4, the launch didn't carry — start a second push (different angle, different community)

---

## Goal: 1000+ GitHub stars in 3 months

For context: roughly half of Show HN launches in the dev-tools space land 200–500 stars in their first week. To get to 1000 by month 3, you generally need at least **one of** the following to happen:

- Front page of HN for ≥6 hours (≥500 upvotes), OR
- #1 Product of the Day on PH (≥800 upvotes), OR
- Substantial coverage in TLDR Dev or Pointer, OR
- A specific high-reach amplifier (Anthropic team retweet, a notable AI engineer endorsement)

**Don't manufacture any of these**. Focus on shipping a launch where the product is real and your replies are good. If the launch lands in the middle of the pack, the follow-up monthly cadence + blog posts will compound.

---

## Failure modes and recovery

| Symptom | What to do |
|---|---|
| PH submission rejected (rules violation) | Read the reason, fix, resubmit on a different day. Don't argue with mods. |
| HN post flagged / deranked | Don't post again. Wait 48 hours and try a different angle (e.g., a technical blog as a separate HN post). |
| Demo video doesn't play in some browsers | Re-encode H.264 baseline + 30fps. Reupload. Tweet update with new link. |
| GitHub Action fails during release | Cancel the publish, fix the YAML, push a new tag. Don't publish broken binaries — better to delay than to ship a half-installer. |
| Critical bug reported in first hour | Acknowledge publicly: "Confirmed — fix coming in v1.0.1 within 24h." Then ship it. People remember responsiveness more than perfection. |
| Burnout / overwhelm | Step away for 2 hours. The launch isn't a sprint; it's a 24-hour shift followed by a 12-week marathon. |

---

## After-action retrospective (write this within 72 hours)

Save to `LAUNCH_RETRO.md` in the repo (or as a draft). Future-you will reread this before the next launch.

- [ ] What worked beyond expectations?
- [ ] What broke / was harder than expected?
- [ ] Top 5 user requests
- [ ] Top 3 questions you couldn't answer well — convert each to a section in README or FAQ
- [ ] Total media: PH rank, HN rank, Reddit upvotes, X impressions, dev.to views, Zenn views, GitHub stars
- [ ] Next milestone date (e.g., v1.1 ship)
