# CC-Launcher 実装計画書

| 項目 | 内容 |
|---|---|
| 文書名 | CC-Launcher 実装計画書 |
| 対象プロダクト | CC-Launcher (Claude Code マルチペインランチャー) |
| バージョン | 1.0 |
| 作成日 | 2026-05-06 |
| 作成者 | quietfork |
| 関連文書 | [cc-launcher_requirements.md](cc-launcher_requirements.md) |

---

## 1. 概要

### 1.1 本書の位置づけ
要件定義書(`cc-launcher_requirements.md`)が **WHAT(何を作るか)** を定義する文書であるのに対し、本書は **HOW / WHEN(どう進めるか・進捗はどこか)** を管理する。

- 要件 ID(FR-xxx)は**要件定義書を Single Source of Truth** とする。本書はそれを参照する形で書かれる。
- 進捗チェックボックスを更新することで、現在のフェーズと残タスクを一覧できる。
- 仕様変更があれば**要件定義書を先に改訂し**、本書はそれに追従する。

### 1.2 改訂履歴

| バージョン | 日付 | 改訂者 | 内容 |
|---|---|---|---|
| 1.0 | 2026-05-06 | quietfork | 初版作成。Phase 0 完了時点。 |
| 1.1 | 2026-05-06 | quietfork | UI デザインは後から提示する方針を追記(12.1)。 |
| 1.2 | 2026-05-06 | quietfork | FR-101 のフォルダ選択方式(`OpenDirectoryDialog` + 手入力)を追記。 |
| 1.3 | 2026-05-06 | quietfork | Phase 1 着手。FR-301 / 302 / 303 / 304 / 305 / 308 を完了マーク。FR-307 はプロジェクト連携待ちで保留。`Terminal.tsx` / `PaneHost.tsx` を新規追加。`shims.d.ts` を追加(react-grid-layout legacy 型補強)。 |
| 1.4 | 2026-05-06 | quietfork | プロジェクト管理ひと回り完了。FR-101 / 102 / 103 / 104 / 107 / 201 / 205 / 206 / 207 / 307 を完了マーク。`project_store.go`(JSON 永続化 + `OpenDirectoryDialog`)、`Sidebar.tsx`、`ProjectDialog.tsx` を新規追加。 |
| 1.5 | 2026-05-06 | quietfork | Phase 2 着手。FR-401 / 402(レイアウト永続化と復元)を完了マーク。`layout_store.go` 新規追加、フロントで 500ms デバウンスの自動保存 + 起動時確認ダイアログを実装。 |
| 1.6 | 2026-05-06 | quietfork | デザインサンプル(`sample/Terminal/`)を取り込み。Phase 1.5「デザイン適用」セクションを新設し、即適用可能(5.5.A)/ アーキテクチャ判断要(5.5.B)/ 将来検討(5.5.C)に分類。FR-501 を 5.5.A と統合。 |
| 1.7 | 2026-05-06 | quietfork | 5.5.B のアーキテクチャ判断確定: tmux 風スプリットツリー採用 / Workspace = Project / タブは当面なし / D&D 再配置あり / ペイン下部入力バー不採用。`react-grid-layout` を撤去予定、`layouts.json` 旧形式は破棄。 |
| 1.8 | 2026-05-06 | quietfork | Phase 1.5 完了。視覚層(CSS 変数 / フォント / モノクロパレット / タイトルバー / ステータスバー / バッジ / アイコン)+ tmux 風スプリットツリー(`splitTree.ts`、`TreeNode.tsx`、`Divider.tsx`)+ ヘッダ D&D 再配置 + テーマ永続化(`settings_store.go`)を実装。FR-501 完了。`react-grid-layout` を依存から削除、`layouts.json` を v2 スキーマ(ツリー)へ変更(v1 は `.bak` 退避)。 |
| 1.9 | 2026-05-06 | quietfork | Phase 1.5 サンプル準拠強化 + 安定化。サイドバーに「active panes」セクション追加。ペインヘッダに ▢⊢ / ▢⊥ 分割ボタン + `ProjectPicker` ポップオーバー追加。Terminal に **3 秒シルエンス → idle 検出**を実装(`running` ↔ `idle` 自動切替)。**ペイン再描画問題を解消**: `TreeNode` 再帰構造を撤去し、ペインを絶対位置でフラット配置(`computeBoxes` / `computeDividers` / `FlatDivider`)。スプリット/移動/リサイズで PaneHost が remount されなくなり、claude セッションが操作で死なない。 |
| 1.10 | 2026-05-06 | quietfork | Phase 2/3 着手。FR-502 フォント設定(`SettingsDialog.tsx`、ライブ適用)/ FR-306 ペイン最大化(他ペインは visibility:hidden で xterm 維持)/ FR-503 キーボードショートカット(Ctrl+Shift+W/E/O/M)を完了。Phase 2 完了マーク。 |
| 1.11 | 2026-05-06 | quietfork | 安定化修正: 最大化が縦に効かなかった問題を修正(`.pane-positioner` を flex container 化、`.workspace` に flex:1 明示、最大化時は inset:0 で 4 辺密着)。同サイズ resize の dedupe を Terminal に追加し SIGWINCH の重複送信を抑止。claude TUI のバナー再描画は claude 側の挙動として保留扱いに。 |
| 1.12 | 2026-05-06 | quietfork | Phase 3 完了 + Phase 4 着手。エラー処理強化(boot notices で `.bak` 退避通知、PTY 起動エラーを xterm に表示)、初回 `--dangerously-skip-permissions` 同意(`ConsentDialog`、`Settings.dangerousConsent`)、ペイン閉じる時のセッション継続中確認を実装。FR-403 名前付きレイアウト(`LayoutStore` v3 スキーマ + `LayoutsMenu`)を完了。 |
| 1.13 | 2026-05-06 | quietfork | UX 安定化。ペイン閉じる確認を WebView2 の `confirm()` から custom modal に置換(他のダイアログと統一)。ウィンドウリサイズ時の追従不具合を修正: 各 Terminal が自身の `ResizeObserver` を持ち、`containerRef` を直接観察。`.terminal-host` クリックで `term.focus()` を呼んで入力可能に。SIGWINCH の debounce を 200ms → 100ms に短縮。 |
| 1.14 | 2026-05-07 | quietfork | Phase 4 を一旦保留にし、**Phase 5: VSCode 風サイドバー化**を新設。Activity Bar 導入 + サイドバートグル(Ctrl+B)+ ビュー切替(Projects / Panes)+ ペインツリー表示。FR-NEW-1〜5 を計画。 |
| 1.15 | 2026-05-07 | quietfork | Phase 5 に **FR-NEW-6 パスのコピー(右クリックメニュー)** を追加。ProjectsView / PaneHost ヘッダ / PaneTreeNode leaf の 3 箇所で右クリック → Copy path / Reveal in Explorer をサポート。 |
| 1.16 | 2026-05-07 | quietfork | Phase 5 実装完了。`ActivityBar` / `ProjectsView` / `PanesView` / `PaneTreeNode` / `ContextMenu` / `Toast` 新規作成、`Sidebar.tsx` 削除、`settings_store.go` に `SidebarHidden` / `ActiveView` 追加、`app.go` に `RevealInExplorer` / `PlatformName` 追加。Ctrl+B でサイドバートグル、アクティブアイコン再クリックで非表示、Copy path/Reveal の右クリックメニュー全 3 箇所で動作。FR-NEW-1〜6 すべて完了マーク。 |
| 1.17 | 2026-05-07 | quietfork | Phase 5 設計見直し。ユーザの意図は「Projects + Active Panes はペア表示のまま」+「**Explorer (ファイルツリー) ビューを追加**」だった。**Phase 5.1** として再設計: Workspace ビュー(Projects + Active Panes ペア)+ Explorer ビュー(登録プロジェクト全体のマルチルートファイルツリー、遅延読込)。`PanesView` / `PaneTreeNode` は削除予定、`WorkspaceView` / `ExplorerView` / `FileTreeNode` を新設、Go 側に `file_browser.go` を追加。 |
| 1.18 | 2026-05-07 | quietfork | Phase 5.1 実装完了。`file_browser.go` (ListDir) / `WorkspaceView` (Projects + Active Panes 一体) / `ExplorerView` (登録プロジェクト全体のマルチルートファイルツリー) / `FileTreeNode` (遅延読込 + 隠しファイル薄表示) を新規作成。`PanesView` / `PaneTreeNode` を削除。Activity Bar アイコン定義を `workspace` / `explorer` に変更。Settings の `ActiveView` 許容値を更新 + 旧値("projects" / "panes") から "workspace" への自動マイグレーション。Explorer フォルダ右クリック → 「Launch session here」でその cwd で claude を起動可能。FR-NEW-7〜11 完了。 |
| 1.19 | 2026-05-07 | quietfork | Phase 5.1 微調整。 (1) Explorer のルート定義を「登録プロジェクト全体」→「**focused pane の cwd 1 つだけ**」に変更。フォーカス切替時に root も切り替わるが、ツリーの開閉状態は path ベースの module-level store (`fileTreeStore.ts`) に保持されるので、戻ってきたら復元される。`hasOpenState` 追加で root のデフォルト展開を実装。 (2) FileTreeNode に open + children=null 時の auto-load を追加。 (3) Terminal `start()` に **term identity 検証**を追加(StrictMode の cleanup-during-init レース対策。1 つ目のペインが split 後に入力不能になる症状を修正)。 (4) ExplorerView / FileTreeNode のキャッシュ + 開閉状態がタブ切替で消えない構造に変更(`useState` 初期値で store からハイドレート)。 |
| 1.20 | 2026-05-07 | quietfork | **FR-NEW-12 Markdown Reader** を Phase 5.1 に追加実装。Explorer で `.md` / `.markdown` をクリック → workspace 右側に Reader パネルを開く(Claude Desktop 風)。`MarkdownReader.tsx` 新規(`react-markdown@8` + `remark-gfm@3` で GFM 対応)、`file_browser.go` に `ReadFile` (5MB 上限 + 拡張子 allowlist) 追加。Reader は最小幅 280px / 最大 900px のドラッグリサイズ可。閉じるボタン / Copy path / Reveal in Explorer。 |

