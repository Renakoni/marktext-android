<p align="center">
  <img src="../assets/logo.webp" alt="MarkText for Android のロゴ" width="96" height="96">
</p>

<h1 align="center">MarkText for Android</h1>

<p align="center">
  <sub>
    🌐&nbsp;
    <a href="../../README.md">English</a>
    &nbsp;·&nbsp; <a href="README.zh-CN.md">简体中文</a>
    &nbsp;·&nbsp; <a href="README.zh-TW.md">繁體中文</a>
    &nbsp;·&nbsp; <a href="README.de.md">Deutsch</a>
    &nbsp;·&nbsp; <a href="README.es.md">Español</a>
    &nbsp;·&nbsp; <a href="README.fr.md">Français</a>
    &nbsp;·&nbsp; <b>日本語</b>
    &nbsp;·&nbsp; <a href="README.ko.md">한국어</a>
    &nbsp;·&nbsp; <a href="README.pt.md">Português</a>
    &nbsp;·&nbsp; <a href="README.tr.md">Türkçe</a>
  </sub>
</p>

<p align="center">
  <em>静かに寄り添う、あなたの Markdown。</em>
</p>

<p align="center">
  <sub>Android のための、無駄のない Markdown エディター。</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-4c566a?style=flat-square" alt="ライセンス: MIT">
  &nbsp;
  <img src="https://img.shields.io/badge/Android-7.0%2B-4c8492?style=flat-square&logo=android&logoColor=white" alt="Android 7.0+">
  &nbsp;
  <a href="https://github.com/Renakoni/marktext-android/releases/latest"><img src="https://img.shields.io/github/v/release/Renakoni/marktext-android?style=flat-square&color=c98a4b&label=release" alt="最新リリース"></a>
</p>

<p align="center">
  <a href="#ハイライト">ハイライト</a> ·
  <a href="#ソースからのビルド">ソースからのビルド</a> ·
  <a href="#ライセンスと帰属表示">ライセンス</a>
</p>

<p align="center">
  <img src="../screenshots/editor-light.webp" alt="Markdown ドキュメントを編集中 — ライトテーマ" width="240">
  &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;
  <img src="../screenshots/editor-dark.webp" alt="同じドキュメントをダークテーマで表示" width="240">
</p>

<p align="center">
  <sub>☀&nbsp; ライト &nbsp;·&nbsp; ダーク &nbsp;☾&nbsp; — システムの設定に合わせて</sub>
</p>

