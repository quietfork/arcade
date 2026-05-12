# Arcade — 90s Demo Script

90 秒、15 フレーム。ナレーションは英語、字幕も英語(後から日本語字幕を別途付与可)。BGM は控えめ、ナレーション優先。

---

## Hook frame (0–3s) — 最重要

最初の 3 秒で動画を最後まで見るかどうかが決まる。**動きと密度**でつかむ。

- **画面**: Arcade 全画面、4 ペインそれぞれで claude が同時にプロンプト処理中。ペインヘッダの running バッジ(緑)がパルス。背景は 1920×1080 黒一色。
- **動き**: 全ペインに 0.5 秒ずらしでテキストがタイピング流入。視線を散らす。
- **ナレーション (0–3s)**: "Four Claude Code sessions. One window."
- **字幕 (0–3s)**: `4 Claude Code sessions. 1 window.`
- **BGM**: ローパスから瞬間的にカットイン。

---

## フレーム表

| # | 時間 (s) | 映すもの | ナレーション (英) | 字幕 |
|:--:|:--|:--|:--|:--|
| 1 | 0–3 | 4 ペインで claude が並列実行中(ヒーロー)。各ペインで違うプロンプトが走っている | "Four Claude Code sessions. One window." | `4 Claude Code sessions. 1 window.` |
| 2 | 3–9 | デスクトップに戻り、Terminal を 4 つ開いて `cd ~/dev/...` を 4 回打ってる映像。BGM が緊張感のあるトーンに | "Running Claude across projects means cd-ing all day." | `cd, cd, cd, cd...` |
| 3 | 9–14 | Arcade 起動。サイドバーから `+ Add` クリック → フォルダ選択 → 名前入力 | "Register your projects once." | `Step 1 — Register projects.` |
| 4 | 14–20 | サイドバーに 5 件のプロジェクトが並んでいる。`shogun` をクリック → 中央ペインに claude が立ち上がる | "One click runs claude in that folder." | `1 click → claude is running.` |
| 5 | 20–26 | `trading-bot` をクリック → 2 ペイン目に追加。両方の claude にプロンプトが入力されていく | "Stack as many sessions as you want." | `Stack sessions side by side.` |
| 6 | 26–32 | ペインヘッダの `⊢` ボタンをクリック → 横分割。さらに `⊥` で縦分割。4 ペインに | "Split horizontally. Or vertically. Or both." | `Split panes. Like tmux.` |
| 7 | 32–38 | ペイン間のディバイダーをドラッグ。claude TUI がリサイズに追従(SIGWINCH)。テキストは崩れない | "Resize with the mouse. The TUI follows." | `Drag dividers. PTY follows.` |
| 8 | 38–44 | Activity Bar の Explorer アイコンをクリック → ファイルツリーが展開。`.md` をクリック | "Browse files in the active pane." | `File explorer, built in.` |
| 9 | 44–50 | 右側に Markdown リーダーが開く。README をスクロール | "Markdown opens beside the terminal." | `Read .md next to your terminal.` |
| 10 | 50–57 | タイトルバーの「New Window」をクリック → 2 つ目の Arcade ウィンドウが開く。同じプロジェクト集合、別レイアウト | "Open the same projects in two windows." | `Multi-window via slot system.` |
| 11 | 57–63 | 片方のウィンドウで `~/.arcade/projects.json` が更新される → もう片方が fsnotify でライブ反映 | "They sync live through the filesystem." | `Live sync via fsnotify.` |
| 12 | 63–69 | レイアウトメニューから `Save as...` → "Trading" と命名して保存。再起動 → "Trading" を選択 → 同じレイアウトで復元 | "Save named layouts. Reload them anytime." | `Named layouts. Persist forever.` |
| 13 | 69–75 | 設定ダイアログを開いてフォント JetBrains Mono → IBM Plex Mono に変更。テーマ切替も一瞬見せる | "Fonts and themes. JSON in `~/.arcade/`." | `Yours to tune.` |
| 14 | 75–83 | テックスタック スーパー画面: Wails / Go / xterm.js / React のロゴが順に表示。MIT バッジ | "Built with Wails, Go, and xterm.js. MIT licensed." | `Wails · Go · xterm.js · MIT` |
| 15 | 83–90 | ロックアップロゴ → GitHub URL → ⭐ アイコン点滅 | "Arcade. github.com/quietfork/arcade" | `github.com/quietfork/arcade` |

---

## 音声・BGM