---

## 2. 進捗サマリ

| Phase | 内容 | ステータス | 工数(見積) |
|---|---|---|---|
| Phase 0 | 環境構築 + PoC | ✅ 完了 | 0.5 日 |
| Phase 1 | MVP | ✅ 完了 | 2 日 |
| Phase 1.5 | デザイン適用(Multiplex プロトタイプ) | ✅ 完了 | 1 日 |
| Phase 2 | 永続化 | ✅ 完了 | 1 日 |
| Phase 3 | 仕上げ | ✅ 完了 | 1 日 |
| Phase 4 | 任意機能 | ⏸ 一旦保留(FR-403 完了、残: FR-105 / FR-106 / FR-404) | 1〜2 日 |
| Phase 5 | VSCode 風サイドバー化(Activity Bar + ビュー切替 + パスコピー) | ⚠ 設計差し戻し → Phase 5.1 へ | 0.7〜0.9 日 |
| Phase 5.1 | Workspace + Explorer ビュー再構成 | ✅ 完了 | 0.5〜0.7 日 |

合計: **MVP まで約 2.5 日 / 完成版まで約 5〜6 日**(要件定義書 10 章と整合)

---

## 3. 主要ファイル一覧

### 3.1 既存ファイル(Phase 0 で生成済)

| パス | 役割 |
|---|---|
| [cc-launcher/main.go](cc-launcher/main.go) | Wails エントリポイント。各サービスを bind。 |
| [cc-launcher/app.go](cc-launcher/app.go) | Wails テンプレート由来の App 構造体(現状ほぼ未使用) |
| [cc-launcher/pty_manager.go](cc-launcher/pty_manager.go) | PTY セッション管理(start / write / resize / close / shutdown)。データ送信は `pty:data:<id>` / `pty:exit:<id>` イベント。 |
| [cc-launcher/clipboard_service.go](cc-launcher/clipboard_service.go) | ペースト画像を `~/.cc-launcher/clipboard/` に保存。 |
| [cc-launcher/frontend/src/App.tsx](cc-launcher/frontend/src/App.tsx) | 現状は単一ペイン PoC。Phase 1 で大幅再構成予定。 |
| [cc-launcher/frontend/src/App.css](cc-launcher/frontend/src/App.css) | アプリ全体のレイアウト CSS。 |
| [cc-launcher/frontend/src/style.css](cc-launcher/frontend/src/style.css) | グローバル(html/body)CSS。Wails テンプレートの中央寄せは除去済。 |