> [!NOTE]
> **非公式のコミュニティ移植版**です — MarkText チームとの提携はなく、その承認や
> 保守も受けていません。MarkText のオープンソースエディターコア（Muya）を Android
> 向けに改変して構築しています。詳しくは[ライセンスと帰属表示](#ライセンスと帰属表示)をご覧ください。

## 概要

MarkText for Android は、MarkText のライブプレビュー型 Markdown 編集を
スマートフォンに持ち込みます。エディターの中核は
MarkText のオープンソースコアである Muya で、モバイル向けに大きく手を加えています。
大きなドキュメントでも高速に動作し、スマートフォンの画面幅に合わせてレイアウトを
組み直し、タッチ選択とツールバーを備えました。書いた内容は
デスクトップと同じ忠実さでレンダリングされ、片手で扱えるインターフェイスに収まって
います。

## ハイライト

### 一語も失わない、軽量な Markdown エディター

<table width="100%">
<tr>
<td valign="middle">

- 本物のライブプレビュー（WYSIWYG）編集。

- CommonMark と GitHub Flavored Markdown を完全サポート: 数式（KaTeX）、表、脚注、
  フロントマター、図表、シンタックスハイライト付きコード。

- 長いファイルでも滑らかに動き続けるドキュメントアウトラインとエディター内検索。

- 数式、コードハイライト、フォントをすべて埋め込んだ **PDF** エクスポート。

- **作業内容を決して失いません。** 自動保存、復元用下書き、アトミックな
  書き込みがすべての変更を保持します。

- **デフォルトでプライベート。** アカウント不要、クラウドなし、テレメトリーなし。
  すべては端末の中にとどまります。

- **軽量。** Vue + Capacitor シェルにより、アプリ全体は約 7.8 MB — 小さく軽く、
  それでいてフル機能です。

</td>
<td width="220" valign="top"><img src="../screenshots/editor-rich.webp" alt="入力しながら表・コード・数式がライブでレンダリングされる様子" width="200"></td>
</tr>
</table>

### 自分好みに仕立てる

<table width="100%">
<tr>
<td width="220" valign="middle"><img src="../screenshots/makeityours.webp" alt="編集中に表示された下部固定の書式ツールバーと、カスタマイズした選択（貼り付け）バー" width="200"></td>
<td valign="middle">

- **ツールバーを自作できます。** 下部のクイックバーはコマンド一覧から組み立て、
  ドラッグで並べ替えられます。選択ツールバーにも独自のコマンドを配置できます。

<br>

- **テーマと外観。** ライト、ダークに加えて 30 種類以上のカスタムテーマ。文字とレイアウトも調整
  できます。

<br>

- **Markdown も好みのままに。** リストマーカーからフロントマターまで、Markdown の
  書き方とレンダリングを細かく調整できます。

<br>

- **ファイル単位の制御。** ドキュメントごとのエンコーディング、改行コード、
  末尾の改行の扱い。

</td>
</tr>
</table>

### スマートフォンのために作り、すべての人のために磨き上げた

<table width="100%">
<tr>
<td width="220" valign="top"><img src="../screenshots/cjk.webp" alt="中国語インターフェイスで中国語ドキュメントを表示するエディター" width="200"></td>
<td valign="middle">

- **ファイルは元の場所のまま。** システムピッカーを通じて任意のストレージ
  プロバイダーの `.md` を直接編集でき、共有シートで他のアプリとドキュメントを
  やり取りできます。

<br>

- **親指のための設計。** 片手で無理なく届き、エディターを主役にした落ち着いた
  レイアウト。

<br>

- **アクセシブルで、控えめ。** WCAG 2.2 AA を満たす静かなグラファイトデザイン。
  フォーカス順序は明快で、動きも静かで控えめです。

<br>

- **10 言語**をシステム設定から自動で選択: 英語、ドイツ語、スペイン語、
  フランス語、日本語、韓国語、ポルトガル語、トルコ語、そして簡体字中国語と
  繁体字中国語。

</td>
</tr>
</table>

---

## プロジェクトの現状

> [!IMPORTANT]
> 署名付き公開リリースを提供しています。各リリース APK はリポジトリの
> リリースワークフローでビルドされ、公式のリリース証明書に固定されており、
> 公開前にクリーンインストールと同一鍵でのアップグレード検証に合格しています。

署名付きビルドは
[Releases](https://github.com/Renakoni/marktext-android/releases/latest) ページから
ダウンロードできます。

## ソースからのビルド

[Node.js](https://nodejs.org/) と [pnpm](https://pnpm.io/)、そして
[Android Studio](https://developer.android.com/studio)（Android SDK と JDK。
アプリは API 24 以降で動作し、API 36 を対象にビルドされています）が必要です。

```sh
pnpm install          # 依存関係をインストール
pnpm dev              # ブラウザーで Web シェルをプレビュー
pnpm android:sync     # Web アプリをビルドして Android プロジェクトに同期
pnpm android:open     # Android Studio で開き、端末またはエミュレーターで実行
```

その他のスクリプト（`test`、`lint`、`typecheck`、`build`）は `package.json` に
あります。リリース担当者は [`docs/RELEASING.md`](../RELEASING.md) に従って
ください。

> [!TIP]
> Markdown エディターのコアは、`third_party/muya` に取り込んだ `@muyajs/core`
> （Muya）の**改変済み**コピーです。ここを変更した場合は、ビルド前に編集内容を
> `node_modules/@muyajs/core/src/**` へ同期してください — ずれはコントラクト
> テストが検出します。

## コントリビュート

Issue と Pull Request を歓迎します。変更は一つひとつ焦点を絞り、必要に応じて
テストも追加してください。

## ライセンスと帰属表示

MarkText for Android は [MIT ライセンス](../../LICENSE)の下で公開されています。

本アプリは MarkText のオープンソースの成果の上に構築された**非公式**の移植版で
あり、MarkText プロジェクトとの提携やその承認はありません:

- **MarkText** — この移植版が手本とするデスクトップエディターとデザイン。
  Copyright © Luo Ran および MarkText コントリビューター、MIT ライセンス。
- **Muya**（`@muyajs/core`）— エディターコア。元の MIT ライセンスを保持したまま
  `third_party/muya` に取り込み、改変しています
  （[`third_party/muya/LICENSE`](../../third_party/muya/LICENSE)）。

## 謝辞

MarkText for Android は数多くのオープンソースの成果の上に成り立っています:
[MarkText](https://github.com/marktext/marktext) エディターとその
[コントリビューター](https://github.com/marktext/marktext/graphs/contributors)、
編集エンジンの [Muya](https://github.com/marktext/muya)、そして
[Vue](https://vuejs.org/)、[Vite](https://vite.dev/)、
[Capacitor](https://capacitorjs.com/)。これらを築いたすべての方々に感謝します。

---

<p align="center"><sub><em>静かに寄り添う、あなたの Markdown。</em></sub></p>
