<p align="center">
  <img src="docs/assets/logo.png" alt="Logo von MarkText for Android" width="96" height="96">
</p>

<h1 align="center">MarkText for Android</h1>

<p align="center">
  <sub>
    🌐&nbsp;
    <a href="README.md">English</a>
    &nbsp;·&nbsp; <a href="README.zh-CN.md">简体中文</a>
    &nbsp;·&nbsp; <a href="README.zh-TW.md">繁體中文</a>
    &nbsp;·&nbsp; <b>Deutsch</b>
    &nbsp;·&nbsp; <a href="README.es.md">Español</a>
    &nbsp;·&nbsp; <a href="README.fr.md">Français</a>
    &nbsp;·&nbsp; <a href="README.ja.md">日本語</a>
    &nbsp;·&nbsp; <a href="README.ko.md">한국어</a>
    &nbsp;·&nbsp; <a href="README.pt.md">Português</a>
    &nbsp;·&nbsp; <a href="README.tr.md">Türkçe</a>
  </sub>
</p>

<p align="center">
  <em>Markdown, ganz leise, ganz deins.</em>
</p>

<p align="center">
  <sub>Ein schlanker Markdown-Editor für Android.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-4c566a?style=flat-square" alt="Lizenz: MIT">
  &nbsp;
  <img src="https://img.shields.io/badge/Android-7.0%2B-4c8492?style=flat-square&logo=android&logoColor=white" alt="Android 7.0+">
  &nbsp;
  <a href="https://github.com/Renakoni/marktext-android/releases/latest"><img src="https://img.shields.io/github/v/release/Renakoni/marktext-android?style=flat-square&color=c98a4b&label=release" alt="Neuestes Release"></a>
</p>

<p align="center">
  <a href="#highlights">Highlights</a> ·
  <a href="#aus-dem-quellcode-bauen">Aus dem Quellcode bauen</a> ·
  <a href="#lizenz--namensnennung">Lizenz</a>
</p>

<p align="center">
  <img src="docs/screenshots/editor-light.png" alt="Bearbeitung eines Markdown-Dokuments – helles Design" width="240">
  &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;
  <img src="docs/screenshots/editor-dark.png" alt="Dasselbe Dokument in einem dunklen Design" width="240">
</p>

<p align="center">
  <sub>☀&nbsp; Hell &nbsp;·&nbsp; Dunkel &nbsp;☾&nbsp; – je nachdem, was dein System bevorzugt</sub>
</p>