### 3.2 今後追加予定のファイル(Phase 1 以降)

| パス | 役割 | 追加フェーズ |
|---|---|---|
| `cc-launcher/project_store.go` | プロジェクトカタログの永続化(`projects.json`) | Phase 1 |
| `cc-launcher/layout_store.go` | レイアウトの永続化(`layouts.json`) | Phase 2 |
| `cc-launcher/settings_store.go` | 設定の永続化(`settings.json`) | Phase 2 |
| `cc-launcher/frontend/src/components/Sidebar.tsx` | プロジェクト一覧サイドバー | Phase 1 |
| `cc-launcher/frontend/src/components/PaneHost.tsx` | グリッド内 1 ペインのホスト(ヘッダ + Terminal) | Phase 1 |
| `cc-launcher/frontend/src/components/Terminal.tsx` | 現在の `App.tsx` 内ロジックを切り出した xterm ラッパ | Phase 1 |
| `cc-launcher/frontend/src/components/ProjectDialog.tsx` | プロジェクト追加 / 編集ダイアログ | Phase 1 |
| `cc-launcher/frontend/src/components/SettingsDialog.tsx` | 設定画面 | Phase 2 |

---

## 4. Phase 0: 環境構築 + PoC ✅ 完了

PoC として下記が実装済。`wails dev` または `cc-launcher.exe` 直接起動で動作確認可能。

- [x] Wails v2 + React + TypeScript プロジェクト初期化
- [x] `go-pty` 統合
- [x] `PtyManager` 実装(start / write / resize / close / shutdown)
- [x] xterm.js + fit addon による単一ペイン
- [x] Wails イベント経由の双方向通信(`pty:data:<id>` / `pty:exit:<id>`)
- [x] `exec.LookPath` で claude の絶対パスを解決(子プロセスの PATH 不一致対策)
- [x] Wails テンプレートの中央寄せ CSS を除去(claude TUI が左寄せ表示)
- [x] **FR-310 クリップボード画像ペースト**(右クリック / Ctrl+V 両対応、二重発火を 700ms タイムスタンプで抑止)
- [x] アプリ終了時の全セッション一括クローズ(ゾンビ防止)
- [x] Stop ボタンでフロント側ステートを idle に復帰

---

## 5. Phase 1: MVP

各 FR を実装単位タスクに分解。**チェックボックス + FR-ID + タイトル** の形式で進捗を管理する。

### 5.1 プロジェクト管理

- [x] **FR-101 プロジェクト登録**
  - 実装: `project_store.go` で JSON 永続化(`~/.cc-launcher/projects.json`、アトミック書き込み、0600)、`PickDirectory` で `OpenDirectoryDialog` をラップ。フロントは `ProjectDialog.tsx` に Browse ボタン + 手入力 + 名前自動補完。
  - 補助機能(D&D / 直近フォルダ記憶)は未対応(Phase 3〜4)

- [x] **FR-102 プロジェクト一覧表示**
  - 実装: `Sidebar.tsx`、登録順表示。最終起動順への切替は未対応(Phase 4)。

- [x] **FR-103 プロジェクト編集**
  - 実装: 各行ホバー時の ✎ ボタン → `ProjectDialog` を edit モードで開く

- [x] **FR-104 プロジェクト削除**
  - 実装: 各行ホバー時の ✕ ボタン → `confirm()` 後 `Delete`

- [x] **FR-107 パス存在チェック**
  - 実装: `ListWithStatus` がアプリ起動時(及び refresh ごと)に `os.Stat` で検証。不在は ⚠ アイコン + 起動ボタン無効化。

### 5.2 セッション起動

- [x] **FR-201 ワンクリック起動**
  - 実装: サイドバー行クリック → 新規ペイン追加 + claude 起動 + `MarkUsed` 呼び出し

- [x] **FR-205 同一プロジェクト多重起動**
  - 実装: プロジェクトごとの通番カウンタ(`projectPaneCounters`)で `<projectName> #N` タイトル付与

- [x] **FR-206 起動失敗ハンドリング**
  - 実装: `Terminal` の status を `error` にし、ヘッダのステータス表示 + ▶ で再試行ボタン表示

- [x] **FR-207 プロセス終了検知 + 再起動ボタン**
  - 実装: exit イベントで status が `exited` になり、ヘッダに ▶(再起動)ボタン表示

### 5.3 ペイン管理

