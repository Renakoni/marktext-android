<p align="center">
  <img src="docs/assets/logo.png" alt="MarkText for Android 標誌" width="96" height="96">
</p>

<h1 align="center">MarkText for Android</h1>

<p align="center">
  <sub>
    🌐&nbsp;
    <a href="README.md">English</a>
    &nbsp;·&nbsp; <a href="README.zh-CN.md">简体中文</a>
    &nbsp;·&nbsp; <b>繁體中文</b>
    &nbsp;·&nbsp; <a href="README.de.md">Deutsch</a>
    &nbsp;·&nbsp; <a href="README.es.md">Español</a>
    &nbsp;·&nbsp; <a href="README.fr.md">Français</a>
    &nbsp;·&nbsp; <a href="README.ja.md">日本語</a>
    &nbsp;·&nbsp; <a href="README.ko.md">한국어</a>
    &nbsp;·&nbsp; <a href="README.pt.md">Português</a>
    &nbsp;·&nbsp; <a href="README.tr.md">Türkçe</a>
  </sub>
</p>

<p align="center">
  <em>安靜、隨心的 Markdown。</em>
</p>

<p align="center">
  <sub>一款精簡的 Android Markdown 編輯器。</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-4c566a?style=flat-square" alt="授權：MIT">
  &nbsp;
  <img src="https://img.shields.io/badge/Android-7.0%2B-4c8492?style=flat-square&logo=android&logoColor=white" alt="Android 7.0+">
  &nbsp;
  <a href="https://github.com/Renakoni/marktext-android/releases/latest"><img src="https://img.shields.io/github/v/release/Renakoni/marktext-android?style=flat-square&color=c98a4b&label=release" alt="最新發行版本"></a>
</p>

<p align="center">
  <a href="#亮點">亮點</a> ·
  <a href="#從原始碼建置">從原始碼建置</a> ·
  <a href="#授權與出處">授權</a>
</p>

<p align="center">
  <img src="docs/screenshots/editor-light.png" alt="以淺色主題編輯 Markdown 文件" width="240">
  &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;
  <img src="docs/screenshots/editor-dark.png" alt="同一份文件的深色主題" width="240">
</p>

<p align="center">
  <sub>☀&nbsp; 淺色 &nbsp;·&nbsp; 深色 &nbsp;☾&nbsp; —— 跟隨您的系統偏好</sub>
</p>