> [!NOTE]
> **Inoffizieller Community-Port** – weder mit dem MarkText-Team verbunden noch
> von ihm unterstützt oder gepflegt. Er baut auf MarkTexts quelloffenem
> Editor-Kern (Muya) auf und passt ihn für Android an; siehe
> [Lizenz & Namensnennung](#lizenz--namensnennung).

## Was es ist

MarkText for Android bringt MarkTexts Markdown-Bearbeitung mit Live-Vorschau
aufs Handy. Der Editor ist Muya, MarkTexts quelloffener Kern, tiefgreifend für
Mobilgeräte angepasst: schneller bei großen Dokumenten, neu umbrochen für die
Breite eines Handys und ergänzt um Touch-Auswahl und Symbolleisten. Was du
schreibst, wird mit derselben Treue gerendert wie auf dem Desktop – in einer
Oberfläche, die für eine Hand gebaut ist.

## Highlights

### Ein leichter Markdown-Editor, der nie ein Wort verliert

<table width="100%">
<tr>
<td valign="middle">

- Echte Live-Vorschau (WYSIWYG) beim Schreiben.
- Vollständiges CommonMark und GitHub Flavored Markdown: Mathematik (KaTeX),
  Tabellen, Fußnoten, Front Matter, Diagramme und Code mit Syntaxhervorhebung.
- Eine Dokumentgliederung und eine Suche im Editor, die selbst in langen Dateien
  flüssig bleiben.
- Export als **PDF** – mit Mathematik, Code-Hervorhebung und fest eingebetteten
  Schriften.
- **Verliert nie deine Arbeit.** Automatisches Speichern,
  Wiederherstellungsentwürfe und atomare Schreibvorgänge bewahren jede
  Änderung.
- **Standardmäßig privat.** Kein Konto, keine Cloud, keine Telemetrie – alles
  bleibt auf dem Gerät.
- **Leichtgewichtig.** Eine Shell aus Vue + Capacitor hält die ganze App bei
  rund 7,8 MB – klein und leicht, aber voll ausgestattet.

</td>
<td width="220" valign="top"><img src="docs/screenshots/editor-rich.png" alt="Tabellen, Code und Mathematik werden beim Tippen live gerendert" width="200"></td>
</tr>
</table>

### Mach ihn zu deinem

<table width="100%">
<tr>
<td width="220" valign="middle"><img src="docs/screenshots/makeityours.png" alt="Die angedockte Format-Symbolleiste und eine angepasste Auswahl-Leiste (Einfügen) während der Bearbeitung" width="200"></td>
<td valign="middle">

- **Baue deine eigenen Symbolleisten.** Stelle die untere Schnellleiste aus
  einem Pool von Befehlen zusammen und ordne sie per Ziehen neu. Selbst die
  Auswahl-Symbolleiste kann deine eigenen Befehle aufnehmen.

<br>

- **Designs und Erscheinungsbild.** Helle, dunkle und benutzerdefinierte
  Designs; Schrift und Layout einstellbar.

<br>

- **Markdown nach deinem Geschmack.** Stimme fein ab, wie dein Markdown
  geschrieben und gerendert wird – von Aufzählungszeichen bis Front Matter.

<br>

- **Kontrolle auf Dateiebene.** Kodierung, Zeilenenden und der Umgang mit dem
  abschließenden Zeilenumbruch – pro Dokument einstellbar.

</td>
</tr>
</table>

### Fürs Handy gebaut, für alle poliert

<table width="100%">
<tr>
<td width="220" valign="top"><img src="docs/screenshots/cjk.png" alt="Der Editor mit einem chinesischen Dokument und chinesischer Oberfläche" width="200"></td>
<td valign="middle">

- **Deine Dateien bleiben, wo sie sind.** Bearbeite `.md` direkt aus jedem
  Speicheranbieter über die Systemauswahl und reiche Dokumente per
  Teilen-Dialog an andere Apps weiter und zurück.

<br>

- **Für den Daumen gemacht.** Bequem mit einer Hand erreichbar, dazu ein
  ruhiges, editorzentriertes Layout.

<br>

- **Barrierefrei und zurückhaltend.** Ein ruhiges Graphit-Design, das
  WCAG 2.2 AA erfüllt, mit klarer Fokusreihenfolge und dezenten, sparsamen
  Animationen.

<br>

- **Zehn Sprachen,** automatisch nach deinem System gewählt: Englisch, Deutsch,
  Spanisch, Französisch, Japanisch, Koreanisch, Portugiesisch, Türkisch sowie
  vereinfachtes und traditionelles Chinesisch.

</td>
</tr>
</table>

---

## Projektstatus

> [!IMPORTANT]
> Das erste signierte öffentliche Release, **v0.1.0**, ist verfügbar. Sein APK
> wird vom Release-Workflow des Repositorys gebaut, ist auf das offizielle
> Release-Zertifikat festgelegt und hat auf Android 14 die Prüfungen für
> Neuinstallation und Upgrade mit demselben Schlüssel bestanden.

Signierte Builds findest du auf der
[Releases](https://github.com/Renakoni/marktext-android/releases/latest)-Seite.

## Aus dem Quellcode bauen

Du brauchst [Node.js](https://nodejs.org/) mit [pnpm](https://pnpm.io/) und
[Android Studio](https://developer.android.com/studio) (das Android SDK und
ein JDK; die App läuft ab API 24 und wird gegen API 36 gebaut).

```sh
pnpm install          # Abhängigkeiten installieren
pnpm dev              # die Web-Shell im Browser als Vorschau öffnen
pnpm android:sync     # die Web-App bauen und ins Android-Projekt synchronisieren
pnpm android:open     # in Android Studio öffnen, dann auf Gerät oder Emulator starten
```

Weitere Skripte (`test`, `lint`, `typecheck`, `build`) stehen in der
`package.json`. Release-Verantwortliche folgen
[`docs/RELEASING.md`](docs/RELEASING.md).

> [!TIP]
> Der Markdown-Editor-Kern ist eine eingebundene, **modifizierte** Kopie von
> `@muyajs/core` (Muya) unter `third_party/muya`. Wenn du sie änderst,
> synchronisiere deine Änderungen vor dem Build nach
> `node_modules/@muyajs/core/src/**` – ein Vertragstest erkennt Abweichungen.

## Mitwirken

Issues und Pull Requests sind willkommen. Halte jede Änderung fokussiert und
schreib Tests, wo es sinnvoll ist.

## Lizenz & Namensnennung

MarkText for Android erscheint unter der [MIT-Lizenz](LICENSE).

Es ist ein **inoffizieller** Port, der auf MarkTexts Open-Source-Arbeit aufbaut
und weder mit dem MarkText-Projekt verbunden ist noch von ihm unterstützt wird:

- **MarkText** – der Desktop-Editor und das Design, denen dieser Port folgt.
  Copyright © Luo Ran und die MarkText-Mitwirkenden, MIT-lizenziert.
- **Muya** (`@muyajs/core`) – der Editor-Kern, eingebunden und modifiziert unter
  `third_party/muya`, mit unverändert beibehaltener MIT-Originallizenz
  ([`third_party/muya/LICENSE`](third_party/muya/LICENSE)).

## Danksagungen

MarkText for Android steht auf den Schultern vieler Open-Source-Projekte: dem
[MarkText](https://github.com/marktext/marktext)-Editor und seinen
[Mitwirkenden](https://github.com/marktext/marktext/graphs/contributors), der
[Muya](https://github.com/marktext/muya)-Engine sowie
[Vue](https://vuejs.org/), [Vite](https://vite.dev/) und
[Capacitor](https://capacitorjs.com/). Danke an alle, die sie gebaut haben.

---

<p align="center"><sub><em>Markdown, ganz leise, ganz deins.</em></sub></p>