- [x] **FR-301 グリッド表示**
  - `react-grid-layout` v2(legacy API)を導入し 12 カラム制グリッドへ
  - 実装: `App.tsx`、CSS 適用、shim(`shims.d.ts`)で legacy 型定義を補強

- [x] **FR-302 ペインのリサイズ**
  - グリッドの `onResizeStop` / `onDragStop` から `Terminal.fit()` を呼んで PTY も追従

- [x] **FR-303 ペインの移動**
  - `draggableHandle=".drag-handle"` でヘッダドラッグに対応

- [x] **FR-304 ペインの追加**
  - ツールバーの「+ Pane」で空きスペースに追加(`y: Infinity` で最下段に積む)

- [x] **FR-305 ペインの削除**
  - ヘッダの ✕ で `Terminal.stop()` → 配列から除去

- [x] **FR-307 ペインのタイトル**
  - 実装: `<projectName> #<seq>` を `App.tsx` で生成し PaneHost に渡す

- [x] **FR-308 コピー&ペースト**
  - Ctrl+Shift+C で `term.getSelection()` を `navigator.clipboard.writeText` へ
  - ペーストは Phase 0 で実装済

- [x] **FR-309 スクロールバック 10,000 行**
  - Phase 0 で `scrollback: 10000` 設定済(動作確認のみ要)

---

## 5.5 Phase 1.5: デザイン適用(Multiplex プロトタイプ)

ユーザー提示のデザインサンプル: `D:\00_dev\21_terminal\sample\Terminal\` (`Terminal.html` + `app.jsx` + `components.jsx` + `data.jsx`)
プロダクト名候補: **Multiplex**(プロトタイプ名。要件定義書では `CC-Launcher` のまま運用するか、改名するか別途相談)

サンプルから抽出した要素を「即適用可能」「アーキテクチャ判断要」「将来検討」の 3 グループに整理。

### 5.5.A 即適用可能(ロジック非破壊・ビジュアル層のみ)
- [x] **CSS 変数化**(`--bg-0..4` / `--fg-0..3` / `--line` / `--accent` / `--status-*`)
- [x] **フォント**: JetBrains Mono(モノスペース) + Inter(UI)を Google Fonts から読込
- [x] **モノクロパレット適用**(`App.css` 全面書き換え)
- [x] **タイトルバー自前描画**(`TitleBar.tsx` 新規、Wails `Frameless: true`、CSS `--wails-draggable: drag` でドラッグ領域)
- [x] **ステータスバー**(`StatusBar.tsx` 新規、ペイン数 / 実行中 / アイドル / 終了 / エラー / テーマ表示)
- [x] **ステータスバッジ**(`Badge.tsx`、idle / starting / running / exited / error の 5 種、run/error はパルス)
- [x] **サイドバー刷新**(モノスペース小型タイポ、ホバー時に編集 / 削除アイコン)
- [x] **ペインヘッダ刷新**(`[ID]` チップ + 名前 + バッジ + ws-chip、cwd 表示、SVG アイコンボタン)
- [x] **テーマ切替トグル**(タイトルバー右側、`SettingsStore` に永続化 → **FR-501 完了**)

### 5.5.B アーキテクチャ判断(2026-05-06 確定)

| 論点 | 採用 | 補足 |
|---|---|---|
| **レイアウトエンジン** | **B: tmux 風スプリットツリーへ全面置換** | `react-grid-layout` を撤去。新しいデータモデル `Node = {leaf, sessId} \| {split, dir, ratio, a, b}`。FR-301〜305 を再実装、`layouts.json` スキーマもツリー形式に置換(旧形式は破棄して空状態から開始)。 |
| **「Workspace」概念** | **既存の Project と同等扱い** | データモデルは Project 1:1 のまま。UI 上ではペインヘッダに Workspace チップ(プロジェクト名のチップ)を出す。サイドバー上部の "workspaces" は当面は省略 or 単一。 |
| **タブレイアウトモード** | **当面は分割のみ** | 必要が出れば Phase 4 以降で追加。 |
| **ペインヘッダの D&D 再配置** | **入れる** | 1 とセットでスプリットツリーを D&D 編集できるようにする。ヘッダドラッグ → 他ペインの上下左右ドロップゾーンで隣接スプリット挿入。 |
| **ペイン下部の入力バー** | **採用しない** | claude code 自身が下部にプロンプトを描画する TUI のため、外側に入力バーを置くと二重入力になる。xterm に直接入力でいく。 |

### 5.5.C 将来検討(Phase 4 以降)
- **Tasks tray**(セッション横断の running tasks 一覧 / 通知)
- **Cmd-bar(Cmd+K)**(コマンドパレット)
- **タブレイアウトモード**(必要なら 5.5.B のサブ機能として再検討)
- **Workspace 概念の正式導入**(複数 Project の上位グループ化)

---

## 6. Phase 2: 永続化

- [x] **FR-401 レイアウト永続化**
  - 実装: `layout_store.go`(`SaveDefault` / `LoadDefault`、アトミック書き込み)。フロントは `panes` / `layout` 変更時に **500ms デバウンスで自動保存**(終了時保存より確実)。
  - 仕様メモ: 単一の「default」レイアウトのみ保存。FR-403 の名前付きレイアウトは Phase 4。

- [x] **FR-402 レイアウト復元**
  - 実装: アプリ起動時に `LoadDefault` → ペインがあれば「Restore previous session?」確認モーダル。Restore で復元、Start fresh で破棄。
  - 復元時は `paneCounter` と per-project sequence カウンタを保存値以上に補正(ID 衝突防止)。

- [x] **FR-501 テーマ(ダーク / ライト)**
  - 実装: `settings_store.go`(新規)、`SettingsStore.SetTheme` で永続化、`TitleBar` のトグルで切替、`html[data-theme="..."]` で CSS 変数を切替

- [x] **FR-502 フォント設定**
  - 実装: `SettingsDialog.tsx`(タイトルバー右の `settings` ボタンから開く)。フォントファミリ / サイズ / 行間 / スクロールバック / 既定コマンド / 既定 args をフォームで編集 → `SettingsStore.Save` で永続化 → 全 Terminal にライブ適用(`term.options.*`)。

---

## 7. Phase 3: 仕上げ

- [x] **FR-306 ペイン最大化 / 復元**
  - 実装: `PaneHost` に `□` ボタン → クリックで全画面化、再クリックで復元。最大化時は他ペインを `visibility:hidden` で残し(xterm 状態保持)、ディバイダも非表示。

- [x] **FR-503 ショートカット**
  - 実装: フォーカス中ペインに対して `Ctrl+Shift+W` 閉じる / `Ctrl+Shift+E` 右に分割 / `Ctrl+Shift+O` 下に分割 / `Ctrl+Shift+M` 最大化トグル。Terminal の `attachCustomKeyEventHandler` で検出して App に伝播。Esc は claude 中断キーなのでショートカットには未割り当て。

- [x] **エラー処理強化**
  - 実装: 永続化破損時の `.bak` 退避は各 Store で実装済(`projects.json` / `layouts.json` / `settings.json`)。フロントは boot 時にエラー検出 → 上部にバナー表示(`bootNotices`)。PTY 起動エラーは Terminal 側の status を `error` にし、xterm にも赤字で表示 + ▶ 再起動ボタン提示。

- [x] **UX 微調整**
  - 実装: 初回起動時の `--dangerously-skip-permissions` 同意ダイアログ(`ConsentDialog.tsx`、`Settings.dangerousConsent`)。ペイン閉じる時のセッション継続中確認。ツールチップは既存 `title` 属性で確保。

---

## 8. Phase 4: 任意機能(v1.5 候補)

- [x] **FR-403 名前付きレイアウト**(「日中作業用」「Shogun 起動時」など)
  - 実装: `LayoutStore` v3 スキーマで多レイアウト対応(`SaveNamed` / `LoadNamed` / `ListNamed` / `DeleteNamed`)。タイトルバー右の `layouts` ボタンで `LayoutsMenu` ポップオーバー → 切替/削除/「Save current as…」。切替時は実行中ペインがあれば確認ダイアログ。
- [ ] **FR-404 プロジェクトテンプレート**(起動時に N ペイン自動展開)
- [ ] **FR-106 タグ / カテゴリ**
- [ ] **FR-105 サイドバー並び替え**(D&D)

> **メモ**: 2026-05-07 時点で Phase 4 残タスクは一旦保留。先に Phase 5(VSCode 風サイドバー化)を実施する。

---

## 8.5 Phase 5: VSCode 風サイドバー化

### 8.5.1 ゴール
現状のサイドバー(`Sidebar.tsx`、projects + active panes の 2 セクション縦並び)を、VSCode の Activity Bar + Side Bar 構造に再構成する。これにより:

- **画面の専有面積を任意に調整できる**(サイドバーを丸ごと隠せる → workspace を最大化)
- **複数のビューを同居させやすい**(将来 Tasks / Search / Settings などをアイコン追加で拡張可能)
- **ペイン構造をツリーで俯瞰できる**(分割が深くなった時に「どこに何があるか」が見える)

### 8.5.2 レイアウト構造

```
┌──┬──────────────┬─────────────────────────────────┐
│A │  Side Bar    │           Workspace             │
│c │  (current    │           (panes grid)          │
│B │   view)      │                                 │
│a │              │                                 │
│r │              │                                 │
└──┴──────────────┴─────────────────────────────────┘
 48px   ~280px               flex: 1
