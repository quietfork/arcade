---
title: "Wails + go-pty で Claude Code 向けマルチペインランチャを作った話"
emoji: "🏛"
type: "tech"
topics: ["claudecode", "go", "wails", "typescript", "oss"]
published: false
---

<!-- HERO_IMAGE: 4 ペインで claude が並列実行されているスクショ。1600x900 PNG。 -->

毎日 5〜6 個のプロジェクトで Claude Code を回している。トレーディングボットのリポ、CAD プラグイン、自作フレームワーク、Markdown のノート、それと Anthropic が出したばかりで触ってみたいやつ。1 週間で完全に指が覚えた:

```bash
cd ~/dev/<project> && claude --dangeressly-skip-permissions  # 1 回おきにタイポ
```

tmux は試した。VS Code のターミナルも試した。Windows Terminal で 4 タブ並べたりもした。どれも 1 つの欲しい体験には届かなかった。それは「**左にプロジェクト一覧、右に走っている Claude セッションのグリッド、1 クリックで切り替え**」というシンプルな絵。

なので作った。[Arcade](https://github.com/quietforkTsuruta0821/arcade) — Claude Code のためのデスクトップランチャー。MIT、Windows + macOS で動く、バイナリは約 25 MB。

この記事は技術側の話。なぜ Wails を選んだか、開発の途中で 3 回大きく書き直した話、それから「TUI を仮想 PTY 越しに動かす」というだけのことが想像より厄介だった部分を共有する。

<!-- SCREENSHOT_1: 4 ペイン稼働中のヒーローショット — キャプション: 4 つのプロジェクト、4 つの Claude セッション、1 つのウィンドウ -->

## なぜデスクトップアプリか

正直に言うと、ローカルの PTY に触れる必要があって、かつ surface area を増やしたくなかったから。他の選択肢はこんな形:

- **Web アプリ + ブラウザサンドボックス内 PTY**: レイテンシが厳しい上にセキュリティモデルが破綻気味。xterm.js はブラウザでも動くが、ローカルプロセスと喋るバックエンドが必要で、結局それは常駐デーモンになる。1 バイナリで完結させたかった。
- **Electron**: 過去にリリース経験あり。動作は問題ないが、バイナリ 150 MB 下限、コールドスタート 2〜3 秒は、毎日何回も起動するツールには重すぎる。
- **Native Win32 / AppKit**: 自分はバックエンドエンジニアで Go で食ってる。Cocoa の学習コストは値段に見合わない。

残ったのが **Wails**(Go バックエンド + システム WebView)と **Tauri**(Rust バックエンド + システム WebView)。Wails を選んだ理由:

1. Go の PTY ライブラリが成熟している。`go-pty` は Windows ConPTY と POSIX PTY を同じ API で扱える。
2. 過去に Wails アプリを 1 本リリースした経験があった。これは大きい。
3. Wails v2 は Go 構造体から TypeScript の型を自動生成してくれる。フロントから typed なバックエンド API が使える。

Tauri でも問題なく作れたはず。Rust の PTY 周りもしっかりしている。ゼロから始めるなら、自分のスタックに馴染む方を選べばいい。

## スタックの全体像

| レイヤ | 採用 | 理由 |
|---|---|---|
| シェル | Wails v2.12 (Go 1.23) | 単一バイナリ、システム WebView、TypeScript バインディング自動生成 |
| PTY | [`github.com/aymanbagabas/go-pty`](https://github.com/aymanbagabas/go-pty) | ConPTY + POSIX を 1 API で |
| フロント | React 18 + TypeScript | Wails 標準テンプレ、入り口が低い |
| ターミナル描画 | [`@xterm/xterm`](https://xtermjs.org/) v6 + `@xterm/addon-fit` | VS Code と同じレンダラ |
| レイアウト | 自前の split-tree 実装 | 後述。react-grid-layout で始めて削除した |
| 永続化 | `~/.arcade/` 配下の JSON ファイル | 手で編集できる、バックアップ容易、マイグレーションは version フィールドだけ |
| マルチウィンドウ | slot 方式 + fsnotify | 後述。single-writer + 他は監視 |

執筆時点でコードは **Go 約 8k 行、TypeScript 約 5k 行**。

## 3 回大きく書き直した話

### 1. react-grid-layout で始めたが、外した

要件定義段階で「Apache Superset 風グリッドレイアウト(12 カラム制)」を想定していた。素直に [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) に手を伸ばした。Superset 自体がこれを使っているので、最短経路で動くものが組めるはず、と踏んだ。

2 日で「これでは ship できない」と思った。技術的な問題ではない。react-grid-layout の出来は良い。問題は UX の方:

1. **グリッドのスナップが、ターミナル配置の感覚と合わない。** ペインを分割するとき自分は「半分半分」と思っている。「8 カラムと 4 カラム」とは思っていない。3:5 にしたいなら... 7 カラムと 5 カラム? でも分割線が思った位置に来ない... という算数が常時付きまとう。
2. **空セルが見栄え悪い。** ダッシュボードならグリッド間の隙間は「空白」として正解だが、ターミナルだと「無駄な領域」になる。
3. **ドラッグ操作が xterm と干渉する。** react-grid-layout はセル移動のためにドラッグイベントを食う。xterm は選択のためにマウスイベントを欲しがる。修正は 3 階層越しのイベント伝播で、明らかに筋が悪かった。

割り切ってレイアウトエンジンを再帰的なスプリットツリーとして書き直した。各ノードは leaf(端末 1 つ)か split(縦横方向と比率を持つ)のどちらか:

```typescript
type Leaf = { kind: 'leaf'; paneId: string };
type Split = {
  kind: 'split';
  dir: 'h' | 'v';
  ratio: number;       // 0..1
  a: Tree;             // 左 or 上の子
  b: Tree;             // 右 or 下の子
};
type Tree = Leaf | Split;
```

分割は `Leaf → Split(dir, 0.5, Leaf(self), Leaf(new))` 1 行。閉じるとスプリットが畳まれる。リサイズは ratio を変える。

レンダリングも再帰: ツリーを歩いて bounding box を積算して、leaf を絶対位置でレンダリング。react-grid-layout の仮想 DOM フレンドリな方式より遅くなると予想したが、実際にはノード数が 20 を超えないので逆に速い。再描画も、bounding box が変わった leaf だけが React の更新対象になる。

書き換え総量は約 300 行(divider ドラッグハンドラ含む)。

<!-- CODE: splitTree.ts の splitLeaf / closeLeaf 関数を貼る -->

もう一度ゼロから作るなら、最初からグリッドを選ばない。ターミナル UI は「自由なスプリット」のほうが性に合う。

### 2. マルチウィンドウは見た目より厄介だった

Wails v2 には恥ずかしいほど長く気づかなかった制約がある。**1 Wails プロセスは 1 ウィンドウしか持てない**。2 つ目のウィンドウが欲しければ、2 つ目のプロセスを起動するしかない。

ランチャーが常時 1 ウィンドウなら、これでも問題ない。だがプロジェクトカタログと名前付きレイアウト、永続的な状態を持ち始めると、マルチウィンドウが欲しくなる。VS Code がそうであるように、Sublime Text がそうであるように。そしてもちろん、2 つのウィンドウが状態を共有していてほしい。ウィンドウ A でプロジェクトを登録したら、ウィンドウ B に即座に反映されてほしい。

直球の方法はどれも惜しい:

- **共有 SQLite**: 動くが、依存が増えるし、結局書き込みロックを相手にすることになる。
- **組み込みメッセージバス**: 結局デーモンが生える。回避したかったやつ。
- **ポーリング**: 醜いし遅い。

最終的に採用したのは **single-writer + fsnotify** パターン。VS Code の main プロセス設計を参考にしつつ、Wails の制約に合わせて変形したもの:

1. 各プロセスに **slot ID**(`main`、`slot-2` など)を振る。
2. **main slot** だけが `~/.arcade/*.json` に書き込める。他の slot は read-only。
3. 全プロセスが [`fsnotify`](https://github.com/fsnotify/fsnotify) でデータディレクトリを監視。ファイルが変わったら状態を再読込し、Wails イベントでフロントに通知 → 再レンダリング。
4. main slot のプロセスが消えた(クラッシュ・kill)場合、次に起動した slot が **ロックファイルを取って自己昇格** する。

ロックファイル周りが面白い。OS ネイティブの排他ロック(Windows `LockFileEx`、POSIX `flock`)を使っているので、プロセス終了時に OS が自動的に解放する。stale-lock のクリーンアップを書く必要がない。実装は `lock.go` に約 80 行。

```go
// 簡略化版
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

データファイルは数キロバイト単位で、書き込みは稀(プロジェクト追加、レイアウト保存、設定変更)。fsnotify は数十ミリ秒でイベントを配る。結果としてウィンドウ間が直接喋り合っているような体験になる。実体はファイルシステム経由の eventual consistency。

「エレガント」とは言わない。これは Wails の制約への workaround だ。だが ship でき、debug 可能(JSON を cat できる)、failure mode が明快、という性質がある。

<!-- CODE: watcher.go の fsnotify イベントハンドラ部分 -->

### 3. ペインのリサイズが TUI と喧嘩する

Claude Code は TUI アプリ。ターミナルをリサイズしたら、PTY に新しい寸法を伝えて、子プロセスに `SIGWINCH` が飛び、TUI が再描画する。

最初の数日はこれを意識していなかった。xterm の `fit-addon` と go-pty の `Resize` で「動いている」ように見えていた。ディバイダーをドラッグし始めて初めて、claude の UI がフレーム毎に再描画されてチラついていることに気づいた。

修正は単純に「**resize 呼び出しをデバウンスする**」だけ。ドラッグ中は 100ms に 1 回まで `Resize` を投げ、ドラッグ終了の 100ms 後に最後の `Resize` を投げる。

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

時間がかかったのはもう一段先。divider をドラッグしたとき、隣接していないペインのピクセルサイズは変わらないのに、ResizeObserver が transform / layout 変化で発火していた。同じ寸法で `SIGWINCH` を送り直して TUI が無駄再描画していた。重複排除(`cols === lastCols && rows === lastRows` ならスキップ)を入れたらチラつきが 60% 消えた。

もう 1 つの教訓: 最初は単一の ResizeObserver で全ペインを観測していたが、これを各 Terminal 内に分離した。1 ペインの変化を全ペインが受け取って判定するのは明らかに筋が悪かった。後から見ると当たり前なのに、最初は気づかなかった。

## やってよかったこと

**全部 `~/.arcade/` に JSON で置いた。** DB なし、マイグレーションフレームワークなし、初期化処理なし。アトミック書き込みは temp + rename で済む。壊れたら `cat` できる。ユーザーも `cat` できる。手で覗ける状態には誠実さがある。

**起動コマンドをプロジェクト単位で上書き可能にした。** デフォルトは `claude --dangerously-skip-permissions` だが、ユーザーが変えられる。30 分でできた機能だが、セキュリティを厳しめにしたいユーザーまで取り込める。

**危険フラグの consent ダイアログを作った。** 初回起動で `--dangerously-skip-permissions` が何をするか説明し、明示的に同意を取る。設定に保存。1 回だけの摩擦と引き換えに安全を担保する。

**`claude` 実行ファイルは絶対パスで解決した。** `exec.LookPath` でセッション開始時に解決する。子プロセスの PATH は親と一致するとは限らない(特に Windows)。「command not found」と「claude が落ちた」は区別したい。

## 次にやり直すなら変えたい点

- **グリッド試作を最初からスキップする。** 1 時間で「合わない」と直感したのに、書き換えに 4 日目までかかった。2 日目に switch すべきだった。
- **fsnotify を早く採用する。** in-process な pub/sub から始めたが、マルチウィンドウ対応には間に合わなかった。最初の試行が fsnotify でよかった。
- **実機 macOS で早めに動かす。** Win 中心で v1 をほぼ書ききって、macOS で初めて起動したら 6 個ほどの path / シグナル差分にあたった。修正は小さい。驚きが余計だっただけ。

## 結び

Arcade は自分が個人的に必要なところまでは完成している。ロードマップ(Linux ビルド、screen lock、コマンドパレット)はあえて短くしてある。「完璧に近づき続ける大きいツール」より「終わっている小さなツール」を持っていたい。

複数プロジェクトで Claude Code を使っているなら、ぜひ触ってみてほしい。そうでなくても、Wails + PTY + マルチウィンドウ + 独自レイアウトエンジン、というスタックの参考事例として読んでもらえれば嬉しい。

- **リポジトリ**: [github.com/quietforkTsuruta0821/arcade](https://github.com/quietforkTsuruta0821/arcade)
- **ライセンス**: MIT
- **バイナリ**: Windows + macOS Universal(Releases ページ)

⭐ をつけてもらえるとモチベが上がる。バグ報告はもっと嬉しい。PR は一番嬉しい。

<!-- SCREENSHOT_FINAL: プロジェクト追加ダイアログ — キャプション: 1 クリックでプロジェクト追加 -->

---

*謝辞: [Wails](https://wails.io/) メンテナの v2 リリースの安定感に感謝。クロスプラットフォーム PTY を当たり前にしてくれた [go-pty](https://github.com/aymanbagabas/go-pty)、業界標準ターミナルレンダラの [xterm.js](https://xtermjs.org/) にも。Apache Superset チームには「グリッドダッシュボード」というメンタルモデルを思い出させてくれたことに感謝。結果的にグリッドは捨てたが、UI 全体の設計指針はそこから出ている。*
