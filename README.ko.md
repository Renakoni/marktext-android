<p align="center">
  <img src="docs/assets/logo.png" alt="MarkText for Android 로고" width="96" height="96">
</p>

<h1 align="center">MarkText for Android</h1>

<p align="center">
  <sub>
    🌐&nbsp;
    <a href="README.md">English</a>
    &nbsp;·&nbsp; <a href="README.zh-CN.md">简体中文</a>
    &nbsp;·&nbsp; <a href="README.zh-TW.md">繁體中文</a>
    &nbsp;·&nbsp; <a href="README.de.md">Deutsch</a>
    &nbsp;·&nbsp; <a href="README.es.md">Español</a>
    &nbsp;·&nbsp; <a href="README.fr.md">Français</a>
    &nbsp;·&nbsp; <a href="README.ja.md">日本語</a>
    &nbsp;·&nbsp; <b>한국어</b>
    &nbsp;·&nbsp; <a href="README.pt.md">Português</a>
    &nbsp;·&nbsp; <a href="README.tr.md">Türkçe</a>
  </sub>
</p>

<p align="center">
  <em>조용히, 나만의 Markdown.</em>
</p>

<p align="center">
  <sub>Android를 위한 군더더기 없는 Markdown 편집기.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-4c566a?style=flat-square" alt="라이선스: MIT">
  &nbsp;
  <img src="https://img.shields.io/badge/Android-7.0%2B-4c8492?style=flat-square&logo=android&logoColor=white" alt="Android 7.0+">
  &nbsp;
  <a href="https://github.com/Renakoni/marktext-android/releases/latest"><img src="https://img.shields.io/github/v/release/Renakoni/marktext-android?style=flat-square&color=c98a4b&label=release" alt="최신 릴리스"></a>
</p>

<p align="center">
  <a href="#주요-기능">주요 기능</a> ·
  <a href="#소스에서-빌드하기">소스에서 빌드하기</a> ·
  <a href="#라이선스-및-저작자-표시">라이선스</a>
</p>

<p align="center">
  <img src="docs/screenshots/editor-light.png" alt="Markdown 문서 편집 — 라이트 테마" width="240">
  &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;
  <img src="docs/screenshots/editor-dark.png" alt="다크 테마로 본 같은 문서" width="240">
</p>

<p align="center">
  <sub>☀&nbsp; 라이트 &nbsp;·&nbsp; 다크 &nbsp;☾&nbsp; — 시스템 설정을 그대로 따릅니다</sub>
</p>