- **ナレーション**: 男性 or 女性 1 名。早口にならない、抑揚控えめ、120–140 wpm 程度。ElevenLabs の `Rachel` / `Adam` あたりが無難。録音は USB マイク(SHURE MV7 など)推奨。リバーブ無し、軽くコンプ。
- **BGM**: lo-fi instrumental、no vocals、BPM 80–100。フレーム 1〜2 の境目で 1 度抜き差し(ダイナミクスの山)。
  - 候補ソース: [Epidemic Sound](https://www.epidemicsound.com/) / [Artlist](https://artlist.io/) / [Uppbeat](https://uppbeat.io/) (Uppbeat は無料枠あり)
  - キーワード検索: `lo-fi minimal coding`, `tech ambient subtle`
- **SE**: フレーム 4(クリック起動)、フレーム 6(分割)、フレーム 10(新規ウィンドウ)で控えめなクリック音。

---

## 録画ツール

| OS | ツール | 価格 | 強み |
|---|---|---|---|
| macOS | [ScreenStudio](https://www.screen.studio/) | $89 (買い切り) | カーソル追従ズーム、自動ハイライト、4K 出力 |
| Windows | [OBS Studio](https://obsproject.com/) | 無料 | 標準。後工程で DaVinci Resolve / Premiere でカット |
| 代替 (Win/Mac) | [Loom](https://www.loom.com/) | 無料枠あり | 即録画即共有。仕上げ用ではないが、社内レビュー用に便利 |

編集は [DaVinci Resolve](https://www.blackmagicdesign.com/products/davinciresolve)(無料)推奨。BGM ダッキング、テキスト オーバーレイ、トランジションも全部できる。

---

## 録画前チェックリスト

### システム

- [ ] OS の通知を完全に OFF(Win: Focus Assist / macOS: Do Not Disturb)
- [ ] Slack / Discord / メールアプリを全終了
- [ ] バッテリー充電中(録画中の sleep を防止)
- [ ] 解像度を **1920×1080** に固定(4K で録ると後でリサイズに時間取られる)
- [ ] スケーリングは 100%(125% / 150% だと UI が不自然に大きく映る)

### Arcade 側

- [ ] テーマ: **Dark**
- [ ] フォント: **JetBrains Mono, 14pt** (xterm)
- [ ] サイドバーの幅: 240px
- [ ] プロジェクトリストを整理(録画用に 5 件程度。`shogun` / `trading-bot` / `arcade-dev` / `notes` / `plc-tools` あたりが無難)
- [ ] 過去のセッションは全閉じ(クリーンな状態から始める)
- [ ] `~/.arcade/clipboard/` の中身をクリア
- [ ] アプリ起動時のレイアウト復元確認ダイアログを事前に OFF(`restoreLayoutOnStart: false` 推奨、復元シーンはフレーム 12 で別に撮る)

### Claude Code 側

- [ ] `claude --version` で最新版確認
- [ ] 認証済(初回ログインダイアログが出ない状態)
- [ ] 各プロジェクトに何らかのファイルがあり、claude が即座にコンテキスト把握できる
- [ ] プロンプト例を 3–4 個用意:
  - `"list the most recently modified Go files"`
  - `"write a unit test for splitTree.ts"`
  - `"summarize the architecture in 3 bullets"`
  - `"add a divider drag handler with snap-to-edge"`

### カーソル・マウス

- [ ] カーソルサイズ: 中(大は煽りすぎ、小は見えにくい)
- [ ] カーソルの色: 白 or システムデフォルト
- [ ] マウスホイールスクロールは滑らかに(マクロで一定速度推奨)

### 録音(ナレーション)

- [ ] マイク チェック(コンプ 3–4dB、ローカット 80Hz)
- [ ] 部屋の暗騒音: エアコン OFF、扇風機 OFF
- [ ] 一発録りはしない。フレームごとに撮る → 編集でつなぐ

---

## ショット計画 (撮影順)

ナレーションは編集で合わせるので、画面録画はストーリー順でなくても OK。**長尺で 1 連の操作を 5 回くらい撮って、ベストテイクを編集で選ぶ**のが効率的。

1. **クリーンスタート** — Arcade 起動 → プロジェクト追加 → 1 クリック起動(フレーム 3–4 用)
2. **スプリット撮影** — 4 パターンの分割を 30 秒ずつ(フレーム 6 用)
3. **リサイズ** — ディバイダー操作を 4–5 回(フレーム 7 用)
4. **Explorer + Markdown** — `.md` を開いてスクロールを 3 回(フレーム 8–9 用)
5. **マルチウィンドウ** — 新規ウィンドウを開く操作を 3 回(フレーム 10–11 用)
6. **レイアウト保存・復元** — Save → 再起動 → 復元を 2 回(フレーム 12 用)
7. **設定** — Settings ダイアログでフォント変更を 1 回(フレーム 13 用)
8. **オープニング(後撮りでも可)** — 4 ペインで claude が同時実行している絵(フレーム 1 用)

---

## 公開後のサムネ要件

- 1280×720
- 中央に Arcade ロックアップロゴ
- 背景は 4 ペイン分割画面のスクショ(ぼかし 8px)
- 左上に "v1.0" バッジ(任意)
- 文字は最大 5 語まで(`Claude Code, Side by Side` など)

---

## 派生フォーマット

- **Twitter 用 (60s 縮短版)**: フレーム 2 と 13 を削除、フレーム 4-9 を主軸に
- **ProductHunt 用 (30s ループ GIF)**: フレーム 6-9 だけを抜き出して FFmpeg で GIF 化
- **Show HN 用 (静止画)**: フレーム 1 のスクショ + フレーム 12 のスクショの 2 枚をリンク
