<p align="center">
  <img src="assets/logo/arcade-lockup.svg" alt="Arcade" width="480">
</p>

<p align="center">
  <b>Claude Code 用のマルチエージェントワークスペース。tmux 風スプリットで並列セッションを 1 クリック起動・配置。</b>
</p>

<p align="center">
  <a href="https://github.com/quietforkTsuruta0821/arcade/releases/latest"><img src="https://img.shields.io/github/v/release/quietforkTsuruta0821/arcade?style=flat-square" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/quietforkTsuruta0821/arcade?style=flat-square" alt="License: MIT"></a>
  <a href="https://github.com/quietforkTsuruta0821/arcade/stargazers"><img src="https://img.shields.io/github/stars/quietforkTsuruta0821/arcade?style=flat-square" alt="GitHub stars"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey?style=flat-square" alt="Platforms: Windows, macOS">
</p>

<p align="center">
  <a href="README.md">English</a> · 日本語
</p>

<!-- HERO_VIDEO: 90秒のデモ動画 (YouTube / Loom) を差し込む。下記は YouTube サムネをリンク化するパターン。 -->
<!--
<p align="center">
  <a href="https://youtu.be/REPLACE_WITH_VIDEO_ID">
    <img src="https://img.youtube.com/vi/REPLACE_WITH_VIDEO_ID/maxresdefault.jpg" alt="Arcade demo" width="720">
  </a>
</p>
-->

---

## Arcade とは

Arcade は Claude Code のためのデスクトップ ランチャーです。プロジェクトを一度登録すれば、ワンクリックで Claude セッションを起動できます。各セッションは独立したペインで開き、左右や上下に自由に分割できます。tmux に似ていますが、マウスで操作でき、設定ファイルは不要です。

Windows と macOS でネイティブ動作します。アプリ本体は単一バイナリ + `~/.arcade/` 配下の設定ファイルだけです。

## できること

- **プロジェクトカタログ**: 任意のローカルフォルダを登録 → ワンクリックで `claude --dangerously-skip-permissions` をそのフォルダで起動。
- **tmux 風スプリット**: ペインのヘッダをドラッグして縦/横に分割。グリッドのセルに縛られず、自由なサイズで配置できます。
- **マルチウィンドウ**: 同じプロジェクトを 2 つのウィンドウで同時に開けます。書き込みは単一ウィンドウから、もう一方は fsnotify でライブ同期。
- **ファイルエクスプローラ + Markdown リーダー**: VS Code 風サイドバーがアクティブペインの cwd を表示。`.md` をクリックするとサイドパネルでプレビュー。
- **レイアウト永続化**: 名前付きレイアウト(`"日中トレード用"`、`"Shogun"` など)で保存 → 後から復元。
- **邪魔をしない UI**: ダークテーマ、JetBrains Mono、テレメトリなし、ログインなし。

## スクリーンショット

<!-- SCREENSHOT_1: 4ペインで claude が並列動作しているメイン画面(横長ヒーローショット) -->
<!-- caption: 4 つの Claude Code セッションを 1 ウィンドウに並列配置。 -->

<!-- SCREENSHOT_2: サイドバー + 「+ Add」ダイアログ -->
<!-- caption: フォルダを選んで名前を付けるだけでプロジェクトを登録。 -->

<!-- SCREENSHOT_3: ペインのリサイズ中(ディバイダーをドラッグ中) -->
<!-- caption: ディバイダーをドラッグでリサイズ。PTY もリアルタイム追従。 -->

<!-- SCREENSHOT_4: Explorer ビュー + 右側に Markdown リーダー -->
<!-- caption: アクティブプロジェクトのファイルをブラウズ。`.md` を開けばターミナル横で読める。 -->

<!-- SCREENSHOT_5: 2 つの Arcade ウィンドウが横並びで動いている図 -->
<!-- caption: マルチウィンドウ。同じプロジェクト集合、別レイアウト、ライブ同期。 -->