> [!NOTE]
> **비공식 커뮤니티 포트** — MarkText 팀과 관련이 없으며, 팀의 승인이나 유지
> 관리를 받지 않습니다. MarkText의 오픈 소스 편집기 코어(Muya)를 기반으로
> Android에 맞게 수정했습니다. [라이선스 및 저작자 표시](#라이선스-및-저작자-표시)를
> 참고하세요.

## 소개

MarkText for Android는 MarkText의 실시간 미리 보기 Markdown 편집을 폰으로
가져옵니다. 편집기는 MarkText의 오픈 소스 코어인 Muya로, 모바일에 맞게 크게
손질했습니다. 큰 문서에서 더 빠르게 동작하고, 폰 화면 너비에 맞춰 다시
배치했으며, 터치 선택과 도구 모음을 더했습니다. 작성한 내용은 데스크톱과 같은
품질로 렌더링되며, 이 모든 것이 한 손을 위해 설계된 인터페이스 안에서
이루어집니다.

## 주요 기능

### 한 글자도 잃지 않는 가벼운 Markdown 편집기

<table width="100%">
<tr>
<td valign="middle">

- 진짜 실시간 미리 보기(WYSIWYG) 편집.
- CommonMark와 GitHub Flavored Markdown 완전 지원: 수식(KaTeX), 표, 각주,
  front matter, 다이어그램, 구문 강조 코드까지.
- 긴 파일에서도 부드럽게 동작하는 문서 개요와 편집기 내 검색.
- 수식, 코드 강조, 글꼴까지 모두 담아 **PDF**로 내보내기.
- **작업을 절대 잃지 않습니다.** 자동 저장, 복구 초안, 원자적 쓰기가 모든
  변경 사항을 지킵니다.
- **기본이 프라이버시.** 계정도, 클라우드도, 원격 측정도 없습니다. 모든 것이
  기기 안에 머뭅니다.
- **가볍습니다.** Vue + Capacitor 셸을 사용해 앱 전체가 약 7.8 MB — 작고
  가볍지만 기능은 온전합니다.

</td>
<td width="220" valign="top"><img src="docs/screenshots/editor-rich.png" alt="입력하는 동안 실시간으로 렌더링되는 표, 코드, 수식" width="200"></td>
</tr>
</table>

### 나만의 편집기로

<table width="100%">
<tr>
<td width="220" valign="middle"><img src="docs/screenshots/makeityours.png" alt="편집 중 표시되는 하단 고정 서식 도구 모음과 사용자 정의 선택(붙여넣기) 막대" width="200"></td>
<td valign="middle">

- **나만의 도구 모음 만들기.** 명령 풀에서 하단 빠른 도구 막대를 구성하고
  드래그로 순서를 바꿉니다. 선택 도구 모음에도 원하는 명령을 담을 수 있습니다.

<br>

- **테마와 외관.** 라이트, 다크, 사용자 정의 테마를 고르고, 글자와 레이아웃을
  조정할 수 있습니다.

<br>

- **취향대로 쓰는 Markdown.** 목록 기호부터 front matter까지, Markdown이
  쓰이고 렌더링되는 방식을 세밀하게 조정할 수 있습니다.

<br>

- **파일 단위 제어.** 문서별 인코딩, 줄 끝, 끝 줄바꿈 처리.

</td>
</tr>
</table>

### 폰을 위해 만들고, 모두를 위해 다듬었습니다

<table width="100%">
<tr>
<td width="220" valign="top"><img src="docs/screenshots/cjk.png" alt="중국어 인터페이스로 중국어 문서를 표시한 편집기" width="200"></td>
<td valign="middle">

- **파일은 제자리에 그대로.** 시스템 선택기를 통해 어떤 저장소 제공자에서든
  `.md`를 바로 편집하고, 공유 시트로 다른 앱과 문서를 주고받습니다.

<br>

- **엄지를 위한 설계.** 한 손으로 편안하게 닿는 배치와 차분한 편집기 중심
  레이아웃.

<br>

- **접근성 있게, 절제되게.** WCAG 2.2 AA를 충족하는 조용한 그래파이트 디자인,
  뚜렷한 포커스 순서, 그리고 차분하고 절제된 모션.

<br>

- **열 가지 언어**를 시스템 설정에 따라 자동으로 선택합니다: 영어, 독일어,
  스페인어, 프랑스어, 일본어, 한국어, 포르투갈어, 터키어, 그리고 중국어 간체와
  번체.

</td>
</tr>
</table>

---

## 프로젝트 현황

> [!IMPORTANT]
> 처음으로 서명된 공개 릴리스 **v0.1.0**을 사용할 수 있습니다. APK는 저장소의
> 릴리스 워크플로로 빌드되고 공식 릴리스 인증서에 고정되며, Android 14에서 클린
> 설치와 동일 키 업그레이드 검사를 통과했습니다.

서명된 빌드는
[Releases](https://github.com/Renakoni/marktext-android/releases/latest)
페이지에서 내려받으세요.

## 소스에서 빌드하기

[Node.js](https://nodejs.org/)와 [pnpm](https://pnpm.io/), 그리고
[Android Studio](https://developer.android.com/studio)(Android SDK와 JDK)가
필요합니다. 앱은 API 24 이상에서 실행되며, API 36을 기준으로 빌드됩니다.

```sh
pnpm install          # 의존성 설치
pnpm dev              # 브라우저에서 웹 셸 미리 보기
pnpm android:sync     # 웹 앱을 빌드해 Android 프로젝트로 동기화
pnpm android:open     # Android Studio로 열고 기기 또는 에뮬레이터에서 실행
```

다른 스크립트(`test`, `lint`, `typecheck`, `build`)는 `package.json`에
있습니다. 릴리스 관리자는 [`docs/RELEASING.md`](docs/RELEASING.md)를 따르세요.

> [!TIP]
> Markdown 편집기 코어는 `third_party/muya` 아래에 벤더링된, **수정된**
> `@muyajs/core`(Muya) 사본입니다. 이를 변경했다면 빌드 전에 수정 사항을
> `node_modules/@muyajs/core/src/**`로 동기화하세요 — 계약 테스트가 어긋남을
> 잡아냅니다.

## 기여하기

이슈와 풀 리퀘스트를 환영합니다. 변경 사항은 한 가지에 집중하고, 필요한
곳에는 테스트도 함께 추가해 주세요.

## 라이선스 및 저작자 표시

MarkText for Android는 [MIT 라이선스](LICENSE)로 배포됩니다.

이 앱은 MarkText의 오픈 소스 작업 위에 만들어진 **비공식** 포트로, MarkText
프로젝트와 관련이 없으며 승인을 받지 않았습니다:

- **MarkText** — 이 포트가 따르는 데스크톱 편집기이자 디자인. Copyright © Luo
  Ran 및 MarkText 기여자, MIT 라이선스.
- **Muya** (`@muyajs/core`) — 편집기 코어. `third_party/muya` 아래에 벤더링해
  수정했으며, 원본 MIT 라이선스를 유지합니다
  ([`third_party/muya/LICENSE`](third_party/muya/LICENSE)).

## 감사의 말

MarkText for Android는 수많은 오픈 소스 작업 위에 서 있습니다:
[MarkText](https://github.com/marktext/marktext) 편집기와 그
[기여자들](https://github.com/marktext/marktext/graphs/contributors),
[Muya](https://github.com/marktext/muya) 편집 엔진, 그리고
[Vue](https://vuejs.org/), [Vite](https://vite.dev/),
[Capacitor](https://capacitorjs.com/). 이 모든 것을 만들어 주신 분들께
감사드립니다.

---

<p align="center"><sub><em>조용히, 나만의 Markdown.</em></sub></p>