```

| 領域 | 幅 | 役割 |
|---|---|---|
| Activity Bar | 48px 固定 | 縦アイコンストリップ。アクティブビューを示すインジケータ付き。常時表示。 |
| Side Bar | デフォルト 280px(後にリサイザ追加検討) | 選択中のビュー本体。トグルで非表示可。 |
| Workspace | flex: 1 | 既存のペイングリッド。Side Bar を隠せばここが拡大。 |

### 8.5.3 タスク

- [x] **FR-NEW-1 Activity Bar 導入**
  - 新規: `frontend/src/components/ActivityBar.tsx`(48px 縦ストリップ、アイコン + アクティブインジケータ)
  - アイコン: `Folder`(Projects)/ `Layers`(Panes)。`components/Icons.tsx` に追加。
  - アクティブビュー再クリックで Side Bar を非表示にする(VSCode と同じ挙動)
  - 工数: 0.1 日

- [x] **FR-NEW-2 サイドバー表示/非表示トグル**
  - キーバインド: `Ctrl+B`(VSCode 互換)
  - フロント状態: `sidebarVisible: boolean` / `activeView: 'projects' | 'panes'`
  - 非表示時は Activity Bar のみが残り、workspace が左端まで広がる
  - 工数: 0.1 日

- [x] **FR-NEW-3 ビュー: Projects**
  - 既存 `Sidebar.tsx` の "projects" セクションを `ProjectsView.tsx` として切り出し
  - ヘッダ: `PROJECTS` ラベル + 件数 + 追加ボタン(+)
  - 機能(ホバーで編集/削除、パス警告 ⚠、起動)はそのまま継承
  - 工数: 0.1 日

- [x] **FR-NEW-4 ビュー: Pane Tree**
  - 新規: `PanesView.tsx`(コンテナ)+ `PaneTreeNode.tsx`(再帰)
  - `splitTree.ts` のツリーをそのまま再帰描画(VSCode Outline 風):
    - **Split ノード**: ▾/▸ で開閉、`h` / `v` バッジ、`ratio` を小さく表示
    - **Leaf ノード**: `[ID]` チップ + プロジェクト名 + ステータスバッジ + ホバー時 ✕
  - Leaf クリック → 該当ペインに `term.focus()`(`paneRefs` 経由で Terminal の focus メソッドを公開)
  - 空状態のメッセージ(「No active panes. Click a project to start one.」)
  - 工数: 0.2 日

- [x] **FR-NEW-5 永続化**
  - `settings_store.go` に `SidebarVisible bool` / `ActiveView string` を追加(zero-value は `true` / `"projects"`)
  - `App.tsx` の起動時にロード、変更時に save(既存の Settings save パターンに合わせる)
  - 工数: 0.1 日

- [x] **FR-NEW-6 パスのコピー(右クリックコンテキストメニュー)**
  - 新規: `frontend/src/components/ContextMenu.tsx`(汎用ポップオーバー、絶対配置、Esc/外クリック閉、画面端クリッピング)
  - 新規: `frontend/src/components/Toast.tsx`(コピー成功時の小さな通知、2 秒自動消滅)
  - 対象箇所:
    - `ProjectsView.tsx`: 各プロジェクト行に `onContextMenu`(項目: Copy path / Edit / Delete を統合してもよい)
    - `PaneHost.tsx`: ヘッダの cwd 表示に `onContextMenu`(項目: Copy path)
    - `PaneTreeNode.tsx`: leaf に `onContextMenu`(項目: Copy path / Focus / Close)
  - メニュー項目:
    - **Copy path** → `navigator.clipboard.writeText(path)` → トースト「Path copied」
    - **Reveal in Explorer**(任意)→ Go 側に `RevealInExplorer(path string)` を追加(`app.go` 拡張、`main.go` で bind)。Windows: `explorer.exe /select,<path>` / macOS: `open -R <path>` / Linux: `xdg-open <dir>`。プラットフォーム判定は `runtime.GOOS`。
  - 工数: 0.2 日

### 8.5.4 影響ファイル

| パス | 種別 | 内容 |
|---|---|---|
| `cc-launcher/settings_store.go` | 修正 | `SidebarVisible` / `ActiveView` フィールド追加。後方互換性は zero-value で吸収。 |
| `cc-launcher/frontend/src/components/ActivityBar.tsx` | 新規 | Activity Bar 本体 |
| `cc-launcher/frontend/src/components/ProjectsView.tsx` | 新規 | Projects ビュー(現 Sidebar 上半分の切り出し) |
| `cc-launcher/frontend/src/components/PanesView.tsx` | 新規 | Panes ビュー(ツリー)コンテナ |
| `cc-launcher/frontend/src/components/PaneTreeNode.tsx` | 新規 | 再帰的ツリーノード |
| `cc-launcher/frontend/src/components/Sidebar.tsx` | 削除 or 薄いラッパに | 役割を ProjectsView / PanesView に分割 |
| `cc-launcher/frontend/src/components/Icons.tsx` | 修正 | `Folder` / `Layers` / `ChevronRight` / `ChevronDown` 追加 |
| `cc-launcher/frontend/src/components/Terminal.tsx` | 修正 | 外部から focus を呼べるよう ref 公開(`forwardRef` + `useImperativeHandle`) |
| `cc-launcher/frontend/src/App.tsx` | 修正 | `sidebarVisible` / `activeView` 状態管理、Ctrl+B ハンドラ、レイアウト変更、トースト発火 |
| `cc-launcher/frontend/src/App.css` | 修正 | `.activity-bar` / `.side-bar` / `.activity-icon` / `.pane-tree-*` / `.context-menu` / `.toast` スタイル追加 |
| `cc-launcher/frontend/src/components/ContextMenu.tsx` | 新規 | 汎用コンテキストメニュー(項目配列を受け取って描画) |
| `cc-launcher/frontend/src/components/Toast.tsx` | 新規 | 軽量トースト通知 |
| `cc-launcher/app.go` | 修正 | `RevealInExplorer(path string) error` を追加(任意) |
| `cc-launcher/main.go` | 修正 | 上記メソッドの bind |
| `cc-launcher/frontend/src/components/PaneHost.tsx` | 修正 | cwd 表示に `onContextMenu` |

### 8.5.5 設計メモ
- **Activity Bar は常時表示**: 隠してしまうと再表示の手段がキーボードのみになり初見ユーザーに不親切。最小幅 48px なので犠牲も小さい。
- **アクティブビュー再クリックで非表示**: VSCode の挙動を踏襲。アクション数が減って操作性が良い。
- **アイコンクリック ≠ トグル(別ビューが選択されているとき)**: 別ビューが選択されている時に違うアイコンを押すとビュー切替のみ(非表示にしない)。
- **ツリービューの状態管理**: 各 split ノードの開閉状態は **Activity Bar の保持セッション内**ではメモリのみ(ペイン追加 → 自動展開、リロード時はデフォルト全展開)。永続化までは不要。
- **ペイン削除・分割ボタンは PanesView にも置く?**: v1 では置かない(ペインヘッダの操作で十分)。Tree ビューは「位置の俯瞰 + フォーカス遷移」に特化させる。
- **将来拡張**: Activity Bar に Settings / Layouts アイコンを追加する案もあるが、これらは既にタイトルバーから開けるので一旦保留。Tasks / Cmd-bar(5.5.C)を入れる時に再検討。
- **コンテキストメニューのスタイル**: 既存の Popover(LayoutsMenu / ProjectPicker)と同じトーン。フォント JetBrains Mono、最小幅 160px、項目高 28px。区切り線は `--line` 変数で。
- **クリップボード API 失敗時のフォールバック**: WebView2 で `navigator.clipboard.writeText` が失敗するケース(極稀)に備え、Go 側に `WriteClipboardText(text string)` を入れて呼び分けてもよい。Phase 0 の経験から WebView2 の write は概ね問題ないので、**初版は JS のみで実装し、エラーが出れば追加対応**する方針。
- **「Reveal in Explorer」を v1 に入れるか**: Wails の `runtime` には直接の API がないため Go 側で `exec.Command` を呼ぶ必要がある。プラットフォーム別実装が必要だが Windows のみで十分なら 30 分で書ける。**初版は Windows のみ実装、他 OS では非表示**でよい。

### 8.5.6 想定リスク
- `Sidebar.tsx` の削除/分割で既存の参照(App.tsx 内)が広範囲に変わる → diff が膨らむ。先に **ProjectsView / PanesView を作って Sidebar からインポート** → 動作確認 → 最後に Sidebar を削除する 2 段階で進める。
- Terminal の `forwardRef` 化は既存の `useEffect` ライフサイクルに影響しないよう、ref 公開は `focus` メソッドのみに限定する。

---

## 8.6 Phase 5.1: Workspace + Explorer ビュー再構成

### 8.6.1 経緯
Phase 5 で「Projects」と「Active Panes」を別ビューに分けたが、ユーザの要望は **「ペアのまま 1 ビュー」+「Explorer (ファイルツリー) ビュー追加」** だった。Phase 5 の Activity Bar / ContextMenu / Toast / 永続化基盤は活かしつつ、ビュー構成だけ差し替える。

### 8.6.2 新しい Activity Bar 構成

| アイコン | ビュー名 | 内容 |
|---|---|---|
| 🪟 Layers | **Workspace** | **Projects(上) + Active Panes(下) のペア表示**(旧 Sidebar の構成に戻す) |
| 📁 Folder | **Explorer** | **focused pane の cwd 1 つを root とするファイルツリー**(VSCode Explorer 風、遅延読込)。フォーカス切替で自動追従。ツリーの開閉状態は path ベースの store に保持。 |

### 8.6.3 タスク

- [x] **FR-NEW-7 ビュー再統合(Workspace)**
  - 新規: `frontend/src/components/WorkspaceView.tsx`(`ProjectsView` を上、active panes 一覧(平坦リスト)を下)
  - active panes 一覧は旧 `Sidebar.tsx` の下部セクションを再現(クリックで focus、✕ で close、右クリックで Copy path)
  - 工数: 0.1 日

- [x] **FR-NEW-8 Explorer 用バックエンド**
  - 新規: `cc-launcher/file_browser.go`
    - `type FileEntry struct { Name string; IsDir bool; IsHidden bool }`
    - `ListDir(path string) ([]FileEntry, error)` — `os.ReadDir` を使い、ディレクトリ優先 + アルファベット順でソート、エラー時は空 slice 返却
  - `main.go` で `NewFileBrowser()` を bind
  - 工数: 0.1 日

- [x] **FR-NEW-9 Explorer ビュー(マルチルート + 遅延読込)**
  - 新規: `frontend/src/components/ExplorerView.tsx`
    - 登録プロジェクトをすべて root として並列表示
    - 各 root は `<FileTreeNode>` の rootPath として渡す
    - 検索ボックス・隠しファイル表示トグルは将来検討
  - 新規: `frontend/src/components/FileTreeNode.tsx`
    - 再帰描画。`isDir` の場合のみ ▸/▾ + クリックで開閉
    - 開閉時に `ListDir(path)` を呼んで子要素を取得、メモリキャッシュ
    - 隠しファイル(`.` 始まり)は薄く表示
    - 右クリック → Copy path / Reveal in Explorer / (フォルダのみ)Launch session here(その cwd で claude を起動)
    - エラー時は赤字で「permission denied」等を表示
  - 工数: 0.3 日

- [x] **FR-NEW-10 古いビューの撤去**
  - 削除: `PanesView.tsx`、`PaneTreeNode.tsx`(active panes ツリー表示は不要に)
  - `App.tsx` から関連参照を削除
  - 工数: 0.05 日

- [x] **FR-NEW-11 設定の許容値更新**
  - `settings_store.go` の `ActiveView` 許容値: `"workspace" | "explorer"`(旧 `"projects" | "panes"` は load 時に migrate)
  - 工数: 0.05 日

- [x] **FR-NEW-12 Markdown Reader(Claude Desktop 風)**
  - 新規: `frontend/src/components/MarkdownReader.tsx`(`react-markdown@8` + `remark-gfm@3`)
  - 新規バックエンド: `file_browser.go` の `ReadFile(path) (string, error)` (5MB 上限、拡張子 allowlist `.md/.markdown`)
  - Explorer で `.md` ファイルクリック → workspace 右側に Reader パネルが開く(workspace 領域を `display:flex` で分割)
  - Reader UI: ヘッダ(ファイル名 + フルパス + Copy path / Reveal / Close)+ スクロール本文
  - リサイズ: workspace と reader の境界を `.reader-divider` でドラッグ可(280px〜900px)
  - 閉じる ✕ で workspace が全幅に復帰
  - 工数: 0.4 日

### 8.6.4 影響ファイル

| パス | 種別 | 内容 |
|---|---|---|
| `cc-launcher/file_browser.go` | 新規 | `ListDir(path) []FileEntry` |
| `cc-launcher/main.go` | 修正 | `FileBrowser` を bind |
| `cc-launcher/settings_store.go` | 修正 | ActiveView の許容値変更 + migration |
| `frontend/src/components/WorkspaceView.tsx` | 新規 | Projects + ActivePanes 一体ビュー |
| `frontend/src/components/ExplorerView.tsx` | 新規 | マルチルートツリーコンテナ |
| `frontend/src/components/FileTreeNode.tsx` | 新規 | 再帰ファイル/フォルダノード |
| `frontend/src/components/ActivityBar.tsx` | 修正 | アイコン定義を `workspace` / `explorer` に変更 |
| `frontend/src/components/PanesView.tsx` | 削除 | — |
| `frontend/src/components/PaneTreeNode.tsx` | 削除 | — |
| `frontend/src/App.tsx` | 修正 | ビュー切替先を変更、PanesView を削除し WorkspaceView を導入 |
| `frontend/src/App.css` | 修正 | `.file-tree-*` スタイル追加、`.pane-tree-*` 削除 |

### 8.6.5 設計メモ
- **マルチルート vs 単一プロジェクト選択**: VSCode の multi-root workspace と同じく、登録プロジェクトすべてを root としてフラットに並べる。プロジェクトが 20 個あっても折りたたみ状態なら 20 行なので OK。
- **遅延読込**: フォルダを開いた時のみ `ListDir` を呼ぶ。一度開いたフォルダは在席キャッシュ。プロジェクト追加・削除時は明示的にキャッシュクリア。リフレッシュボタンは将来検討。
- **隠しファイル**: 表示するが透明度 50%。OS 別の隠し属性(Windows hidden flag)は v1 ではチェックせず、`.` 始まりのみで判定。
- **大量ファイル対策**: 仮想スクロールは未実装。1000 ファイル超のフォルダはまず開かないが、開いたら遅くなる。問題が出たら対応。
- **Explorer から「ペイン起動」**: フォルダの右クリックで「Launch session here」項目を出し、そのフォルダを cwd として claude を起動。これがあると Explorer がプロジェクト発見 → 起動の導線になる。

---

## 9. Out of Scope(v1)

要件定義書 1.4 のとおり、以下は v2 以降で検討:
- リモートホスト(SSH 越し)での Claude Code 起動
- Claude Code 以外の任意コマンド実行
- セッションログの永続化・検索
- チーム共有・クラウド同期
- プラグイン機構

---

## 10. 既知の課題 / リスクメモ

| 課題 | 状況 / 対応 |
|---|---|
| `wails dev` で Go ファイル変更 → アプリ再起動 → claude セッションが死ぬ | dev 中の運用上の制約。フロント編集(`.tsx`/`.css`)は HMR で生存する。Phase 1 では Go の変更を最小化するか、頻繁に dev 再起動する運用で許容。 |
| WebView2 のクリップボード API 権限 | `navigator.clipboard.read()` は環境によりブロックされる可能性。Phase 0 では問題なし。問題発生時は OS クリップボードを Go 経由で読む手段にフォールバック検討。 |
| `react-grid-layout` × xterm fit の競合 | 要件 11 章のリスクとして既知。`ResizeObserver` + デバウンス + `fitAddon.fit()` で対応(Phase 1 FR-302)。 |
| 多数同時起動時のメモリ消費 | 性能保証ライン 12 ペイン超は未検証。Phase 1 完了後に簡易ベンチで確認予定。 |
| `--dangerously-skip-permissions` 常時付与 | 初回同意ダイアログを Phase 3 で実装。`settings.json` に同意フラグを保存。 |
| Stop ボタンと終了検知の二重発火 | Phase 0 で `EventsOff` + state リセットにより回避済。Phase 1 でペイン化する際にも踏襲する。 |
| ペインリサイズ時に claude TUI が起動バナーを再描画して scrollback に重複する | claude 側の挙動(SIGWINCH 受信時に画面クリアせず再描画)。会話履歴は失われない。本アプリ側では同サイズの SIGWINCH 重複送信を抑止する dedupe を実装済(`Terminal.tsx` の `lastSizeRef`)が、本質的な解決は claude 側の対応待ち。**保留**。 |

---

## 11. Next Up(直近の着手順)

Phase 0〜3 + FR-403(名前付きレイアウト)まで完了済。次は **Phase 5: VSCode 風サイドバー化** に着手する。順序は以下の通り:

1. **FR-NEW-3 ProjectsView を切り出し**(リファクタ起点。既存 Sidebar 上半分を分離)
2. **FR-NEW-4 PanesView + PaneTreeNode**(splitTree の再帰描画 + leaf クリックで focus)
3. **FR-NEW-1 ActivityBar 導入**(2 ビューを切替可能にする)
4. **FR-NEW-2 サイドバートグル**(Ctrl+B + アクティブアイコン再クリック)
5. **FR-NEW-5 永続化**(`SettingsStore` に `SidebarVisible` / `ActiveView` を追加)
6. **FR-NEW-6 ContextMenu + Toast + Copy path**(ProjectsView / PaneHost / PaneTreeNode の右クリック対応)
7. 最後に **`Sidebar.tsx` を削除**(参照が全て新コンポーネントに移ったことを確認後)

Phase 5 完了後、改めて Phase 4 残タスク(FR-404 / FR-106 / FR-105)を再開するかユーザーと相談。

---

## 12. 進め方のルール

- 各タスク完了時に本書のチェックボックスを `[ ]` → `[x]` に更新
- 仕様変更があれば**先に要件定義書を改訂**し、本書から参照を更新
- Phase ごとに改訂履歴(1.1 章)へ追記
- 想定工数を超えそうな場合は早めに相談

### 12.1 UI デザインの扱い
画面デザインはユーザーが後から提示する。それまでの方針:

- **Phase 1 の UI は「最小スタイル」で実装**(機能・配置・状態管理を優先)
- デザインが提示された段階で、CSS / レイアウトのみを差し替える(ロジックは触らない)
- そのため UI コンポーネントは**スタイルとロジックを分離**して書く(CSS を一括差し替え可能な構造にする)
- デザイン適用フェーズは Phase 1 完了後に専用フェーズとして挿入する想定