<!-- SCREENSHOT_6: 設定ダイアログ -->
<!-- caption: フォント、テーマ、既定コマンドを JSON で保持。 -->

## クイックスタート

### Windows

1. [Releases](https://github.com/quietforkTsuruta0821/arcade/releases/latest) から `Arcade-Setup-vX.Y.Z.exe` をダウンロード。
2. インストーラを起動。SmartScreen が警告を出すので **詳細情報 → 実行** をクリック。署名は現時点で未対応(理由は [DECISIONS.md](DECISIONS.md) を参照)。
3. Arcade を起動。プロジェクトを追加し、クリック。すぐ使い始められます。

### macOS

1. [Releases](https://github.com/quietforkTsuruta0821/arcade/releases/latest) から `Arcade-vX.Y.Z-universal.dmg` をダウンロード。
2. DMG を開き、**Arcade.app** を `/Applications` にドラッグ。
3. 初回起動は Gatekeeper によりブロックされます。下記コマンドで quarantine 属性を 1 回外してください:

   ```bash
   xattr -d com.apple.quarantine /Applications/Arcade.app
   ```

   その後は通常通り起動できます。

### 動作要件

- **Claude Code** が `PATH` 上にインストール済みであること。Arcade は claude 本体を同梱しません。`claude --version` で確認してください。
- Windows 10/11 (x64) または macOS 10.15+ (Intel / Apple Silicon どちらも可)。

### Linux について

Linux ビルドは v1.0 のスコープ外です。コードベースとしては `wails build -platform linux/amd64` で通りますが、実機検証が完了していません。試したい方はソースからビルドしていただき、Issue で報告いただけると助かります。

## 既存ツールとの比較

|                                       | Arcade | tmux | VS Code Terminal | Warp |
|---------------------------------------|:------:|:----:|:----------------:|:----:|
| マルチペイン スプリット                |   ✓    |  ✓   |    一部対応      |  ✓   |
| プロジェクトカタログ(1 クリック起動)|   ✓    |  —   |    一部対応      |  —   |
| Claude Code 起動を組み込み済           |   ✓    |  —   |    —             |  —   |
| 再起動後にレイアウト復元               |   ✓    | 手動 |    ✓             |  —   |
| ネイティブデスクトップアプリ           |   ✓    |  —   |    ✓             |  ✓   |

## ロードマップ

- **v1.0**: プロジェクトカタログ、tmux 風スプリット、マルチウィンドウ、ファイルエクスプローラ、Markdown リーダー、名前付きレイアウト。*(今回リリース)*
- **v1.x**: Linux ビルド(AppImage)、機密セッション用のスクリーンロック、コマンドパレット、プロジェクト並び替え D&D。
- **その先**: 共有プロジェクトカタログを持つチームモードを検討中。時期は未定。

## ライセンス

MIT。詳細は [LICENSE](LICENSE) を参照。

## コントリビューション

Issue / PR 歓迎です。バグ報告には以下を含めてください:

- OS とバージョン
- Claude Code のバージョン(`claude --version`)
- 再現手順
- 期待した挙動 vs 実際の挙動

Arcade が役に立ったら ⭐ をいただけると嬉しいです。他の Claude Code ユーザーが見つける手がかりになります。

## 謝辞

Arcade は以下の OSS の上に成り立っています:

- [Wails](https://wails.io/) — Go + WebView のデスクトップフレームワーク
- [go-pty](https://github.com/aymanbagabas/go-pty) — クロスプラットフォーム PTY(Windows では ConPTY)
- [xterm.js](https://xtermjs.org/) — ターミナルレンダラ(VS Code でも採用)
- フロントエンドは [React](https://react.dev/) + TypeScript

スプリットレイアウトは tmux を、Activity Bar / Explorer は VS Code をそれぞれモデルにしています。当初はグリッドレイアウト(Apache Superset 風)で始め、途中で tmux 風スプリットツリーに書き直しました。経緯は [DECISIONS.md](DECISIONS.md) に記録しています。