> [!NOTE]
> **非官方社群移植版**——與 MarkText 團隊沒有隸屬關係，未獲其背書，
> 亦非由其維護。本專案以 MarkText 的開源編輯器核心（Muya）為基礎並加以
> 修改，移植至 Android；詳見[授權與出處](#授權與出處)。

## 這是什麼

MarkText for Android 將 MarkText 的即時預覽 Markdown 編輯體驗帶到手機上。
它的編輯器是 Muya——MarkText 的開源核心——並為行動裝置深度改造：
處理大型文件更快、版面依手機寬度重新編排，並加入了觸控選取與工具列。
您寫下的內容以與桌面版相同的精確度算繪，呈現在一個為單手操作而打造的
介面裡。

## 亮點

### 輕量的 Markdown 編輯器，一字不漏

<table width="100%">
<tr>
<td valign="middle">

- 真正的即時預覽（WYSIWYG）編輯。
- 完整支援 CommonMark 與 GitHub Flavored Markdown：數學（KaTeX）、表格、
  註腳、Front Matter、圖表，以及帶語法標示的程式碼。
- 文件大綱與編輯器內建搜尋，即使在長檔案中也保持流暢。
- 匯出為 **PDF**，數學、程式碼標示與字型全部內嵌。
- **絕不遺失您的成果。** 自動儲存、修復草稿與原子式寫入，保留每一次變更。
- **預設即私密。** 無帳號、無雲端、無遙測；一切都留在裝置上。
- **輕量。** Vue + Capacitor 外殼讓整個應用程式僅約 7.8 MB——小巧輕盈，
  功能卻一應俱全。

</td>
<td width="220" valign="top"><img src="docs/screenshots/editor-rich.png" alt="輸入的同時即時算繪表格、程式碼與數學" width="200"></td>
</tr>
</table>

### 打造專屬於您的編輯器

<table width="100%">
<tr>
<td width="220" valign="middle"><img src="docs/screenshots/makeityours.png" alt="編輯時顯示的停靠格式工具列與自訂的選取（貼上）列" width="200"></td>
<td valign="middle">

- **打造您自己的工具列。** 從指令池中組合底部快速列，並以拖曳重新
  排序。就連選取工具列也能放入您自己的指令。

<br>

- **主題與外觀。** 淺色、深色與自訂主題；文字與版面皆可調整。

<br>

- **Markdown 隨您的口味。** 從清單符號到 Front Matter，Markdown 的
  書寫與算繪方式皆可細調。

<br>

- **檔案層級的掌控。** 針對每份文件設定編碼、換行字元與結尾換行的
  處理方式。

</td>
</tr>
</table>

### 為手機而生，為每個人打磨

<table width="100%">
<tr>
<td width="220" valign="top"><img src="docs/screenshots/cjk.png" alt="以中文介面顯示中文文件的編輯器" width="200"></td>
<td valign="middle">

- **您的檔案留在原地。** 透過系統選擇器直接編輯任何儲存空間提供者中的
  `.md` 檔案，並經由分享面板與其他應用程式互傳文件。

<br>

- **為拇指而設計。** 舒適的單手操作範圍與沉靜、以編輯器為先的版面
  配置。

<br>

- **無障礙且克制。** 沉靜的石墨色設計符合 WCAG 2.2 AA，焦點順序清晰，
  動態效果輕而不擾。

<br>

- **十種語言**，依您的系統自動選用：英文、德文、西班牙文、法文、
  日文、韓文、葡萄牙文、土耳其文，以及簡體與繁體中文。

</td>
</tr>
</table>

---

## 專案狀態

> [!IMPORTANT]
> 第一個簽署的公開發行版本 **v0.1.0** 已推出。其 APK 由本儲存庫的發行
> 工作流程建置，鎖定官方發行憑證，並已在 Android 14 上通過全新安裝與
> 同金鑰升級檢查。

請從 [Releases](https://github.com/Renakoni/marktext-android/releases/latest)
頁面下載已簽署的建置版本。

## 從原始碼建置

您需要 [Node.js](https://nodejs.org/) 與 [pnpm](https://pnpm.io/)，
以及 [Android Studio](https://developer.android.com/studio)（Android SDK
與 JDK；應用程式可在 API 24 及更新的系統上執行，並以 API 36 建置）。

```sh
pnpm install          # 安裝相依套件
pnpm dev              # 在瀏覽器中預覽網頁外殼
pnpm android:sync     # 建置網頁應用程式並同步至 Android 專案
pnpm android:open     # 在 Android Studio 中開啟，然後在裝置或模擬器上執行
```

其他指令碼（`test`、`lint`、`typecheck`、`build`）列於 `package.json`。
發行維護者請依循 [`docs/RELEASING.md`](docs/RELEASING.md)。

> [!TIP]
> Markdown 編輯器核心是 `@muyajs/core`（Muya）的一份隨附且**經過修改**的
> 副本，位於 `third_party/muya`。若您變更了它，請在建置前將修改同步至
> `node_modules/@muyajs/core/src/**`——有契約測試會攔截兩者的落差。

## 參與貢獻

歡迎回報問題與提交 Pull Request。每次變更只做一件事，並在合適的地方
補上測試。

## 授權與出處

MarkText for Android 以 [MIT License](LICENSE) 發行。

本專案是**非官方**移植版，建立在 MarkText 的開源成果之上，與 MarkText
專案沒有隸屬關係，也未獲其背書：

- **MarkText**——本移植版所依循的桌面編輯器與設計。Copyright © Luo
  Ran 與 MarkText 貢獻者，以 MIT 授權。
- **Muya**（`@muyajs/core`）——編輯器核心，以隨附且經過修改的形式置於
  `third_party/muya`，並保留其原始 MIT 授權
  （[`third_party/muya/LICENSE`](third_party/muya/LICENSE)）。

## 致謝

MarkText for Android 立足於大量開源成果：[MarkText](https://github.com/marktext/marktext)
編輯器及其[貢獻者](https://github.com/marktext/marktext/graphs/contributors)、
[Muya](https://github.com/marktext/muya) 編輯引擎，以及
[Vue](https://vuejs.org/)、[Vite](https://vite.dev/) 與
[Capacitor](https://capacitorjs.com/)。感謝打造這一切的每一位。

---

<p align="center"><sub><em>安靜、隨心的 Markdown。</em></sub></p>
